"use client"

import { RefreshCw } from "lucide-react"
import { useOracleData } from "@/lib/oracle-data-context"
import { formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { Badge } from "@/components/ui/badge"
import { usePathname } from "next/navigation"
import { getLocaleFromPathname } from "@/lib/i18n/utils"
import { useTranslations } from "@/lib/i18n/hooks"

export function LastSyncStatus() {
  const { lastUpdated, loading } = useOracleData()
  const pathname = usePathname()
  const locale = getLocaleFromPathname(pathname)
  const t = useTranslations(locale)

  if (!lastUpdated) {
    return null
  }

  return (
    <Badge variant="secondary" className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium">
      {loading ? (
        <RefreshCw className="h-3 w-3 animate-spin" />
      ) : (
        <div className="h-2 w-2 bg-green-500 rounded-full" />
      )}
      <span className="hidden sm:inline">
        {t('dashboard.stats.lastSync')}: {formatDistanceToNow(lastUpdated, { 
          addSuffix: true,
          locale: locale === 'ar' ? ar : enUS
        })}
      </span>
      <span className="sm:hidden">
        {formatDistanceToNow(lastUpdated, { 
          addSuffix: true,
          locale: locale === 'ar' ? ar : enUS
        })}
      </span>
    </Badge>
  )
} 