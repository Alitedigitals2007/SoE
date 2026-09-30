"use client";

import * as React from "react";
import { reportIntegrityAction } from "@/app/actions/match";
import type { IntegrityFlagKind } from "@/lib/domain";

/**
 * Handlers to spread onto the wrapper around the question and answer box. All
 * optional so the same type works whether or not the rules are in force.
 */
export type ZoneHandlers = {
  onCopy?: (e: React.ClipboardEvent) => void;
  onCut?: (e: React.ClipboardEvent) => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
};

type VendorDocument = Document & { webkitFullscreenElement?: Element | null };

function isFullscreenNow(): boolean {
  if (typeof document === "undefined") return true;
  const d = document as VendorDocument;
  return !!(d.fullscreenElement ?? d.webkitFullscreenElement);
}

/**
 * Match integrity enforcement.
 *
 * Two rules run for on-field players while a match is live and un-paused:
 *
 *   1. No copying. Copy, cut, paste and drop are blocked inside the protected
 *      zone (the question and the answer box) and each attempt is reported.
 *   2. No leaving fullscreen. The page asks for fullscreen when a question
 *      opens, and any exit — Esc, F11, alt-tab, task switch — is reported.
 *
 * Half-time and any other pause switch both rules off, and the referee and
 * admins are never subject to either, because they are not answerable.
 *
 * The browser will not let a page force fullscreen without a gesture, so the
 * hook reports whether it is currently fullscreen and the UI renders a prompt.
 * It also cannot stop a determined player photographing the screen; the
 * deterrence here is the card, not the block.
 */
export function useMatchIntegrity({
  code,
  enforcing,
}: {
  code: string;
  /** true only for an on-field player in a live, un-paused match */
  enforcing: boolean;
}) {
  // Fullscreen is browser state, not React state, so it is read through
  // useSyncExternalStore rather than mirrored into a useEffect.
  const fullscreen = React.useSyncExternalStore(
    React.useCallback((onChange: () => void) => {
      document.addEventListener("fullscreenchange", onChange);
      document.addEventListener("webkitfullscreenchange", onChange);
      return () => {
        document.removeEventListener("fullscreenchange", onChange);
        document.removeEventListener("webkitfullscreenchange", onChange);
      };
    }, []),
    isFullscreenNow,
    // Server render: assume compliant so no banner flashes before hydration.
    () => true,
  );

  const [pasteBlocked, setPasteBlocked] = React.useState(false);
  // Only a fullscreen exit that we were actually watching for is a breach, so
  // the detector stays disarmed until the player has genuinely gone fullscreen.
  const armedRef = React.useRef(false);
  const lastReportRef = React.useRef(0);

  const requestFullscreen = React.useCallback(async () => {
    if (typeof document === "undefined") return;
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
      msRequestFullscreen?: () => Promise<void>;
    };
    const request = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
    if (!request) return;
    try {
      await request.call(el);
    } catch {
      /* denied without a gesture, or already fullscreen — the prompt covers it */
    }
  }, []);

  const report = React.useCallback(
    (kind: IntegrityFlagKind, detail?: string) => {
      const now = Date.now();
      // Client-side backstop on top of the server cooldown: a held Ctrl+C or a
      // flickering fullscreen exit must not spam the referee's board.
      if (now - lastReportRef.current < 2000) return;
      lastReportRef.current = now;
      void reportIntegrityAction({ code, kind, detail }).catch(() => {
        /* the poll will reconcile; never break answering on a failed report */
      });
    },
    [code],
  );

  // Arm on entering fullscreen, report on leaving. No setState here: the
  // browser event already drives `fullscreen`, so the banner follows it.
  React.useEffect(() => {
    if (!enforcing) {
      armedRef.current = false;
      return;
    }
    if (fullscreen) {
      armedRef.current = true;
      return;
    }
    if (armedRef.current) {
      armedRef.current = false;
      report("LEFT_FULLSCREEN", "Left fullscreen while the match was running");
    }
  }, [enforcing, fullscreen, report]);

  // Nudge into fullscreen when a question opens. Browsers reject a request that
  // is not tied to a user gesture, so this usually no-ops and the prompt is the
  // real call to action — on engines that allow it after a prior gesture it works.
  React.useEffect(() => {
    if (enforcing && !fullscreen) void requestFullscreen();
  }, [enforcing, fullscreen, requestFullscreen]);

  // Tab switch detection: visibilitychange fires when the player switches tabs
  // or minimizes the window during a live match.
  React.useEffect(() => {
    if (!enforcing) return;
    const onVisibilityChange = () => {
      if (document.hidden) {
        report("TAB_SWITCH", "Switched tabs or minimized the window during the match");
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enforcing, report]);

  // Keyboard shortcut blocking: block common shortcuts that could be used to
  // cheat (Ctrl+C, Ctrl+V, Ctrl+X, F12, etc.) outside the answer input.
  React.useEffect(() => {
    if (!enforcing) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA";
      // Allow normal typing in the answer box
      if (isInput) return;
      // Block dangerous shortcuts
      if ((e.ctrlKey || e.metaKey) && ["c", "v", "x", "p", "s", "u"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        report("KEYBOARD_SHORTCUT", `Blocked Ctrl+${e.key.toUpperCase()} outside the answer box`);
      }
      // Block F12 (dev tools)
      if (e.key === "F12") {
        e.preventDefault();
        report("KEYBOARD_SHORTCUT", "Tried to open developer tools (F12)");
      }
      // Block Ctrl+Shift+I/J (dev tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        report("KEYBOARD_SHORTCUT", "Tried to open developer tools");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [enforcing, report]);

  // Screen recording detection: check for active screen capture sessions.
  // This is best-effort — browsers don't always expose recording state.
  React.useEffect(() => {
    if (!enforcing) return;
    let cancelled = false;
    const checkRecording = async () => {
      try {
        // @ts-expect-error - getDisplayMedia is not always typed
        if (navigator.mediaDevices?.getDisplayMedia) {
          // We can't directly detect recording, but we can check if the user
          // has granted screen capture permissions recently
        }
      } catch {
        // Ignore — this is best-effort
      }
    };
    checkRecording();
    return () => { cancelled = true; };
  }, [enforcing]);

  /**
   * Spread onto the wrapper around the question and answer box. Copy, cut,
   * paste, drop, and context menu all bubble, so one handler covers the answer
   * input and the question text, and the page's own copy-link button (outside
   * the zone) keeps working.
   */
  const zoneHandlers = React.useMemo<ZoneHandlers>(
    () =>
      enforcing
        ? {
            onCopy: (e: React.ClipboardEvent) => {
              e.preventDefault();
              report("COPIED_CONTENT", "Tried to copy the question off the screen");
            },
            onCut: (e: React.ClipboardEvent) => {
              e.preventDefault();
              report("COPIED_CONTENT", "Tried to cut from the match screen");
            },
            onPaste: (e: React.ClipboardEvent) => {
              e.preventDefault();
              setPasteBlocked(true);
              report("COPIED_ANSWER", "Tried to paste into the answer box");
            },
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              setPasteBlocked(true);
              report("COPIED_ANSWER", "Tried to drop text into the answer box");
            },
            onContextMenu: (e: React.MouseEvent) => {
              e.preventDefault();
              report("RIGHT_CLICK", "Right-clicked on the match area");
            },
          }
        : {},
    [enforcing, report],
  );

  /** Clears the inline warning after a moment. */
  React.useEffect(() => {
    if (!pasteBlocked) return;
    const t = window.setTimeout(() => setPasteBlocked(false), 4000);
    return () => window.clearTimeout(t);
  }, [pasteBlocked]);

  return { fullscreen, requestFullscreen, zoneHandlers, pasteBlocked };
}
