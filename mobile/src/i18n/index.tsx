/**
 * i18n/index.tsx
 * Offline-first, reactive internationalization system for Intellifusion SafeMine Mobile.
 * Bundles all 8 languages (English, Sanskrit, Hindi, Bengali, Odia, Telugu, Marathi, Santali).
 * Supports automatic state-to-language derivation, manual override, parameter interpolation,
 * and fallback to English.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { appStorage } from "../utils/storage";
import {
  LanguageCode,
  LanguageMeta,
  SUPPORTED_LANGUAGES,
  STATE_LANGUAGE_MAP,
} from "./types";

// Static JSON imports bundled into binary for offline access
import en from "./locales/en.json";
import sa from "./locales/sa.json";
import hi from "./locales/hi.json";
import bn from "./locales/bn.json";
import or_locale from "./locales/or.json";
import te from "./locales/te.json";
import mr from "./locales/mr.json";
import sat from "./locales/sat.json";

export { LanguageCode, LanguageMeta, SUPPORTED_LANGUAGES, STATE_LANGUAGE_MAP };

const STORAGE_LANG_KEY = "@intellifusion:language_preference";

const TRANSLATIONS: Record<LanguageCode, any> = {
  en,
  sa,
  hi,
  bn,
  or: or_locale,
  te,
  mr,
  sat,
};

type Listener = (lang: LanguageCode) => void;
const listeners = new Set<Listener>();

let currentGlobalLanguage: LanguageCode = "en";

/**
 * Resolves nested key path like "settings.language_title"
 */
function resolveKey(obj: any, path: string): string | null {
  if (!obj) return null;
  const parts = path.split(".");
  let curr = obj;
  for (const part of parts) {
    if (curr === undefined || curr === null) return null;
    curr = curr[part];
  }
  return typeof curr === "string" ? curr : null;
}

/**
 * Interpolate {{param}} values into translation template
 */
function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`;
  });
}

/**
 * Translate key with fallback to English
 */
export function translate(
  key: string,
  params?: Record<string, string | number>,
  lang: LanguageCode = currentGlobalLanguage
): string {
  const activeDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  let text = resolveKey(activeDict, key);

  // Fallback to English if missing in selected language
  if (text === null && lang !== "en") {
    text = resolveKey(TRANSLATIONS.en, key);
  }

  // If still missing, return the key itself
  if (text === null) {
    return key;
  }

  return interpolate(text, params);
}

/**
 * Derives default language from a mine site's state name
 */
export function deriveLanguageFromState(state?: string | null): LanguageCode {
  if (!state) return "en";
  const trimmed = state.trim();
  // Exact match
  if (STATE_LANGUAGE_MAP[trimmed]) {
    return STATE_LANGUAGE_MAP[trimmed];
  }
  // Case-insensitive or partial match
  const lower = trimmed.toLowerCase();
  for (const [key, lang] of Object.entries(STATE_LANGUAGE_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return lang;
    }
  }
  return "en";
}

/**
 * Global i18n helper object for non-React contexts
 */
export const i18n = {
  get language(): LanguageCode {
    return currentGlobalLanguage;
  },
  t(key: string, params?: Record<string, string | number>): string {
    return translate(key, params, currentGlobalLanguage);
  },
  setLanguage(lang: LanguageCode) {
    if (currentGlobalLanguage !== lang && TRANSLATIONS[lang]) {
      currentGlobalLanguage = lang;
      listeners.forEach((fn) => fn(lang));
    }
  },
  addListener(fn: Listener) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

interface I18nContextValue {
  language: LanguageCode;
  t: (key: string, params?: Record<string, string | number>) => string;
  changeLanguage: (lang: LanguageCode) => Promise<void>;
  resetToDefaultLanguage: () => Promise<void>;
  isDerived: boolean;
  derivedLanguage: LanguageCode;
  userMineState: string | null;
  supportedLanguages: LanguageMeta[];
  currentLanguageMeta: LanguageMeta;
  syncWithUser: (preferredLang?: string | null, mineState?: string | null) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const I18nProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(currentGlobalLanguage);
  const [explicitOverride, setExplicitOverride] = useState<LanguageCode | null>(null);
  const [userMineState, setUserMineState] = useState<string | null>(null);

  const derivedLanguage = useMemo(() => {
    return deriveLanguageFromState(userMineState);
  }, [userMineState]);

  // Load persisted offline preference on mount
  useEffect(() => {
    async function loadSavedPreference() {
      try {
        const saved = await appStorage.getItem(STORAGE_LANG_KEY);
        if (saved && (saved in TRANSLATIONS)) {
          const code = saved as LanguageCode;
          setExplicitOverride(code);
          setLanguageState(code);
          i18n.setLanguage(code);
        }
      } catch (err) {
        console.warn("[i18n] Failed to load saved language:", err);
      }
    }
    loadSavedPreference();
  }, []);

  const changeLanguage = useCallback(async (newLang: LanguageCode) => {
    if (newLang in TRANSLATIONS) {
      setExplicitOverride(newLang);
      setLanguageState(newLang);
      i18n.setLanguage(newLang);
      try {
        await appStorage.setItem(STORAGE_LANG_KEY, newLang);
      } catch (err) {
        console.warn("[i18n] Failed to persist language:", err);
      }
    }
  }, []);

  const resetToDefaultLanguage = useCallback(async () => {
    setExplicitOverride(null);
    const target = derivedLanguage;
    setLanguageState(target);
    i18n.setLanguage(target);
    try {
      await appStorage.deleteItem(STORAGE_LANG_KEY);
    } catch (err) {
      console.warn("[i18n] Failed to reset language:", err);
    }
  }, [derivedLanguage]);

  const syncWithUser = useCallback((preferredLang?: string | null, mineState?: string | null) => {
    if (mineState !== undefined) {
      setUserMineState(mineState);
    }

    // If user has explicit remote preference, sync with it
    if (preferredLang && (preferredLang in TRANSLATIONS)) {
      const code = preferredLang as LanguageCode;
      setExplicitOverride(code);
      setLanguageState(code);
      i18n.setLanguage(code);
      appStorage.setItem(STORAGE_LANG_KEY, code).catch(() => {});
    } else if (preferredLang === null) {
      // Revert to derived state language
      const target = deriveLanguageFromState(mineState);
      setExplicitOverride(null);
      setLanguageState(target);
      i18n.setLanguage(target);
      appStorage.deleteItem(STORAGE_LANG_KEY).catch(() => {});
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      return translate(key, params, language);
    },
    [language]
  );

  const currentLanguageMeta = useMemo(() => {
    return (
      SUPPORTED_LANGUAGES.find((l) => l.code === language) ||
      SUPPORTED_LANGUAGES[0]
    );
  }, [language]);

  const isDerived = explicitOverride === null;

  const value: I18nContextValue = {
    language,
    t,
    changeLanguage,
    resetToDefaultLanguage,
    isDerived,
    derivedLanguage,
    userMineState,
    supportedLanguages: SUPPORTED_LANGUAGES,
    currentLanguageMeta,
    syncWithUser,
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext) as I18nContextValue | null;
  if (!context) {
    // Fallback if rendered outside provider
    return {
      t: (key: string, params?: Record<string, string | number>) => translate(key, params, currentGlobalLanguage),
      language: currentGlobalLanguage,
      changeLanguage: async (lang: LanguageCode) => i18n.setLanguage(lang),
      resetToDefaultLanguage: async () => i18n.setLanguage("en"),
      isDerived: true,
      derivedLanguage: "en" as LanguageCode,
      userMineState: null,
      supportedLanguages: SUPPORTED_LANGUAGES,
      currentLanguageMeta: SUPPORTED_LANGUAGES[0],
      syncWithUser: () => {},
    };
  }
  return context;
}
