import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

// Fonts are bundled from npm (@fontsource), not fetched at build time.
// Cinzel: inscriptional capitals, as carved on court buildings.
// EB Garamond: the book face of printed judgments.
// Geist Sans: data, tables and form controls.
const cinzel = localFont({
  src: [
    { path: "../../node_modules/@fontsource/cinzel/files/cinzel-latin-500-normal.woff2", weight: "500" },
    { path: "../../node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-cinzel",
  display: "swap",
});

const garamond = localFont({
  src: [
    { path: "../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2", weight: "400" },
    { path: "../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "../../node_modules/@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-garamond",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Court Case Platform", template: "%s · Court Case Platform" },
  description: "Public records of criminal cases, their hearings, orders and appeals, across the courts of India.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fonts = [GeistSans.variable, GeistMono.variable, cinzel.variable, garamond.variable].join(" ");
  return (
    <html lang="en-IN" className={fonts}>
      <body className="font-sans antialiased">
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <SiteHeader />
        <div className="flex flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}
