import katex from "katex";
import * as React from "react";

/**
 * LaTeX math rendering for question text, answers and the odds explainer.
 * Accepts inline `$…$` / `\(…\)` and display `$$…$$` / `\[…\]` delimiters
 * mixed into plain text; everything else renders verbatim. KaTeX is XSS-safe
 * by default (trust off), and malformed math degrades to red error ink via
 * throwOnError: false — a page can never break over a formula.
 */

type Segment = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const MATH_PATTERN =
  /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g;

function parseSegments(source: string): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MATH_PATTERN.lastIndex = 0;
  while ((m = MATH_PATTERN.exec(source))) {
    if (m.index > last) segments.push({ kind: "text", value: source.slice(last, m.index) });
    const tex = (m[1] ?? m[2] ?? m[3] ?? m[4] ?? "").trim();
    if (tex) segments.push({ kind: "math", value: tex, display: m[1] != null || m[2] != null });
    last = m.index + m[0].length;
  }
  if (last < source.length) segments.push({ kind: "text", value: source.slice(last) });
  return segments;
}

export function renderTex(tex: string, display = false): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return "";
  }
}

/** Plain text with inline/display LaTeX rendered by KaTeX. */
export function MathText({ children, className }: { children: React.ReactNode; className?: string }) {
  if (typeof children !== "string") return <span className={className}>{children}</span>;
  const segments = parseSegments(children);
  if (segments.length === 0) return null;
  if (segments.length === 1 && segments[0].kind === "text") {
    return <span className={className}>{segments[0].value}</span>;
  }
  return (
    <span className={className}>
      {segments.map((s, i) =>
        s.kind === "text" ? (
          <React.Fragment key={i}>{s.value}</React.Fragment>
        ) : s.display ? (
          <span
            key={i}
            className="katex-display my-2 block overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: renderTex(s.value, true) }}
          />
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: renderTex(s.value, false) }} />
        ),
      )}
    </span>
  );
}

/** A standalone display-math block (centre-stage formula). */
export function MathBlock({ tex, className }: { tex: string; className?: string }) {
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: renderTex(tex, true) }}
    />
  );
}
