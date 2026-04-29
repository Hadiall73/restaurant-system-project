import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Restaurant Manager Pro",
  description: "KI-gestütztes Restaurant Management System",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "RestoPro" },
  viewport: { width: "device-width", initialScale: 1, maximumScale: 1 },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#f97316" />
      </head>
      <body className={`${geist.className} bg-gray-950 text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
