import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import "./redesign.css";
import "./design-tokens.css";
import "./election-workspace.css";

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
  variable: "--font-tajawal",
});

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
      <body className={tajawal.variable}>{children}</body>
    </html>
  );
}
