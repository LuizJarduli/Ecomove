import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EcoMove — Mobilidade Urbana Sustentável & Inteligência Geoespacial (FACENS)",
  description:
    "Apresentação oficial UPX IV (Centro Universitário Facens): Aplicativo Flutter, Geoprocessamento PostGIS, Economia EcoPoints e Inteligência Artificial.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#F7F7F5] text-[#111111]">
        {children}
      </body>
    </html>
  );
}
