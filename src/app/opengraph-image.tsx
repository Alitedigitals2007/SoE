import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Stadium of Elite — Live Quiz Football";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
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
            marginBottom: "12px",
          }}
        >
          <span
            style={{
              width: "48px",
              height: "48px",
              background: "#ff6b2c",
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "28px",
              color: "#1b2430",
            }}
          >
            ⚽
          </span>
          <span
            style={{
              fontSize: "18px",
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
            fontSize: "64px",
            fontWeight: 900,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
          }}
        >
          Live Quiz Football
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "rgba(255,255,255,.7)",
            marginTop: "16px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          Two Teams · Ten Questions · One Referee
        </div>
      </div>
    ),
    { ...size },
  );
}
