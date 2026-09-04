import type { Metadata } from "next";
import "./globals.css";
import { sitePath } from "@/lib/site-path";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "MS AUTO DETAILS — Gestão",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
  description: "Ganhos, despesas, agenda e orçamentos da MS AUTO DETAILS em um só lugar.",
  openGraph: {
    title: "MS AUTO DETAILS — Gestão",
    description: "Gestão do negócio em um só lugar.",
    images: [{ url: sitePath("/og.png"), width: 1200, height: 630, alt: "MS AUTO DETAILS — Gestão" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MS AUTO DETAILS — Gestão",
    description: "Gestão do negócio em um só lugar.",
    images: [sitePath("/og.png")],
  },
  icons: {
    icon: sitePath("/favicon.svg"),
    shortcut: sitePath("/favicon.svg"),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
