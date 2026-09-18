import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";

export const metadata: Metadata = {
  title: {
    default: "مركز العمليات",
    template: "%s | مركز العمليات",
  },
  description: "مركز إدارة العمليات الانتخابية.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
