import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/common.json';
import sa from './locales/sa/common.json';
import hi from './locales/hi/common.json';
import bn from './locales/bn/common.json';
import or from './locales/or/common.json';
import te from './locales/te/common.json';
import mr from './locales/mr/common.json';
import sat from './locales/sat/common.json';

export interface LanguageOption {
  code: string;
  label: string;
  nativeLabel: string;
  category: 'system' | 'regional';
  region?: string;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', category: 'system', region: 'National / Default / All Coalfields' },
  { code: 'sa', label: 'Sanskrit', nativeLabel: 'संस्कृतम्', category: 'system', region: 'Official Statutory & Classical Register' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', category: 'regional', region: 'Jharkhand, MP, Chhattisgarh (CCL, SECL, NCL)' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', category: 'regional', region: 'West Bengal (Raniganj, Asansol, ECL)' },
  { code: 'or', label: 'Odia', nativeLabel: 'ଓଡ଼ିଆ', category: 'regional', region: 'Odisha (Talcher, IB Valley, MCL)' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు', category: 'regional', region: 'Telangana (Singareni Collieries, SCCL)' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', category: 'regional', region: 'Maharashtra (Chandrapur, Nagpur, WCL)' },
  { code: 'sat', label: 'Santali', nativeLabel: 'ᱥᱟᱱᱛᱟᱲᱤ', category: 'regional', region: 'Tribal Mining Belt (Ol Chiki)' },
];

export const resources = {
  en: { translation: en },
  sa: { translation: sa },
  hi: { translation: hi },
  bn: { translation: bn },
  or: { translation: or },
  te: { translation: te },
  mr: { translation: mr },
  sat: { translation: sat },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'sa', 'hi', 'bn', 'or', 'te', 'mr', 'sat'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'intellifusion_language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
