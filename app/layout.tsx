import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "6 nimmt! | Shinhan AX",
  description: "6 nimmt! (Take 6!) 실시간 멀티플레이",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen">{children}</body>
    </html>
  );
}
