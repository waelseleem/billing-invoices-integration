"use client"

import { Activity } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { LanguageSwitcher } from "@/components/language-switcher"
import { usePathname } from "next/navigation"
import { getLocaleFromPathname } from "@/lib/i18n/utils"
import { useTranslations } from "@/lib/i18n/hooks"

export function AppHeader() {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const t = useTranslations(locale)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold tracking-tight text-foreground">
              {t('header.title')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('header.subtitle')}
            </p>
          </div>
          <div className="sm:hidden">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Oracle → SAP B1
            </h1>
          </div>
        </div>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
