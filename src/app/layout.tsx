import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teacher OS",
  description: "İngilizce öğretmenleri için takip paneli",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <div className="sayfa">{children}</div>
      </body>
    </html>
  );
}
