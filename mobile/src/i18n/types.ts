/**
 * types.ts
 * Type definitions for Intellifusion Mobile Multilingual Support (8 languages).
 * System/Major: English (en - default), Sanskrit (sa - formal statutory register)
 * Regional: Hindi (hi), Bengali (bn), Odia (or), Telugu (te), Marathi (mr), Santali (sat)
 */

export type LanguageCode = "en" | "sa" | "hi" | "bn" | "or" | "te" | "mr" | "sat";

export type LanguageCategory = "system" | "regional";

export interface LanguageMeta {
  code: LanguageCode;
  name: string;
  nativeName: string;
  script: string;
  category: LanguageCategory;
  regionalState?: string;
  description: string;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  // System / Major Languages
  {
    code: "en",
    name: "English",
    nativeName: "English",
    script: "Latin",
    category: "system",
    description: "System primary & fallback",
  },
  {
    code: "sa",
    name: "Sanskrit",
    nativeName: "संस्कृतम्",
    script: "Devanagari",
    category: "system",
    description: "Statutory & DGMS official register",
  },
  // Regional Coalfield Languages
  {
    code: "hi",
    name: "Hindi",
    nativeName: "हिन्दी",
    script: "Devanagari",
    category: "regional",
    regionalState: "Jharkhand, MP, Chhattisgarh",
    description: "CCL, SECL, NCL command areas",
  },
  {
    code: "bn",
    name: "Bengali",
    nativeName: "বাংলা",
    script: "Bengali",
    category: "regional",
    regionalState: "West Bengal",
    description: "Raniganj, Asansol (ECL)",
  },
  {
    code: "or",
    name: "Odia",
    nativeName: "ଓଡ଼ିଆ",
    script: "Odia",
    category: "regional",
    regionalState: "Odisha",
    description: "Talcher, IB Valley (MCL)",
  },
  {
    code: "te",
    name: "Telugu",
    nativeName: "తెలుగు",
    script: "Telugu",
    category: "regional",
    regionalState: "Telangana",
    description: "Singareni Collieries (SCCL)",
  },
  {
    code: "mr",
    name: "Marathi",
    nativeName: "मराठी",
    script: "Devanagari",
    category: "regional",
    regionalState: "Maharashtra",
    description: "Chandrapur, Nagpur (WCL)",
  },
  {
    code: "sat",
    name: "Santali",
    nativeName: "ᱥᱟᱱᱛᱟᱲᱤ",
    script: "Ol Chiki",
    category: "regional",
    regionalState: "JH / WB / OD Tribal Belt",
    description: "Tribal workforce across coalfields",
  },
];

export const STATE_LANGUAGE_MAP: Record<string, LanguageCode> = {
  Jharkhand: "hi",
  "Madhya Pradesh": "hi",
  Chhattisgarh: "hi",
  "West Bengal": "bn",
  Odisha: "or",
  Telangana: "te",
  Maharashtra: "mr",
};
