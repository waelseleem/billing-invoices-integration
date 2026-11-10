"use client"

import { usePathname } from "next/navigation"
import { JournalEntryViewerTab } from "@/components/journal-entry-viewer-tab"
import { JournalEntryViewerTabGov } from "@/components/journal-entry-viewer-tab-gov"
import { GovOracleDataProvider } from "@/lib/oracle-data-context-gov"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "@/lib/i18n/hooks"

/**
 * Parent "Journal Entries" tab.
 *
 * Keeps the existing People journal viewer untouched and adds a Gov viewer
 * driven by the Gov Oracle data provider and Gov SAP endpoints.
 */
export function JournalEntriesTabs() {
  const pathname = usePathname()
  const locale = pathname.startsWith('/ar') ? 'ar' : 'en'
  const t = useTranslations(locale)
  const isRTL = locale === 'ar'

  return (
    <Tabs defaultValue="people" className={`space-y-4 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="flex justify-center">
        <TabsList className="grid w-full max-w-lg grid-cols-2 bg-muted/60 p-1">
          <TabsTrigger value="people" className="data-[state=active]:bg-background">
            {t('navigation.journalEntriesPeople')}
          </TabsTrigger>
          <TabsTrigger value="gov" className="data-[state=active]:bg-background">
            {t('navigation.journalEntriesGov')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="people" className="space-y-4">
        <JournalEntryViewerTab />
      </TabsContent>

      <TabsContent value="gov" className="space-y-4">
        <GovOracleDataProvider locale={locale}>
          <JournalEntryViewerTabGov />
        </GovOracleDataProvider>
      </TabsContent>
    </Tabs>
  )
}
