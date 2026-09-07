import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TakaTrack — Personal Ledger Manager (P12) · LSH26-T049",
  description:
    "Expense ledger, receipt-OCR review flow, next-month forecasting and DPS savings pockets for the LofiStack Hackathon 2026 P12 problem. Team ReWoo.",
  keywords: ["expense tracker", "OCR", "forecast", "DPS", "LofiStack Hackathon 2026", "P12"],
  authors: [{ name: "Team ReWoo — LSH26-T049" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
