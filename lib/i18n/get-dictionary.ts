import 'server-only';
import type { Locale } from './config';

const dictionaries = {
  ar: () => import('./dictionaries/ar.json').then((module) => module.default),
  en: () => import('./dictionaries/en.json').then((module) => module.default),
};

export const getDictionary = async (locale: Locale) => dictionaries[locale](); 