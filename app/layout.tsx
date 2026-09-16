import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RJM Relay Studio",
  description: "Rakit, simulasikan, dan pelajari rangkaian kontrol cold storage.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
