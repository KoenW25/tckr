import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthGate from "@/components/AuthGate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Tickr – De eerlijke markt voor live tickets",
  description: "Koop en verkoop tickets voor live events op een eerlijke en transparante manier.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthGate>
          {children}
        </AuthGate>
      </body>
    </html>
  );
}
