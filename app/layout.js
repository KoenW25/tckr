import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import "./globals.css";
import AuthGate from "@/components/AuthGate";
import CookieBanner from "@/components/CookieBanner";
import FooterLegalNav from "@/components/FooterLegalNav";
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
  metadataBase: new URL("https://tckr.nl"),
  title: "Tckr — De online markt voor tickets",
  description: "Koop en verkoop tickets voor events. Eerlijke prijzen, geverifieerde tickets.",
  openGraph: {
    title: "Tckr — De online markt voor tickets",
    description: "Koop en verkoop tickets voor events. Eerlijke prijzen, geverifieerde tickets.",
    url: "https://tckr.nl",
    siteName: "Tckr",
    type: "website",
    images: [
      {
        url: "/og-image",
        width: 1200,
        height: 630,
        alt: "Tckr logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tckr — De online markt voor tickets",
    description: "Koop en verkoop tickets voor events. Eerlijke prijzen, geverifieerde tickets.",
    images: ["/og-image"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <LanguageProvider>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1 pb-28">
              <AuthGate>
                {children}
              </AuthGate>
            </div>

            <footer className="border-t border-slate-200 bg-white">
              <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                <p className="text-slate-500">© 2026 Tckr</p>
                <FooterLegalNav />
                <a href="mailto:info@tckr.nl" className="hover:text-slate-900 hover:underline">
                  info@tckr.nl
                </a>
              </div>
            </footer>
          </div>
          <CookieBanner />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
