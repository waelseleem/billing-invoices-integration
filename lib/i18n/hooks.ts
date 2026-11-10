'use client';

import { useMemo } from 'react';
import type { Locale } from './config';

// Import dictionaries directly for client-side use
import arDictionary from './dictionaries/ar.json';
import enDictionary from './dictionaries/en.json';

const dictionaries = {
  ar: arDictionary,
  en: enDictionary,
};

export function useTranslations(locale: Locale) {
  const t = useMemo(() => {
    const dictionary = dictionaries[locale] || dictionaries.ar;
    
    return (key: string) => {
      const keys = key.split('.');
      let value: any = dictionary;
      
      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return key; // Return the key if translation not found
        }
      }
      
      return typeof value === 'string' ? value : key;
    };
  }, [locale]);

  return t;
} 