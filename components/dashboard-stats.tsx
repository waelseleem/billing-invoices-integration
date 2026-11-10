"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DollarSign,
  Droplets,
  Banknote,
  FileText,
  Landmark,
  Users,
  Loader2
} from "lucide-react"
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/i18n/utils';
import { useTranslations } from '@/lib/i18n/hooks';

export interface OracleRecord {
  CSTYPE: string
  BRANCHE: string
  COSTCENTER: string
  BILNG_DATE: string
  ENTAGTAM: string | number
  SEWER: string | number
  TANZEEM: string | number
  ESTDAMA: string | number
  CONTRACT: string
  TAXES: string | number
  ROUNDING: string | number
  WATERCREDIT: string | number
  SEWERCREDIT: string | number
  WATERDEBIT: string | number
  SEWERDEBIT: string | number
  CONSUMP: string | number
}

// Helper function to safely parse numbers
function safeParseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  const parsed = parseFloat(value)
  return isNaN(parsed) ? 0 : parsed
}

// Helper function to format currency
function formatCurrency(amount: number): string {
  return `EGP ${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Helper function to format large numbers
function formatLargeNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toLocaleString("en-US")
}

interface DashboardStatsProps {
  data: OracleRecord[]
  isLoading: boolean
  error: string | null
}

export function DashboardStats({ data = [], isLoading, error }: DashboardStatsProps) {
  // Get locale from pathname for translations
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const t = useTranslations(locale);
  
  // Calculate totals only when not loading and no error
  const totals = !isLoading && !error ? data.reduce(
    (acc, record) => {
      acc.revenue +=
        safeParseNumber(record.ENTAGTAM) +
        safeParseNumber(record.SEWER) +
        safeParseNumber(record.ESTDAMA) +
        safeParseNumber(record.CONTRACT) +
        safeParseNumber(record.ROUNDING)
      acc.taxes +=
        safeParseNumber(record.TAXES) + safeParseNumber(record.TANZEEM)
      acc.consumption += safeParseNumber(record.CONSUMP)
      acc.credits +=
        safeParseNumber(record.WATERCREDIT) +
        safeParseNumber(record.SEWERCREDIT)
      return acc
    },
    {
      revenue: 0,
      consumption: 0,
      credits: 0,
      taxes: 0,
    }
  ) : {
    revenue: 0,
    consumption: 0,
    credits: 0,
    taxes: 0,
  }

  const netRevenue = totals.revenue - totals.credits

  const cards = [
    {
      title: t('dashboard.stats.totalRevenue'),
      value: formatCurrency(totals.revenue),
      description: t('dashboard.stats.totalRevenueDesc'),
      icon: <DollarSign className="h-4 w-4 text-green-500" />,
    },
    {
      title: t('dashboard.stats.netRevenue'),
      value: formatCurrency(netRevenue),
      description: t('dashboard.stats.netRevenueDesc'),
      icon: <Landmark className="h-4 w-4 text-emerald-500" />,
    },
    {
      title: t('dashboard.stats.totalConsumption'),
      value: `${formatLargeNumber(totals.consumption)} m³`,
      description: t('dashboard.stats.totalConsumptionDesc'),
      icon: <Droplets className="h-4 w-4 text-blue-500" />,
    },
    {
      title: t('dashboard.stats.totalTaxes'),
      value: formatCurrency(totals.taxes),
      description: t('dashboard.stats.totalTaxesDesc'),
      icon: <FileText className="h-4 w-4 text-red-500" />,
    },
    {
      title: t('dashboard.stats.netCredits'),
      value: formatCurrency(totals.credits),
      description: t('dashboard.stats.netCreditsDesc'),
      icon: <Banknote className="h-4 w-4 text-orange-500" />,
    },
    {
      title: t('dashboard.stats.processedRecords'),
      value: formatLargeNumber(data.length),
      description: t('dashboard.stats.processedRecordsDesc'),
      icon: <Users className="h-4 w-4 text-indigo-500" />,
    },
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <Card key={i} className="transition-all duration-200 hover:shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : error ? (
              <div className="text-red-500">{card.icon}</div>
            ) : (
              card.icon
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-[120px]" />
                <Skeleton className="h-4 w-[180px]" />
              </div>
            ) : error ? (
              <>
                <div className="text-2xl font-bold text-red-600">{t('common.error')}</div>
                <p className="text-xs text-red-500 truncate" title={error}>
                  {error}
                </p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold tracking-tight">{card.value}</div>
                <p className="text-sm text-muted-foreground mt-1">{card.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
} 