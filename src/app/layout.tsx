import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Stadium of Elite",
    template: "%s · Stadium of Elite",
  },
  description:
    "Live head-to-head quiz football. Two teams, ten questions, one referee — every correct answer is a goal.",
  applicationName: "Stadium of Elite",
  keywords: ["quiz", "football", "multiplayer", "trivia", "match"],
};

export const viewport: Viewport = {
  themeColor: "#070c14",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col stadium-glow">{children}</body>
    </html>
  );
}
