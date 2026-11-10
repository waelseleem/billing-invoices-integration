import { i18n, type Locale } from './config';

export function getLocaleFromPathname(pathname: string): Locale {
  const segments = pathname.split('/');
  const locale = segments[1] as Locale;
  
  if (i18n.locales.includes(locale)) {
    return locale;
  }
  
  return i18n.defaultLocale;
}

export function getPathnameWithoutLocale(pathname: string): string {
  const segments = pathname.split('/');
  const locale = segments[1] as Locale;
  
  if (i18n.locales.includes(locale)) {
    return '/' + segments.slice(2).join('/');
  }
  
  return pathname;
}

export function createLocalizedPathname(pathname: string, locale: Locale): string {
  const pathnameWithoutLocale = getPathnameWithoutLocale(pathname);
  
  if (locale === i18n.defaultLocale) {
    return pathnameWithoutLocale;
  }
  
  return `/${locale}${pathnameWithoutLocale}`;
}

export function isRTL(locale: Locale): boolean {
  return locale === 'ar';
} 