import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import CookieBanner from "@/components/CookieBanner";
import { LanguageProvider } from "@/lib/LanguageContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Tckr – De eerlijke markt voor live tickets",
  description: "Koop en verkoop tickets voor live events op een eerlijke en transparante manier.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider>
          <AuthGate>
            {children}
          </AuthGate>
          <CookieBanner />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
