import { ImageResponse } from "next/og";
import { loadMatchFullByCode } from "@/lib/match/snapshot";

export const runtime = "nodejs";
export const alt = "Match — Stadium of Elite";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const match = await loadMatchFullByCode(code);

  const homeName = match?.homeName ?? "Team A";
  const awayName = match?.awayName ?? "Team B";
  const homeScore = match?.homeScore ?? 0;
  const awayScore = match?.awayScore ?? 0;
  const status = match?.status ?? "DRAFT";

  const statusLabel = status === "LIVE" ? "LIVE" : status === "FINISHED" ? "FULL-TIME" : "PRE-MATCH";
  const statusColor =
    status === "LIVE" ? "#087a55" : status === "FINISHED" ? "#536474" : "#cc8100";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #07543d 0%, #087a55 50%, #138c58 100%)",
          fontFamily: 'Arial Narrow, "Roboto Condensed", Impact, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "12px",
            border: "1px solid rgba(255,255,255,.18)",
            borderRadius: "18px",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <span
            style={{
              width: "40px",
              height: "40px",
              background: "#ff6b2c",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "22px",
              color: "#1b2430",
            }}
          >
            ⚽
          </span>
          <span
            style={{
              fontSize: "16px",
              fontWeight: 900,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.9)",
            }}
          >
            STADIUM <span style={{ color: "#ff6b2c" }}>OF ELITE</span>
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "40px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
            <span style={{ fontSize: "32px", fontWeight: 800, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {homeName}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#ff6b2c", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Team A
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "80px", fontWeight: 900, color: "white", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              {homeScore}
              <span style={{ margin: "0 8px", color: "rgba(255,255,255,.4)" }}>–</span>
              {awayScore}
            </span>
            <div
              style={{
                marginTop: "8px",
                padding: "4px 16px",
                background: statusColor,
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "white",
                textTransform: "uppercase",
              }}
            >
              {statusLabel}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span style={{ fontSize: "32px", fontWeight: 800, color: "white", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {awayName}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#2364d2", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Team B
            </span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "28px",
            fontSize: "14px",
            color: "rgba(255,255,255,.5)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Match Code: {code.toUpperCase()}
        </div>
      </div>
    ),
    { ...size },
  );
}
