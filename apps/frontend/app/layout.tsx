import type { Metadata, Viewport } from "next";
import "./globals.css";

const API_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"
    ).origin;
  } catch {
    return "http://localhost:3000";
  }
})();

export const metadata: Metadata = {
  title: {
    default: "Infovion Academic SaaS",
    template: "%s | Infovion",
  },
  description: "Academic ERP Platform — students, fees, attendance, exams.",
  robots: { index: false, follow: false }, // private SaaS — keep out of search engines
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ae5525",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Establish early connection to API host before any fetch fires */}
        <link rel="preconnect" href={API_ORIGIN} />
        <link rel="dns-prefetch" href={API_ORIGIN} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
