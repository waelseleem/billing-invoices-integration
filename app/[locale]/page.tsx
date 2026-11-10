import { DashboardClient } from "@/components/dashboard-client"

export default async function Dashboard({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <DashboardClient locale={locale} />
} 