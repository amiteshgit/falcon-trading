import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Falcon Trading — NSE Strategy Console",
  description: "Validated NSE fade-strategy scanner, portfolio and backtester",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
