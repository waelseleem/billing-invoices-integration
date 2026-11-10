export const i18n = {
  defaultLocale: 'ar',
  locales: ['ar', 'en'],
} as const;

export type Locale = (typeof i18n)['locales'][number];

export const localeNames: Record<Locale, string> = {
  ar: 'العربية',
  en: 'English',
};

export const localeFlags: Record<Locale, string> = {
  ar: '🇸🇦',
  en: '🇺🇸',
};

export const rtlLocales: Locale[] = ['ar']; 