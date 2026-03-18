'use client';

import Link from 'next/link';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';

export default function FooterLegalNav() {
  const { lang } = useLanguage();

  return (
    <nav className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <Link href="/voorwaarden" className="hover:text-slate-900 hover:underline">
        {t('footer.terms', lang)}
      </Link>
      <Link href="/privacy" className="hover:text-slate-900 hover:underline">
        {t('footer.privacy', lang)}
      </Link>
      <Link href="/cookie-instellingen" className="hover:text-slate-900 hover:underline">
        {t('footer.cookies', lang)}
      </Link>
    </nav>
  );
}
