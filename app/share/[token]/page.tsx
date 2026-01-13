import { Suspense } from "react"
import { getPublicDashboardData } from "@/app/(dashboard)/actions"
import { DashboardInteractiveBoard } from "@/components/dashboard/interactive-board"
import { getAccountByToken } from "@/components/dashboard/share-actions"
import { MonthPicker } from "@/components/dashboard/month-picker"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { LayoutDashboard } from "lucide-react"
import Image from "next/image"
import { MonthlyAnalysisSection } from "@/components/dashboard/monthly-analysis"
import { SharePageCopyButton } from "@/components/dashboard/share-page-copy-button"
import { PaymentStatus } from "@/components/dashboard/payment-status"

export default async function PublicSharePage(props: {
    params: Promise<{ token: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const params = await props.params
    const searchParams = await props.searchParams
    const token = params.token

    // Identify User
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const isLoggedIn = !!user

    // Validate Token First
    const { account, error: accountError } = await getAccountByToken(token)

    if (accountError || !account) {
        return (
            <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
                <h1 className="text-2xl font-bold text-slate-800">Link Inválido ou Expirado</h1>
                <p className="text-slate-500">Verifique se o link está correto ou solicite um novo.</p>
            </div>
        )
    }

    // Parse Date Range
    const dateRange = (searchParams.from && searchParams.to)
        ? { from: searchParams.from as string, to: searchParams.to as string }
        : undefined

    // Fetch Data (Bypass Auth Check inside getPublicDashboardData, but we know user status here)
    const data = await getPublicDashboardData(token, dateRange)

    // Handle Errors
    if ('error' in data) {
        return (
            <div className="flex h-screen w-full items-center justify-center flex-col gap-4">
                <h1 className="text-xl font-bold text-red-600">Erro ao carregar dados</h1>
                <p className="text-slate-500">{data.error}</p>
            </div>
        )
    }

    // Same logic as DashboardPage to prepare props
    const { insights, daily, distribution, campaigns, funnel, topCreatives: topAds = [], dashboardConfig } = data as any

    const funnelData = funnel || {
        impressions: insights?.impressions || 0,
        reach: insights?.reach || 0,
        profile_visits: insights?.profile_visits || 0,
        followers: insights?.followers || 0,
        scheduled: 0,
        showed: 0,
    }

    const manualMetrics = {
        appointments_scheduled: funnelData.scheduled,
        appointments_showed: funnelData.showed
    }

    // Calculate Month Key for Manual Metrics (YYYY-MM-01) - Context only
    let fromDate: Date
    if (dateRange) {
        // Parse manually to avoid timezone shift (Server running locally)
        const [y, m, d] = dateRange.from.split('-').map(Number)
        fromDate = new Date(y, m - 1, d) // Local date
    } else {
        fromDate = new Date()
        fromDate.setDate(fromDate.getDate() - 30)
    }
    const monthStart = `${fromDate.getFullYear()}-${String(fromDate.getMonth() + 1).padStart(2, '0')}-01`

    return (
        <div className="flex min-h-screen flex-col bg-slate-50/50">
            {/* Minimal Header */}
            {/* Minimal Header */}
            <header className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-sm shadow-sm">
                <div className="flex flex-col md:flex-row items-center justify-between p-4 gap-4 max-w-[1600px] mx-auto w-full">

                    {/* Brand & Account */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-4">
                        <div className="flex items-center gap-3 md:gap-4">
                            <div className="relative h-8 w-28 md:w-32 shrink-0">
                                <Image
                                    src="/logo.svg"
                                    alt="Método 3A"
                                    fill
                                    className="object-contain object-left"
                                    priority
                                />
                            </div>
                            <div className="hidden md:block h-6 w-px bg-slate-200"></div>
                            <span className="font-medium text-slate-700 text-sm md:text-base truncate max-w-[180px] md:max-w-xs">
                                {account.name}
                            </span>
                        </div>

                        {/* Mobile Top Actions: Voltar */}
                        <div className="flex items-center gap-2 md:hidden">
                            {isLoggedIn && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" asChild>
                                    <a href="/"><LayoutDashboard className="h-4 w-4" /></a>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-row items-center gap-2 w-full md:w-auto bg-white md:bg-transparent p-1 md:p-0 rounded-lg border md:border-none shadow-sm md:shadow-none">
                        {isLoggedIn && <PaymentStatus accountId={account.provider_account_id} className="w-auto [&_div.flex-col]:hidden md:[&_div.flex-col]:flex" />}
                        <div className="flex-1 md:flex-none">
                            <MonthPicker className="w-full md:w-[240px]" />
                        </div>

                        {isLoggedIn && (
                            <>
                                <SharePageCopyButton />
                                <div className="hidden md:flex items-center">
                                    <div className="h-4 w-px bg-slate-200 mx-2"></div>
                                    <Badge variant="outline" className="mr-2 text-blue-600 bg-blue-50 border-blue-200">Modo Admin</Badge>
                                    <Button variant="ghost" size="sm" asChild>
                                        <a href="/" className="flex items-center gap-2 text-slate-600 hover:text-blue-600">
                                            <LayoutDashboard className="h-4 w-4" />
                                            <span>Voltar</span>
                                        </a>
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex flex-1 flex-col gap-6 p-6 max-w-[1600px] mx-auto w-full">
                <MonthlyAnalysisSection
                    accountId={account.id}
                    month={monthStart}
                    isLoggedIn={isLoggedIn}
                />
                <DashboardInteractiveBoard
                    insights={insights}
                    daily={daily}
                    distribution={distribution}
                    topCreatives={topAds}
                    manualMetrics={manualMetrics}
                    funnelData={funnelData}
                    accountId={account.provider_account_id}
                    monthStart={monthStart}
                    dashboardConfig={dashboardConfig}
                    readOnly={!isLoggedIn} // If logged in, readOnly is false (Editable)
                />
            </main>
        </div>
    )
}
