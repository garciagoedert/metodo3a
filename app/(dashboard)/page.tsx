import { Suspense } from "react"
import { getDashboardData, getConnectedAccounts } from "./actions"

import { MetricCard } from "@/components/dashboard/metric-card"
import { DashboardInteractiveBoard } from "@/components/dashboard/interactive-board"
import { DollarSign, MousePointer2, Users, Eye, MessageSquare, Tag, ChevronLeft, ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Header } from "@/components/dashboard/header"
import { FunnelSection } from "@/components/dashboard/funnel-section"

export default async function DashboardPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const searchParams = await props.searchParams
  const dateRange = (searchParams.from && searchParams.to)
    ? { from: searchParams.from as string, to: searchParams.to as string }
    : undefined
  const accountIdParam = searchParams.account as string | undefined

  const [data, accounts] = await Promise.all([
    getDashboardData(dateRange, accountIdParam),
    getConnectedAccounts()
  ])


  // Determine Active Account ID properly
  const activeAccount = accountIdParam
    ? accounts.find((a: any) => a.provider_account_id === accountIdParam)
    : accounts[0]

  const activeAccountId = activeAccount?.provider_account_id

  // Calculate Month Key for Manual Metrics (YYYY-MM-01)
  // We use the 'from' date of the range to determine the 'Month' context
  const fromDate = dateRange ? new Date(dateRange.from) : new Date(new Date().setDate(new Date().getDate() - 30))
  const monthStart = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`

  // Manual Metrics are now fetched within getDashboardData to support ranges

  // Calculate Date Objects for Header (Hydration Fix)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)

  const dateRangeObj = dateRange
    ? {
      from: new Date(new Date(dateRange.from).setHours(0, 0, 0, 0)),
      to: new Date(new Date(dateRange.to).setHours(0, 0, 0, 0))
    }
    : { from: thirtyDaysAgo, to: today }

  // Handle loading/error states simply for now
  if ('error' in data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Header dateRange={dateRangeObj} accounts={accounts} currentAccountId={accountIdParam} />
        <div className="p-8 text-red-500 border rounded-md bg-red-50">
          <h3 className="font-bold">Erro ao carregar dados</h3>
          <p>{data.error}</p>
          <p className="mt-4 text-sm text-muted-foreground">Tente reconectar sua conta em "Contas Vinculadas".</p>
        </div>
      </div>
    )
  }

  if ('warning' in data && data.warning) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        <Header dateRange={dateRangeObj} accounts={accounts} currentAccountId={accountIdParam} />
        <div className="flex h-[400px] w-full flex-col items-center justify-center rounded-lg border border-dashed bg-muted/50 p-10 text-center">
          <h3 className="mt-4 text-lg font-semibold">Nenhuma conta conectada ou selecionada</h3>
          <p className="mb-4 mt-2 text-sm text-muted-foreground">
            Conecte uma conta do Meta Ads ou selecione uma conta diferente no menu acima.
          </p>
          <a href="/admin/accounts" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90">
            Conectar Agora
          </a>
        </div>
      </div>
    )
  }

  const { insights, daily, distribution, campaigns, funnel, topCreatives: topAds = [], dashboardConfig } = data as any // Type assertion for MVP

  // Assemble Funnel Data
  // Use aggregated funnel from server (supports multi-month ranges)
  const funnelData = funnel || {
    impressions: insights.impressions,
    reach: insights.reach,
    profile_visits: insights.profile_visits,
    followers: insights.followers,
    scheduled: 0,
    showed: 0,
  }

  // Adapting to Dashboard Props (CPA needs this structure)
  const manualMetrics = {
    appointments_scheduled: funnelData.scheduled,
    appointments_showed: funnelData.showed,
    new_followers: funnelData.followers // Mapped to 'followers' key in funnel object
  }

  return (
    <div className="flex flex-1 flex-col w-full">
      <Header dateRange={dateRangeObj} accounts={accounts} currentAccountId={accountIdParam} />

      <main className="flex flex-1 flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
        <DashboardInteractiveBoard
          insights={insights}
          daily={daily}
          distribution={distribution}
          topCreatives={topAds}
          manualMetrics={manualMetrics}
          funnelData={funnelData}
          accountId={activeAccountId}
          monthStart={monthStart}
          dateRange={dateRangeObj}
          dashboardConfig={dashboardConfig}
        />
      </main>
    </div >
  )
}
