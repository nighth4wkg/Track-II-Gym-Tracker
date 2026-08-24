import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TRACK_ASSET_QUERY } from "./trackConfig";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Track II",
  description: "Track II helps you record exercises, target reps, and reps in reserve across your workout splits.",
  icons: {
    icon: [
      { url: `/track-icon.svg${TRACK_ASSET_QUERY}`, type: "image/svg+xml" },
      { url: `/icon-192.png${TRACK_ASSET_QUERY}`, sizes: "192x192", type: "image/png" },
    ],
    shortcut: `/track-icon.svg${TRACK_ASSET_QUERY}`,
    apple: `/apple-touch-icon.png${TRACK_ASSET_QUERY}`,
  },
  manifest: `/manifest.webmanifest${TRACK_ASSET_QUERY}`,
  appleWebApp: {
    capable: true,
    title: "Track II",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
