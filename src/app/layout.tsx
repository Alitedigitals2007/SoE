import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://stadiumofelite.vercel.app"),
  title: {
    default: "Stadium of Elite",
    template: "%s · Stadium of Elite",
  },
  description:
    "Live head-to-head quiz football. Two teams, ten questions, one referee — every correct answer is a goal.",
  applicationName: "Stadium of Elite",
  keywords: ["quiz", "football", "multiplayer", "trivia", "match"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Stadium of Elite",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#087a55",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col stadium-glow">
        <script
          dangerouslySetInnerHTML={{
            __html: `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
