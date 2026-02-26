'use client'

import { useState, useEffect, useMemo, Fragment } from "react"
import { Filter, Layers, Zap, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, XCircle, Play, Eye, Info, Wallet, Minus, MousePointer2, DollarSign, Tag, TrendingUp, Users, MessageSquare, Clock, UserPlus, Calendar, BarChart3, LayoutGrid, ImageOff, ExternalLink, Activity } from "lucide-react"
import { format, subDays, differenceInDays, parseISO, startOfDay, endOfDay, eachDayOfInterval } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAdMonitoringData, getGlobalMonitoringAction, getAdPreviewAction } from "@/app/(dashboard)/actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { PerformanceChart } from "@/components/dashboard/charts"
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog"
import { useRouter, useSearchParams } from "next/navigation"
import { AdPreviewLoader } from "@/components/dashboard/ad-preview-loader"
import { cn } from "@/lib/utils"

interface MonitoringViewProps {
    accountId?: string
    dateRange?: { from: Date, to: Date }
    currentView?: string
}

type AnalysisStatus = 'good' | 'neutral' | 'bad' | 'critical'

// Helper: safe division
const safeDiv = (n: number, d: number) => d > 0 ? n / d : 0

// Helper: robust local timezone parsing (avoiding shifts)
function parseDateSafe(ymd: string) {
    if (!ymd) return new Date()
    const [y, m, d] = ymd.split('T')[0].split('-').map(Number)
    return new Date(y, m - 1, d, 12, 0, 0) // Always noon local
}

// Configuration for each metric type (color, label, format) to use in the dynamic chart
const CHART_METRICS_CONFIG: Record<string, { label: string, color: string, icon: any, formatter: (v: number) => string }> = {
    spend: { label: "Valor Usado", color: "#10b981", icon: DollarSign, formatter: (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    impressions: { label: "Impressões", color: "#3b82f6", icon: Eye, formatter: (v) => v.toLocaleString('pt-BR') },
    reach: { label: "Alcance", color: "#6366f1", icon: Users, formatter: (v) => v.toLocaleString('pt-BR') },
    conversations: { label: "Conversas", color: "#f97316", icon: MessageSquare, formatter: (v) => v.toLocaleString('pt-BR') },
    cpa: { label: "Custo por Conversa", color: "#ef4444", icon: Wallet, formatter: (v) => `R$ ${v.toFixed(2)}` },
    frequency: { label: "Frequência", color: "#14b8a6", icon: Activity, formatter: (v) => v.toFixed(2) },
    inline_link_clicks: { label: "Cliques no Link", color: "#8b5cf6", icon: MousePointer2, formatter: (v) => v.toLocaleString('pt-BR') },
    cpc: { label: "CPC", color: "#ec4899", icon: Tag, formatter: (v) => `R$ ${v.toFixed(2)}` },
    ctr: { label: "CTR", color: "#f59e0b", icon: TrendingUp, formatter: (v) => `${v.toFixed(2)}%` },
    profile_visits: { label: "Visitas ao Perfil", color: "#a855f7", icon: UserPlus, formatter: (v) => v.toLocaleString('pt-BR') },
}


export function MonitoringView({ accountId, dateRange, currentView = 'overview' }: MonitoringViewProps) {
    const [loading, setLoading] = useState(false)
    const [rawData, setRawData] = useState<any[]>([])
    const [globalHealth, setGlobalHealth] = useState<any[]>([])

    // UI State
    const [expandedRow, setExpandedRow] = useState<string | null>(null)
    const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['cpa', 'cpc', 'ctr'])

    // Limits max 4 metrics visually on chart at same time
    const handleMetricToggle = (metricKey: string) => {
        setSelectedChartMetrics(prev => {
            if (prev.includes(metricKey)) {
                if (prev.length === 1) return prev // block removing last metric
                return prev.filter(k => k !== metricKey)
            }
            if (prev.length >= 4) {
                return [...prev.slice(1), metricKey] // Replaces oldest if maxed
            }
            return [...prev, metricKey]
        })
    }
    const router = useRouter() // Hook for navigation
    const searchParams = useSearchParams()

    // Anchor Date derivation
    const anchorDate = useMemo(() => dateRange?.to || new Date(), [dateRange])

    // Formatting range string for API
    const dateRangeStr = useMemo(() => {
        const fromParam = searchParams?.get('from')
        const toParam = searchParams?.get('to')
        if (fromParam && toParam) {
            return { from: fromParam, to: toParam }
        }
        // Fallback default
        const today = new Date()
        return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
    }, [searchParams])

    // Fetch Data
    const fetchData = async () => {
        setLoading(true)
        try {
            // 1. Fetch Global Health (If Overview)
            if (currentView === 'overview') {
                const healthRes = await getGlobalMonitoringAction(dateRangeStr)
                setGlobalHealth(healthRes)
            }

            // 2. Fetch Deep Dive (If Deep Dive & Account Selected)
            if (currentView === 'deep_dive' && accountId) {
                const adsRes = await getAdMonitoringData(accountId, dateRangeStr.from, dateRangeStr.to)
                if (adsRes && adsRes.data) setRawData(adsRes.data)
            }

        } catch (e) {
            console.error("Analysis Error", e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [accountId, dateRangeStr.from, dateRangeStr.to, currentView])

    // --- LOGIC: OVERVIEW (Global Health) ---
    const sortedAccounts = useMemo(() => {
        return [...globalHealth]
            .filter(acc => !acc.name.toLowerCase().includes("conta demo")) // REMOVE DEMO
            .sort((a, b) => {
                // Sort Priority: 
                // 1. Critical Issues (No Balance, Disabled)
                // 2. Performance (CPA/ROAS) - Low ROAS is worse
                // Let's create a score (Lower score = Higher Priority in Ascending Sort)
                // BUT we want Worst First. 

                const getScore = (acc: any) => {
                    let score = 0 // Base Score (Good)

                    // Critical = High Positive Score
                    if (acc.account_status !== 1) score += 1000 // Disabled
                    if (acc.disable_reason) score += 1000
                    if (acc.is_prepay_account && acc.balance < 100) score += 500 // Low Prepay Balance
                    if (acc.total_issues > 0) score += 100 * acc.total_issues

                    // Performance Warning
                    if (acc.spend > 100 && acc.conversations === 0) score += 200

                    return score
                }
                return getScore(b) - getScore(a) // Descending (Highest Critical Score first)
            })
    }, [globalHealth])

    // Handler for Card Click
    const handleAccountClick = (id: string) => {
        const params = new URLSearchParams(searchParams?.toString())
        params.set('view', 'deep_dive')
        params.set('account', id)
        router.push(`?${params.toString()}`)
    }

    // --- LOGIC: DEEP DIVE ---
    const deepDiveRows = useMemo(() => {
        if (!rawData || rawData.length === 0) return []

        // Group by Ad
        const adMap = new Map<string, any>()
        rawData.forEach(item => {
            if (!adMap.has(item.ad_id)) {
                adMap.set(item.ad_id, {
                    id: item.ad_id,
                    name: item.ad_name,
                    image: item.image_url,
                    permalink: item.permalink,
                    status: item.status,
                    quality: item.quality,
                    dailyData: []
                })
            }
            adMap.get(item.ad_id).dailyData.push(item)
        })

        // Periods logic: 
        // P0 (Hoje realativo à seleção): O último dia (dateRangeStr.to)
        // P1 (Passado): Todos os dias anteriores a P0 dentro do período retornado
        const p0Date = parseDateSafe(dateRangeStr.to)
        const p0Start = startOfDay(p0Date)
        const p0End = endOfDay(p0Date)

        // --- Comparative Analysis Base (Average across account today) ---
        const allAdMetrics = Array.from(adMap.values()).map(ad => {
            const p0Data = ad.dailyData.filter((d: any) => parseDateSafe(d.date) >= p0Start && parseDateSafe(d.date) <= p0End)
            return p0Data.reduce((acc: any, row: any) => ({
                spend: acc.spend + parseFloat(row.metrics.spend || '0'),
                clicks: acc.clicks + parseFloat(row.metrics.clicks || '0'),
                conversations: acc.conversations + parseFloat(row.metrics.conversations || '0'),
            }), { spend: 0, clicks: 0, conversations: 0 })
        }).filter(m => m.spend > 0)

        const totalAccountSpend = allAdMetrics.reduce((sum, m) => sum + m.spend, 0)
        const totalAccountClicks = allAdMetrics.reduce((sum, m) => sum + m.clicks, 0)
        const totalAccountConversations = allAdMetrics.reduce((sum, m) => sum + m.conversations, 0)

        const avgAccountCpc = safeDiv(totalAccountSpend, totalAccountClicks)
        const avgAccountCpa = safeDiv(totalAccountSpend, totalAccountConversations)
        // -----------------------------------------------------------------

        return Array.from(adMap.values()).map(ad => {
            // Split P0 (Current Selected End Date) and P1 (Past Days in range)
            const p0Data = ad.dailyData.filter((d: any) => parseDateSafe(d.date) >= p0Start && parseDateSafe(d.date) <= p0End)
            const p1Data = ad.dailyData.filter((d: any) => parseDateSafe(d.date) < p0Start)

            const extractMetrics = (data: any[]) => data.reduce((acc: any, row: any) => ({
                spend: acc.spend + parseFloat(row.metrics.spend || '0'),
                impressions: acc.impressions + parseFloat(row.metrics.impressions || '0'),
                clicks: acc.clicks + parseFloat(row.metrics.clicks || '0'),
                inline_link_clicks: acc.inline_link_clicks + parseFloat(row.metrics.inline_link_clicks || row.metrics.clicks || '0'),
                reach: acc.reach + parseFloat(row.metrics.reach || row.metrics.impressions || '0'),
                conversations: acc.conversations + parseFloat(row.metrics.conversations || '0'),
                video_3s: acc.video_3s + parseFloat(row.metrics.video_3s || '0'),
                video_thruplay: acc.video_thruplay + parseFloat(row.metrics.video_thruplay || '0'),
            }), { spend: 0, impressions: 0, clicks: 0, inline_link_clicks: 0, reach: 0, conversations: 0, video_3s: 0, video_thruplay: 0 })

            const m0 = extractMetrics(p0Data)
            const m1 = extractMetrics(p1Data)

            // Calculated Metrics P0 (Today)
            const ctr = safeDiv(m0.inline_link_clicks, m0.impressions) * 100
            const cpc = safeDiv(m0.spend, m0.inline_link_clicks)
            const cpa = safeDiv(m0.spend, m0.conversations)
            const frequency = safeDiv(m0.impressions, m0.reach)
            const hookRate = safeDiv(m0.video_3s, m0.impressions) * 100
            const holdRate = safeDiv(m0.video_thruplay, m0.video_3s) * 100

            // Calculated Metrics P1 (Past)
            const m1_ctr = safeDiv(m1.inline_link_clicks, m1.impressions) * 100
            const m1_cpc = safeDiv(m1.spend, m1.inline_link_clicks)
            const m1_cpa = safeDiv(m1.spend, m1.conversations)

            // Trends vs P1 (Ratio of difference. Ex: 0.20 = 20% higher today)
            const trendCpc = m1_cpc > 0 ? (cpc - m1_cpc) / m1_cpc : 0
            const trendCpa = m1_cpa > 0 ? (cpa - m1_cpa) / m1_cpa : 0
            const trendCtr = m1_ctr > 0 ? (ctr - m1_ctr) / m1_ctr : 0

            // --- Analysis Engine & Methodical Diagnosis ---
            let status: AnalysisStatus = 'neutral'
            const flags: string[] = []
            let verdict = "OK"
            let verdictColor = "text-slate-500"

            if (m0.impressions > 50) {
                if (frequency > 2) flags.push("Fadiga")
                if (hookRate > 0 && hookRate < 20) flags.push("Hook Fraco")
                if (m0.video_3s > 50 && holdRate < 25) flags.push("Hold Baixo")
            }

            // Zombie Check (Spending with no returns)
            if (ad.status === 'ACTIVE' && m0.spend > 30 && m0.conversations === 0) {
                status = 'critical'
                verdict = "Pausar (Zumbi)"
                verdictColor = "text-red-500 font-bold"
            }
            // Scaling Logic (CPA is better than account average AND trend is stable or improving)
            else if (m0.conversations > 0 && cpa < avgAccountCpa && trendCpa <= 0.1) {
                verdict = "Escalar (Ótimo CPA)"
                verdictColor = "text-emerald-500 font-bold"
            }
            // Decaying Logic (CPA trend is worse by >30% vs past)
            else if (m0.conversations > 0 && trendCpa > 0.3) {
                verdict = "Piorando (Observar)"
                verdictColor = "text-amber-500 font-bold"
            }
            // Fatigued logic (Frequency peaking and CTR dropped)
            else if (frequency > 2.5 && trendCtr < -0.2) {
                verdict = "Fadiga Criativa (Trocar)"
                verdictColor = "text-orange-500 font-bold"
            }
            // Stable
            else if (m0.conversations > 0) {
                verdict = "Manter"
                verdictColor = "text-blue-500 font-semibold"
            } else if (m0.spend > 0) {
                verdict = "Aguardando"
            }

            return {
                ...ad,
                currentMetrics: { ...m0, ctr, cpc, cpa, frequency, hookRate, holdRate },
                trends: { cpc: trendCpc, cpa: trendCpa, ctr: trendCtr },
                analysis: { status, flags, verdict, verdictColor }
            }
        }).sort((a, b) => b.currentMetrics.spend - a.currentMetrics.spend)
    }, [rawData, dateRangeStr.to])

    const categorizedAccounts = useMemo(() => {
        return sortedAccounts.map((acc: any) => {
            const hasLowPrepayBalance = acc.is_prepay_account && acc.balance < 100
            const isCritical = acc.disable_reason || hasLowPrepayBalance
            const isWarning = !isCritical && (acc.total_issues > 0 || acc.decaying_campaigns > 0 || (acc.spend > 100 && acc.conversations === 0))

            let convText = acc.conversations === 0 ? "Aguardando conversões..." : `${acc.conversations} conv. hoje.`
            let statusMessage = <span className="text-emerald-600 flex gap-2 items-center"><CheckCircle2 className="h-4 w-4" /> Operação Saudável. {convText}</span>
            let statusColor = "bg-white dark:bg-slate-900 border-l-emerald-500"
            let category = 'healthy'

            if (isCritical) {
                category = 'critical'
                statusColor = "bg-red-50 dark:bg-red-950/20 border-l-red-500"
                if (acc.account_status !== 1) statusMessage = <span className="text-red-600 font-bold flex gap-2"><XCircle className="h-4 w-4" /> Conta Desabilitada ({acc.disable_reason || "Erro"})</span>
                else if (hasLowPrepayBalance) statusMessage = <span className="text-red-600 font-bold flex gap-2"><AlertTriangle className="h-4 w-4" /> Saldo Insuficiente / Baixo</span>
            } else if (isWarning) {
                category = 'warning'
                statusColor = "bg-amber-50 dark:bg-amber-950/20 border-l-amber-500"
                if (acc.spend > 100 && acc.conversations === 0) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> Gasto sem Conversão (R$ {acc.spend.toFixed(2)})</span>
                else if (acc.decaying_campaigns > 0) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><ArrowDown className="h-4 w-4" /> Performance em Queda ({acc.decaying_campaigns} camp.)</span>
                else statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> Requer Atenção ({acc.total_issues} avisos)</span>
            }

            return { ...acc, category, hasLowPrepayBalance, isCritical, isWarning, statusMessage, statusColor }
        })
    }, [sortedAccounts])

    const sortByWorstToBest = (arr: any[]) => {
        return [...arr].sort((a, b) => {
            // Pior primeiro: menor número de conversões no dia
            if (a.conversations !== b.conversations) {
                return a.conversations - b.conversations
            }
            // Desempate (Pior primeiro): Se conversões são iguais, quem gastou mais dinheiro é pior e fica em cima
            return b.spend - a.spend
        })
    }

    const criticalAccounts = useMemo(() => sortByWorstToBest(categorizedAccounts.filter(a => a.category === 'critical')), [categorizedAccounts])
    const warningAccounts = useMemo(() => sortByWorstToBest(categorizedAccounts.filter(a => a.category === 'warning')), [categorizedAccounts])
    const healthyAccounts = useMemo(() => sortByWorstToBest(categorizedAccounts.filter(a => a.category === 'healthy')), [categorizedAccounts])

    const renderTrend = (value: number, isLowerBetter: boolean) => {
        if (!value || Math.abs(value) < 0.01) return <Minus className="h-3 w-3 text-slate-300 inline" />
        const pct = Math.abs(value * 100).toFixed(0) + "%"
        const isUp = value > 0
        const isBad = isLowerBetter ? isUp : !isUp
        const color = isBad ? "text-red-500" : "text-emerald-500"
        const Icon = isUp ? ArrowUp : ArrowDown
        return (
            <span className={`flex items-center text-[10px] font-medium ${color}`}>
                <Icon className="h-3 w-3 mr-0.5" />
                {pct}
            </span>
        )
    }

    const renderAccountCard = (acc: any) => (
        <Card
            key={acc.id}
            onClick={() => handleAccountClick(acc.id)}
            className={cn(
                "border-l-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:translate-x-1",
                acc.statusColor
            )}
        >
            <div className="flex flex-col md:flex-row p-5 gap-6 items-center">
                {/* Account Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-bold text-xl truncate text-slate-800 dark:text-slate-100">{acc.name}</h3>
                        {acc.isCritical && <Badge variant="destructive" className="uppercase text-[10px]">Ação Necessária</Badge>}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-3 max-w-[400px]">
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Campanhas</span>
                            <span className="text-sm font-medium">{acc.active_count} Ativas</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Investimento Hoje</span>
                            <div className="flex items-center gap-1">
                                <Wallet className="h-3 w-3 text-slate-400" />
                                <span className={cn("text-sm font-bold", acc.hasLowPrepayBalance ? "text-red-500" : "text-emerald-600")}>
                                    {acc.is_prepay_account ? 'Saldo: ' : 'Fatura: '}R$ {(Math.abs(acc.balance) / 100).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Box (Right Side) */}
                <div className="flex-[1.5] flex justify-end">
                    <div className={cn("px-4 py-2 rounded-full text-sm border", acc.isCritical ? "bg-red-100 border-red-200" : acc.isWarning ? "bg-amber-100 border-amber-200" : "bg-emerald-100 border-emerald-200")}>
                        {acc.statusMessage}
                    </div>
                </div>
            </div>
        </Card>
    )

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Controls - Info Only for Deep Dive */}
            {currentView === 'deep_dive' && (
                <div className="flex justify-between items-center bg-white dark:bg-slate-950 p-4 border rounded-xl shadow-sm mb-6">
                    <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        Data Base para "Hoje": <span className="font-bold text-slate-900 dark:text-slate-100">{format(parseDateSafe(dateRangeStr.to), "d 'de' MMMM", { locale: ptBR })}</span>
                    </div>
                </div>
            )}

            {/* TAB 1: VISÃO GERAL (ACCOUNTS) */}
            {currentView === 'overview' && (
                <div className="space-y-6">
                    <Accordion type="multiple" defaultValue={['critical', 'warning', 'healthy']} className="w-full space-y-6">

                        {/* 1. GAVETA: AÇÃO NECESSÁRIA */}
                        {criticalAccounts.length > 0 && (
                            <AccordionItem value="critical" className="border-none bg-red-50/30 dark:bg-red-950/10 rounded-xl p-2 px-4 shadow-sm">
                                <AccordionTrigger className="hover:no-underline py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-red-100 dark:bg-red-900 rounded-md">
                                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                                        </div>
                                        <h2 className="text-lg font-bold text-red-700 dark:text-red-400">Ação Necessária ({criticalAccounts.length})</h2>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4 pb-2">
                                    {criticalAccounts.map(renderAccountCard)}
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* 2. GAVETA: REQUER ATENÇÃO */}
                        {warningAccounts.length > 0 && (
                            <AccordionItem value="warning" className="border-none bg-amber-50/30 dark:bg-amber-950/10 rounded-xl p-2 px-4 shadow-sm">
                                <AccordionTrigger className="hover:no-underline py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-amber-100 dark:bg-amber-900 rounded-md">
                                            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <h2 className="text-lg font-bold text-amber-700 dark:text-amber-400">Requer Atenção ({warningAccounts.length})</h2>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4 pb-2">
                                    {warningAccounts.map(renderAccountCard)}
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {/* 3. GAVETA: OPERAÇÃO SAUDÁVEL */}
                        {healthyAccounts.length > 0 && (
                            <AccordionItem value="healthy" className="border-none bg-emerald-50/10 dark:bg-emerald-950/10 rounded-xl p-2 px-4 shadow-sm">
                                <AccordionTrigger className="hover:no-underline py-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-emerald-100 dark:bg-emerald-900 rounded-md">
                                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                        </div>
                                        <h2 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Operação Saudável ({healthyAccounts.length})</h2>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="space-y-4 pt-4 pb-2">
                                    {healthyAccounts.map(renderAccountCard)}
                                </AccordionContent>
                            </AccordionItem>
                        )}

                        {categorizedAccounts.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">Nenhuma conta conectada.</div>
                        )}
                    </Accordion>
                </div>
            )}

            {/* TAB 2: DEEP DIVE */}
            {currentView === 'deep_dive' && (
                <div className="flex flex-col xl:flex-row gap-6 items-start">

                    {/* LEFT COLUMN: Chart (Visible only if an ad is expanded) */}
                    {expandedRow && (
                        <div className="w-full xl:w-2/3 sticky top-4 flex-shrink-0 animate-in slide-in-from-left-4 fade-in duration-300">
                            <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b pb-4">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <BarChart3 className="h-5 w-5 text-indigo-500" />
                                            Desempenho do Anúncio
                                        </CardTitle>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => setExpandedRow(null)}>
                                            <XCircle className="h-5 w-5" />
                                        </Button>
                                    </div>
                                    <CardDescription className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1 line-clamp-1">
                                        {deepDiveRows.find(r => r.id === expandedRow)?.name}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-6">
                                    {(() => {
                                        const selectedAd = deepDiveRows.find(r => r.id === expandedRow)
                                        if (!selectedAd) return null

                                        // Format chart data based on dailyData, backfilling zeros
                                        const adDataMap = new Map()
                                        selectedAd.dailyData.forEach((d: any) => adDataMap.set(d.date, d))

                                        const allDays = eachDayOfInterval({
                                            start: parseDateSafe(dateRangeStr.from),
                                            end: parseDateSafe(dateRangeStr.to)
                                        })

                                        const chartData = allDays.map((d: Date) => {
                                            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                                            const existing = adDataMap.get(dateStr)
                                            if (existing) {
                                                return {
                                                    date: dateStr,
                                                    spend: parseFloat(existing.metrics.spend),
                                                    impressions: parseInt(existing.metrics.impressions),
                                                    reach: parseInt(existing.metrics.reach || '0'),
                                                    conversations: parseInt(existing.metrics.conversations || '0'),
                                                    cpa: safeDiv(parseFloat(existing.metrics.spend), parseFloat(existing.metrics.conversations || '0')),
                                                    cpc: safeDiv(parseFloat(existing.metrics.spend), parseFloat(existing.metrics.clicks || '0')),
                                                    ctr: safeDiv(parseFloat(existing.metrics.clicks), parseFloat(existing.metrics.impressions || '0')) * 100,
                                                    frequency: parseFloat(existing.metrics.frequency || '0'),
                                                    inline_link_clicks: parseInt(existing.metrics.inline_link_clicks || '0'),
                                                    profile_visits: parseInt(existing.metrics.profile_visits || '0'),
                                                }
                                            } else {
                                                return {
                                                    date: dateStr,
                                                    spend: 0, impressions: 0, reach: 0, conversations: 0, cpa: 0,
                                                    cpc: 0, ctr: 0, frequency: 0, inline_link_clicks: 0, profile_visits: 0
                                                }
                                            }
                                        })

                                        return (
                                            <div className="flex flex-col gap-6 w-full">
                                                <div className="w-full">
                                                    <PerformanceChart
                                                        data={chartData}
                                                        metrics={selectedChartMetrics.map(key => ({
                                                            dataKey: key,
                                                            label: CHART_METRICS_CONFIG[key].label,
                                                            color: CHART_METRICS_CONFIG[key].color,
                                                            formatter: CHART_METRICS_CONFIG[key].formatter
                                                        }))}
                                                    />
                                                </div>

                                                {/* Botões do Gráfico Dinâmico */}
                                                <div className="flex flex-wrap justify-center gap-2 w-full pt-4 border-t">
                                                    {Object.entries(CHART_METRICS_CONFIG).map(([key, config]) => {
                                                        const isSelected = selectedChartMetrics.includes(key)
                                                        return (
                                                            <button
                                                                key={key}
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleMetricToggle(key)
                                                                }}
                                                                className={cn(
                                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all shadow-sm outline-none hover:scale-105 active:scale-95",
                                                                    isSelected
                                                                        ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                                                                        : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                                                                )}
                                                                style={isSelected ? { borderColor: config.color } : {}}
                                                            >
                                                                <config.icon className="h-3.5 w-3.5" style={{ color: isSelected ? config.color : undefined }} />
                                                                {config.label}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })()}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* RIGHT COLUMN: Grid of Ad Cards */}
                    <div className={cn("w-full flex flex-col gap-4", expandedRow ? "xl:w-1/3" : "xl:w-full")}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-500 uppercase tracking-wider">
                                <LayoutGrid className="h-4 w-4" />
                                Lista de Anúncios
                            </h3>
                            <span className="text-xs text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                {deepDiveRows.length} ativos
                            </span>
                        </div>

                        <div className={cn(
                            "grid gap-4 transition-all duration-300",
                            expandedRow
                                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-1"
                                : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        )}>
                            {deepDiveRows.map((row) => {
                                const isExpanded = expandedRow === row.id

                                return (
                                    <Card
                                        key={row.id}
                                        className={cn(
                                            "cursor-pointer overflow-hidden transition-all duration-300 border-2 group",
                                            isExpanded
                                                ? "border-blue-500 bg-blue-50/10 dark:bg-blue-900/10 ring-4 ring-blue-500/10 shadow-md transform scale-[1.02]"
                                                : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md"
                                        )}
                                        onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                                    >
                                        <div className="p-4 flex gap-3 h-[90px]">
                                            {/* Image */}
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <div className="h-14 w-14 rounded-md bg-slate-100 dark:bg-slate-800 shrink-0 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative group-hover:shadow-sm transition-shadow cursor-zoom-in" onClick={(e) => e.stopPropagation()}>
                                                        {row.image ? (
                                                            <img src={row.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                                        ) : (
                                                            <div className="flex items-center justify-center w-full h-full text-slate-300"><ImageOff className="h-6 w-6" /></div>
                                                        )}
                                                        {isExpanded && (
                                                            <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center backdrop-blur-[1px] pointer-events-none">
                                                                <BarChart3 className="text-white h-6 w-6 drop-shadow-md" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </DialogTrigger>
                                                <DialogContent showCloseButton={false} className="max-w-[95vw] w-auto h-auto !border-none !bg-transparent !shadow-none p-0 flex flex-col items-center justify-center m-0" aria-describedby={undefined}>
                                                    <DialogTitle className="sr-only">Preview do Anúncio</DialogTitle>
                                                    <AdPreviewLoader accountId={accountId || ""} adId={row.id} fallbackImage={row.image} />
                                                </DialogContent>
                                            </Dialog>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                                <div className="flex justify-between items-start gap-2">
                                                    <h4 className={cn("font-semibold text-xs line-clamp-2 leading-tight", isExpanded ? "text-blue-900 dark:text-blue-100" : "text-slate-700 dark:text-slate-300")} title={row.name}>
                                                        {row.permalink ? (
                                                            <a href={row.permalink} target="_blank" rel="noopener noreferrer" className="hover:underline hover:text-blue-600 flex items-center gap-1 group/link" onClick={(e) => e.stopPropagation()}>
                                                                {row.name}
                                                                <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity text-blue-500 shrink-0" />
                                                            </a>
                                                        ) : (
                                                            row.name
                                                        )}
                                                    </h4>
                                                    <div className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 items-center justify-center flex shadow-sm", row.analysis.verdictColor)}>
                                                        {row.analysis.verdict}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mt-auto">
                                                    {row.analysis.flags.map((f: string) => (
                                                        <Badge key={f} variant="destructive" className="text-[8px] px-1 h-3.5 leading-none uppercase tracking-wider">{f}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className={cn(
                                            "px-4 pb-4 pt-3 border-t grid gap-y-4 gap-x-2 text-[11px]",
                                            isExpanded ? "bg-blue-50/30 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/50" : "bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50",
                                            "grid-cols-3"
                                        )}>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Gasto</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">R$ {row.currentMetrics.spend.toFixed(2)}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-emerald-500 uppercase font-semibold tracking-wider">CPA</span>
                                                <span className="font-bold text-[13px] text-emerald-600 dark:text-emerald-400 leading-none mt-0.5">R$ {row.currentMetrics.cpa.toFixed(2)}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Freq</span>
                                                <span className="font-bold text-slate-700 dark:text-slate-300">{row.currentMetrics.frequency.toFixed(2)}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">CTR</span>
                                                <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    {row.currentMetrics.ctr.toFixed(2)}% <span className="scale-75 origin-left">{renderTrend(row.trends.ctr, false)}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">CPC</span>
                                                <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
                                                    R$ {row.currentMetrics.cpc.toFixed(2)} <span className="scale-75 origin-left">{renderTrend(row.trends.cpc, true)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
