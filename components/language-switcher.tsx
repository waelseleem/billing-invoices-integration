'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { i18n, localeNames, localeFlags, type Locale } from '@/lib/i18n/config';
import { createLocalizedPathname } from '@/lib/i18n/utils';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLanguageChange = (locale: Locale) => {
    const newPathname = createLocalizedPathname(pathname, locale);
    router.push(newPathname);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-9 p-0">
          <Globe className="h-4 w-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {i18n.locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => handleLanguageChange(locale)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <span className="text-lg">{localeFlags[locale]}</span>
            <span>{localeNames[locale]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 