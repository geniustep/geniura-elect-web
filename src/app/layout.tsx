import type { Metadata } from "next";
import { NavigationFeedback } from "@/components/navigation/navigation-feedback";
import { Cairo } from "next/font/google";
import "./globals.css";
import "./redesign.css";
import "./design-tokens.css";
import "./election-workspace.css";
import "./navigation-feedback.css";

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-cairo",
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
      <body className={`${cairo.className} ${cairo.variable}`}>
        <NavigationFeedback />
        {children}
      </body>
    </html>
  );
}
