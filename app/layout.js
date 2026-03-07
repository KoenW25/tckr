import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
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
  title: "Tckr – De eerlijke markt voor tickets",
  description: "Koop en verkoop tickets voor live events op een eerlijke en transparante manier.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
                <nav className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                  <Link href="/voorwaarden" className="hover:text-slate-900 hover:underline">
                    Algemene Voorwaarden
                  </Link>
                  <Link href="/privacy" className="hover:text-slate-900 hover:underline">
                    Privacybeleid
                  </Link>
                  <Link href="/cookie-instellingen" className="hover:text-slate-900 hover:underline">
                    Cookie instellingen
                  </Link>
                </nav>
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
