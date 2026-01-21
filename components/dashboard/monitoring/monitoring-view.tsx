'use client'

import { useState, useEffect, useMemo } from "react"
import { Filter, Layers, Zap, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, XCircle, Play, Eye, Info, Wallet } from "lucide-react"
import { format, subDays, differenceInDays, parseISO, startOfDay, endOfDay } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAdMonitoringData, getGlobalMonitoringAction } from "@/app/(dashboard)/actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter, useSearchParams } from "next/navigation" // Added for navigation
import { cn } from "@/lib/utils" // Added for conditional classes

interface MonitoringViewProps {
    accountId?: string
    dateRange?: { from: Date, to: Date }
    currentView?: string
}

type AnalysisStatus = 'good' | 'neutral' | 'bad' | 'critical'

// Helper: safe division
const safeDiv = (n: number, d: number) => d > 0 ? n / d : 0

export function MonitoringView({ accountId, dateRange, currentView = 'overview' }: MonitoringViewProps) {
    const [historyCount, setHistoryCount] = useState("5")
    const [loading, setLoading] = useState(false)
    const [rawData, setRawData] = useState<any[]>([])
    const [globalHealth, setGlobalHealth] = useState<any[]>([])
    const router = useRouter() // Hook for navigation
    const searchParams = useSearchParams()

    // Anchor Date derivation
    const anchorDate = useMemo(() => dateRange?.to || new Date(), [dateRange])

    // Formatting range string for API
    const dateRangeStr = useMemo(() => {
        if (!dateRange) {
            const today = new Date()
            return { from: format(subDays(today, 30), 'yyyy-MM-dd'), to: format(today, 'yyyy-MM-dd') }
        }
        return { from: format(dateRange.from, 'yyyy-MM-dd'), to: format(dateRange.to, 'yyyy-MM-dd') }
    }, [dateRange])

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
                const anchorStr = format(anchorDate, 'yyyy-MM-dd')
                const adsRes = await getAdMonitoringData(accountId, anchorStr, "daily", parseInt(historyCount))
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
    }, [accountId, dateRangeStr.from, dateRangeStr.to, historyCount, currentView])

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
                    if (acc.no_balance_count > 0 || acc.balance < 100) score += 500 // Low Balance
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
        const count = parseInt(historyCount)

        // Group by Ad
        const adMap = new Map<string, any>()
        rawData.forEach(item => {
            if (!adMap.has(item.ad_id)) {
                adMap.set(item.ad_id, {
                    id: item.ad_id,
                    name: item.ad_name,
                    image: item.image_url,
                    status: item.status,
                    quality: item.quality, // New field from service
                    dailyData: []
                })
            }
            adMap.get(item.ad_id).dailyData.push(item)
        })

        // Periods logic
        const periods: any[] = []
        for (let i = 0; i < count; i++) {
            const d = subDays(anchorDate, i)
            periods.push({
                label: i === 0 ? 'Hoje' : format(d, 'dd/MM'),
                start: startOfDay(d),
                end: endOfDay(d)
            })
        }

        return Array.from(adMap.values()).map(ad => {
            // Aggregate Period 0 (Current) for Analysis
            const p0Data = ad.dailyData.filter((d: any) => parseISO(d.date) >= periods[0].start && parseISO(d.date) <= periods[0].end)

            // Metrics Aggregation (Current Period P0)
            const metrics = p0Data.reduce((acc: any, row: any) => ({
                spend: acc.spend + row.metrics.spend,
                impressions: acc.impressions + row.metrics.impressions,
                clicks: acc.clicks + row.metrics.clicks,
                conversations: acc.conversations + row.metrics.conversations,
                video_3s: acc.video_3s + (row.metrics.video_3s || 0),
                video_thruplay: acc.video_thruplay + (row.metrics.video_thruplay || 0),
            }), { spend: 0, impressions: 0, clicks: 0, conversations: 0, video_3s: 0, video_thruplay: 0 })

            // Calculated Metrics
            const ctr = safeDiv(metrics.clicks, metrics.impressions) * 100
            const cpc = safeDiv(metrics.spend, metrics.clicks)
            // Hook Rate: 3s Plays / Impressions
            const hookRate = safeDiv(metrics.video_3s, metrics.impressions) * 100
            // Hold Rate: ThruPlay / 3s Plays
            const holdRate = safeDiv(metrics.video_thruplay, metrics.video_3s) * 100
            const cpa = safeDiv(metrics.spend, metrics.conversations)

            // --- Analysis Engine ---
            let status: AnalysisStatus = 'neutral'
            const flags: string[] = []
            const diagnosis: string[] = []
            const recommendation: string[] = []

            // 1. Hook Analysis
            if (metrics.impressions > 100) { // Threshold
                if (hookRate < 20) {
                    diagnosis.push("Hook Fraco")
                    recommendation.push("Trocar thumbnail/3s iniciais")
                    status = 'bad'
                }
            }

            // 2. Hold Analysis
            if (metrics.video_3s > 50) {
                if (holdRate < 25) {
                    diagnosis.push("Retenção Baixa")
                    recommendation.push("Melhorar pacing do vídeo")
                }
            }

            // 3. Zombie Check
            if (ad.status === 'ACTIVE' && metrics.spend > 30 && metrics.conversations === 0) {
                flags.push("Zumbi")
                status = 'critical'
                recommendation.push("Pausar (Gasto s/ retorno)")
            }

            return {
                ...ad,
                currentMetrics: { ...metrics, ctr, cpc, cpa, hookRate, holdRate },
                analysis: { status, flags, diagnosis, recommendation }
            }
        }).sort((a, b) => b.currentMetrics.spend - a.currentMetrics.spend)
    }, [rawData, historyCount, anchorDate])


    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Controls - Info Only for Deep Dive */}
            {currentView === 'deep_dive' && (
                <div className="flex justify-between items-center bg-muted/20 p-2 rounded-lg">
                    <div className="text-sm text-muted-foreground">
                        Data Base: <span className="font-medium text-foreground">{format(anchorDate, "dd 'de' MMMM", { locale: ptBR })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Colunas Histórico:</span>
                        <Select value={historyCount} onValueChange={setHistoryCount}>
                            <SelectTrigger className="w-[70px] h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3">3d</SelectItem>
                                <SelectItem value="5">5d</SelectItem>
                                <SelectItem value="7">7d</SelectItem>
                            </SelectContent>
                        </Select>
                        {/* Update button removed as requested */}
                    </div>
                </div>
            )}

            {/* TAB 1: VISÃO GERAL (ACCOUNTS) */}
            {currentView === 'overview' && (
                <div className="space-y-6">
                    <div className="space-y-4">
                        {sortedAccounts.map((acc: any) => {
                            const isCritical = acc.no_balance_count > 0 || acc.disable_reason || acc.balance < 100
                            const isWarning = !isCritical && (acc.total_issues > 0 || (acc.spend > 100 && acc.conversations === 0))

                            // Explicit Status Logic
                            let statusMessage = <span className="text-emerald-600 flex gap-2 items-center"><CheckCircle2 className="h-4 w-4" /> Operação Saudável. {acc.conversations} conv. hoje.</span>
                            let statusColor = "bg-white dark:bg-slate-900 border-l-emerald-500"

                            if (isCritical) {
                                statusColor = "bg-red-50 dark:bg-red-950/20 border-l-red-500"
                                if (acc.account_status !== 1) statusMessage = <span className="text-red-600 font-bold flex gap-2"><XCircle className="h-4 w-4" /> Conta Desabilitada ({acc.disable_reason || "Erro"})</span>
                                else if (acc.no_balance_count > 0 || acc.balance < 100) statusMessage = <span className="text-red-600 font-bold flex gap-2"><AlertTriangle className="h-4 w-4" /> Saldo Insuficiente / Baixo</span>
                            } else if (isWarning) {
                                statusColor = "bg-amber-50 dark:bg-amber-950/20 border-l-amber-500"
                                if (acc.spend > 100 && acc.conversations === 0) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> Gasto sem Conversão (R$ {acc.spend.toFixed(2)})</span>
                                else if (acc.total_issues > 0) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> {acc.total_issues} Problemas de Entrega</span>
                            }

                            return (
                                <Card
                                    key={acc.id}
                                    onClick={() => handleAccountClick(acc.id)}
                                    className={cn(
                                        "border-l-4 transition-all duration-200 cursor-pointer hover:shadow-md hover:translate-x-1",
                                        statusColor
                                    )}
                                >
                                    <div className="flex flex-col md:flex-row p-5 gap-6 items-center">
                                        {/* Account Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3">
                                                <h3 className="font-bold text-xl truncate text-slate-800 dark:text-slate-100">{acc.name}</h3>
                                                {isCritical && <Badge variant="destructive" className="uppercase text-[10px]">Ação Necessária</Badge>}
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
                                                        <span className={cn("text-sm font-bold", acc.balance < 100 ? "text-red-500" : "text-emerald-600")}>
                                                            Saldo: R$ {(acc.balance / 100).toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Status Box (Right Side) */}
                                        <div className="flex-[1.5] flex justify-end">
                                            <div className={cn("px-4 py-2 rounded-full text-sm border", isCritical ? "bg-red-100 border-red-200" : isWarning ? "bg-amber-100 border-amber-200" : "bg-emerald-100 border-emerald-200")}>
                                                {statusMessage}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            )
                        })}
                        {sortedAccounts.length === 0 && (
                            <div className="text-center py-10 text-muted-foreground">Nenhuma conta conectada.</div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 2: DEEP DIVE */}
            {currentView === 'deep_dive' && (
                <div className="space-y-4">
                    {/* Reuse Table Code */}
                    <Card className="border-none shadow-none bg-transparent">
                        <div className="rounded-md border bg-white dark:bg-slate-950 overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50 dark:bg-slate-900/50 hover:bg-transparent">
                                        <TableHead className="w-[300px] min-w-[300px] sticky left-0 bg-slate-50 dark:bg-slate-900 z-20">Anúncio</TableHead>
                                        <TableHead className="text-center">Hook Rate</TableHead>
                                        <TableHead className="text-center">Hold Rate</TableHead>
                                        <TableHead className="text-center">CTR / CPC</TableHead>
                                        <TableHead className="text-center text-emerald-600 border-l border-emerald-100">CPA (Hoje)</TableHead>
                                        <TableHead className="w-[200px]">Diagnóstico</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {deepDiveRows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="sticky left-0 bg-white dark:bg-slate-950 z-20 font-medium border-r p-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded bg-slate-100 overflow-hidden">
                                                        {row.image && <img src={row.image} className="h-full w-full object-cover" />}
                                                    </div>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="truncate text-xs font-semibold max-w-[180px]" title={row.name}>{row.name}</span>
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {row.analysis.flags.map((f: string) => (
                                                                <Badge key={f} variant="destructive" className="text-[8px] h-3 px-1">{f}</Badge>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono text-xs font-bold ${row.currentMetrics.hookRate < 20 ? 'text-red-500' : ''}`}>
                                                        {row.currentMetrics.hookRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col">
                                                    <span className={`font-mono text-xs font-bold ${row.currentMetrics.holdRate < 25 ? 'text-amber-500' : ''}`}>
                                                        {row.currentMetrics.holdRate.toFixed(1)}%
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center text-xs">
                                                <div>{row.currentMetrics.ctr.toFixed(2)}%</div>
                                                <div className="text-muted-foreground">R$ {row.currentMetrics.cpc.toFixed(2)}</div>
                                            </TableCell>
                                            <TableCell className="text-center border-l bg-emerald-50/30">
                                                <div className="font-bold text-emerald-700">R$ {row.currentMetrics.cpa.toFixed(2)}</div>
                                                <div className="text-[10px] text-emerald-600">{row.currentMetrics.conversations} conv.</div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600">
                                                {row.analysis.recommendation[0] || "OK"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    )
}
