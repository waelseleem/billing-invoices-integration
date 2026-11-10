"use client"

import { useState } from "react"
import { AppHeader } from "@/components/app-header"
import { OverviewTab } from "@/components/overview-tab"
import { DataViewTab } from "@/components/data-view-tab"
import { OracleBillingTabs } from "@/components/oracle-billing-tabs"
import { LogsTab } from "@/components/logs-tab"
import { ScheduleTab } from "@/components/schedule-tab"
import { JournalEntriesTabs } from "@/components/journal-entries-tabs"
import { LastSyncStatus } from "@/components/last-sync-status"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { OracleDataProvider } from "@/lib/oracle-data-context"
import { useTranslations } from "@/lib/i18n/hooks"

interface DashboardClientProps {
  locale: string;
}

export function DashboardClient({ locale }: DashboardClientProps) {
  const t = useTranslations(locale as 'ar' | 'en');

  return (
    <OracleDataProvider locale={locale as 'ar' | 'en'}>
      <div className="bg-background">
        <AppHeader />
        <main className="mx-auto max-w-screen-2xl p-6">
          <div className="space-y-8">
            {/* Page Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h2 className="text-4xl font-bold tracking-tight">{t('dashboard.title')}</h2>
                <p className="text-muted-foreground text-lg">{t('dashboard.subtitle')}</p>
              </div>
              <LastSyncStatus />
            </div>
       
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className={`grid w-full grid-cols-5 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
                <TabsTrigger value="overview">{t('navigation.overview')}</TabsTrigger>
                <TabsTrigger value="oracle">{t('navigation.oracleBilling')}</TabsTrigger>
                <TabsTrigger value="journal">{t('navigation.journalEntries')}</TabsTrigger>
                <TabsTrigger value="schedule">{t('navigation.schedule')}</TabsTrigger>
                <TabsTrigger value="logs">{t('navigation.logs')}</TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4">
                <OverviewTab />
              </TabsContent>

              <TabsContent value="oracle" className="space-y-4">
                <OracleBillingTabs />
              </TabsContent>
              
              <TabsContent value="journal" className="space-y-4">
                <JournalEntriesTabs />
              </TabsContent>
              
              <TabsContent value="schedule" className="space-y-4">
                <ScheduleTab />
              </TabsContent>
              
              <TabsContent value="logs" className="space-y-4">
                <LogsTab />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </OracleDataProvider>
  )
} 