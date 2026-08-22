import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Teacher OS",
  description: "Ingilizce ogretmenleri icin takip paneli",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f6f7f9",
          color: "#1a1d21",
        }}
      >
        {children}
      </body>
    </html>
  );
}
