'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LanguageContext = createContext({ lang: 'nl', setLang: () => {}, t: (k) => k });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState('nl');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('tickr-lang');
      if (saved === 'en' || saved === 'nl') {
        setLangState(saved);
        return;
      }

      // Auto-select language for first-time visitors: Dutch for NL locales, English otherwise.
      const browserLocale = String(navigator?.language || '').toLowerCase();
      const preferredLang = browserLocale.startsWith('nl') ? 'nl' : 'en';
      setLangState(preferredLang);
    } catch {}
  }, []);

  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem('tickr-lang', l); } catch {}
  }, []);

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
