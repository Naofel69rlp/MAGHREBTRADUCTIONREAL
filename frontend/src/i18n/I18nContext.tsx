import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { storage } from "@/src/utils/storage";
import { type LangCode } from "@/src/theme/languages";
import {
  TRANSLATIONS,
  langName as rawLangName,
  type Locale,
} from "@/src/i18n/translations";

const LOCALE_KEY = "maghreb_interface_locale";
const DEFAULT_LOCALE: Locale = "fr";

interface I18nContextValue {
  locale: Locale;
  ready: boolean;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  langName: (code: LangCode) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = (await storage.getItem(LOCALE_KEY, null)) as Locale | null;
        if (stored && TRANSLATIONS[stored]) setLocaleState(stored);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    storage.setItem(LOCALE_KEY, l);
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = TRANSLATIONS[locale] ?? TRANSLATIONS[DEFAULT_LOCALE];
      let str = dict[key] ?? TRANSLATIONS[DEFAULT_LOCALE][key] ?? key;
      if (params) {
        Object.keys(params).forEach((k) => {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(params[k]));
        });
      }
      return str;
    },
    [locale],
  );

  const langName = useCallback((code: LangCode) => rawLangName(locale, code), [locale]);

  const value = useMemo(
    () => ({ locale, ready, setLocale, t, langName }),
    [locale, ready, setLocale, t, langName],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
