import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "mapbox-gl/dist/mapbox-gl.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "CivIxa — Public Insights",
  description: "Multilingual citizen feedback platform for MP constituency development"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
