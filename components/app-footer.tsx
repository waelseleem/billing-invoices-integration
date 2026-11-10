"use client"

import { usePathname } from 'next/navigation'
import { getLocaleFromPathname } from '@/lib/i18n/utils'
import { useTranslations } from '@/lib/i18n/hooks'
import { ExternalLink, Mail } from 'lucide-react'

export function AppFooter() {
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const t = useTranslations(locale)

  return (
    <footer className={`border-t border-border bg-card py-4 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      <div className="mx-auto max-w-screen-2xl px-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
          {/* Copyright Section */}
          <div className="text-center lg:text-start text-sm text-muted-foreground">
            <span className="font-medium">
              {t('footer.allRightsReserved')} © 2025
            </span>
            <a 
              href="https://www.b1-solutions.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium mx-2 transition-colors"
            >
              BE ONE SOLUTIONS
            </a>
            <span className="font-medium mx-1">| {t('footer.createdBy')}</span>
            <a 
              href="https://www.linkedin.com/in/engabo3lia/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium mx-2 transition-colors inline-flex items-center gap-1"
            >
              Ahmed Aboalia
              <ExternalLink className="h-3 w-3" />
            </a>
            <a 
              href="https://ahmed.aboalia.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 font-medium mx-2 transition-colors inline-flex items-center gap-1"
            >
              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </a>
            <a 
              href="mailto:Ahmed@Aboalia.com"
              className="text-primary hover:text-primary/80 font-medium mx-2 transition-colors inline-flex items-center gap-1"
            >
              <Mail className="h-3 w-3" />

            </a>
          </div>

          {/* Menu Section */}
          <ul className="flex flex-wrap justify-center gap-4 text-sm">
            <li>
              <a 
                href="https://www.b1-solutions.com/be-one-sap-partner-sap-business-one/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium inline-flex items-center gap-1"
              >
                {t('footer.about')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>
              <a 
                href="https://www.b1-solutions.com/sap-artner-contact-us/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors font-medium inline-flex items-center gap-1"
              >
                {t('footer.contactSupport')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  )
} 