"use client"

import { usePathname } from "next/navigation"
import OracleDataTab from "@/components/oracle-data-tab"
import OracleDataTabGov from "@/components/oracle-data-tab-gov"
import { GovOracleDataProvider } from "@/lib/oracle-data-context-gov"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTranslations } from "@/lib/i18n/hooks"

/**
 * Parent "Oracle Billing View" tab.
 *
 * Keeps the existing People view untouched and adds a Gov view that reads
 * from HCS_EDAMS.DATA_FIN_gov using its own isolated data provider.
 */
export function OracleBillingTabs() {
  const pathname = usePathname()
  const locale = pathname.startsWith('/ar') ? 'ar' : 'en'
  const t = useTranslations(locale)
  const isRTL = locale === 'ar'

  return (
    <Tabs defaultValue="people" className={`space-y-4 ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="flex justify-center">
        <TabsList className="grid w-full max-w-lg grid-cols-2 bg-muted/60 p-1">
          <TabsTrigger value="people" className="data-[state=active]:bg-background">
            {t('navigation.oracleBillingPeople')}
          </TabsTrigger>
          <TabsTrigger value="gov" className="data-[state=active]:bg-background">
            {t('navigation.oracleBillingGov')}
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="people" className="space-y-4">
        <OracleDataTab />
      </TabsContent>

      <TabsContent value="gov" className="space-y-4">
        <GovOracleDataProvider locale={locale}>
          <OracleDataTabGov />
        </GovOracleDataProvider>
      </TabsContent>
    </Tabs>
  )
}
