'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';

export default function PrivacyPage() {
  const { lang } = useLanguage();
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {t('privacy.title', lang)}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {t('privacy.intro', lang)}
          </p>
        </header>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700 shadow-sm shadow-slate-100">
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. In het
            kader van de Algemene Verordening Gegevensbescherming (AVG / GDPR)
            verwerken wij je persoonsgegevens zorgvuldig en transparant. Deze
            tekst is een tijdelijke placeholder en beschrijft niet het definitieve
            privacybeleid van Tckr.
          </p>
          <p>
            In een definitieve versie zal onder andere worden toegelicht welke
            persoonsgegevens we verzamelen, voor welke doeleinden we deze
            gebruiken, welke rechtsgrond van toepassing is en hoe lang gegevens
            worden bewaard. Ook worden je rechten als betrokkene beschreven,
            zoals het recht op inzage, rectificatie en gegevenswissing.
          </p>
          <p>
            Totdat een definitieve versie beschikbaar is, mag deze tekst niet
            worden beschouwd als juridisch advies of als volledig compliant met
            de AVG / GDPR. Raadpleeg een juridisch adviseur om een formeel
            privacybeleid op te stellen dat aansluit bij de daadwerkelijke
            gegevensverwerkingen binnen Tckr.
          </p>
        </section>
      </main>
    </div>
  );
}

