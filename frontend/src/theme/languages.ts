export type LangCode = "fr" | "ma" | "dz" | "tn" | "en" | "es" | "it" | "nl";

export interface LangInfo {
  code: LangCode;
  /** Fallback native/self name (interface uses i18n names via useI18n().langName). */
  name: string;
  dialect: boolean;
  /** Whether it is one of the 4 highlighted Maghreb/France languages. */
  main: boolean;
  /** Primary flag accent colour (used for the main 4). */
  accent: string;
}

export const LANGUAGES: Record<LangCode, LangInfo> = {
  fr: { code: "fr", name: "Français", dialect: false, main: true, accent: "#0055A4" },
  ma: { code: "ma", name: "Marocain", dialect: true, main: true, accent: "#C1272D" },
  dz: { code: "dz", name: "Algérien", dialect: true, main: true, accent: "#006233" },
  tn: { code: "tn", name: "Tunisien", dialect: true, main: true, accent: "#E70013" },
  en: { code: "en", name: "English", dialect: false, main: false, accent: "#012169" },
  es: { code: "es", name: "Español", dialect: false, main: false, accent: "#AA151B" },
  it: { code: "it", name: "Italiano", dialect: false, main: false, accent: "#008C45" },
  nl: { code: "nl", name: "Nederlands", dialect: false, main: false, accent: "#21468B" },
};

export const LANG_LIST: LangInfo[] = [
  LANGUAGES.fr,
  LANGUAGES.ma,
  LANGUAGES.dz,
  LANGUAGES.tn,
  LANGUAGES.en,
  LANGUAGES.es,
  LANGUAGES.it,
  LANGUAGES.nl,
];

export function isDialect(code: LangCode): boolean {
  return LANGUAGES[code].dialect;
}

/**
 * Flag rendering config. `dir` = stripe direction ("h" horizontal, "v" vertical).
 * `stripes` optional (each has colour + optional flex). `bg` fills when there are
 * no stripes. `emblem` draws a small centred dot to hint the country's emblem.
 */
export interface FlagConfig {
  dir?: "h" | "v";
  stripes?: { c: string; f?: number }[];
  bg?: string;
  emblem?: string;
}

export const FLAGS: Record<LangCode, FlagConfig> = {
  fr: { dir: "v", stripes: [{ c: "#0055A4" }, { c: "#FFFFFF" }, { c: "#EF4135" }] },
  ma: { bg: "#C1272D", emblem: "#006233" },
  dz: { dir: "v", stripes: [{ c: "#006233" }, { c: "#FFFFFF" }], emblem: "#D21034" },
  tn: { bg: "#E70013", emblem: "#FFFFFF" },
  en: { dir: "v", stripes: [{ c: "#012169" }, { c: "#FFFFFF" }, { c: "#C8102E" }] },
  es: { dir: "h", stripes: [{ c: "#AA151B", f: 1 }, { c: "#F1BF00", f: 2 }, { c: "#AA151B", f: 1 }] },
  it: { dir: "v", stripes: [{ c: "#008C45" }, { c: "#FFFFFF" }, { c: "#CD212A" }] },
  nl: { dir: "h", stripes: [{ c: "#AE1C28" }, { c: "#FFFFFF" }, { c: "#21468B" }] },
};
