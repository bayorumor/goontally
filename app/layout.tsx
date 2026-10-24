import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geom, Rubik } from "next/font/google";

const rubik = Rubik({ subsets: ["latin"], variable: "--font-rubik" });
// Display face for headings, the logo and big numbers.
const geom = Geom({ subsets: ["latin"], variable: "--font-geom" });

export const metadata: Metadata = {
  title: "Goontally",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Goontally",
  },
  // A private app: keep every page out of search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // Matches the page background so the status bar blends in.
  themeColor: "#120e17",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${rubik.variable} ${geom.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/apple-icon.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
