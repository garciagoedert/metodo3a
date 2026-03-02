'use client'

import { useState, useEffect, useMemo, Fragment } from "react"
import { Filter, Layers, Zap, ArrowUp, ArrowDown, AlertTriangle, CheckCircle2, XCircle, Play, Eye, Info, Wallet, Minus, MousePointer2, DollarSign, Tag, TrendingUp, Users, MessageSquare, Clock, UserPlus, Calendar, BarChart3, LayoutGrid, ImageOff, ExternalLink, Activity } from "lucide-react"
import { format, subDays, differenceInDays, parseISO, startOfDay, endOfDay, eachDayOfInterval } from "date-fns"
import { ptBR } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { getAdMonitoringData, getGlobalMonitoringAction, getAdPreviewAction, saveIdealMetrics } from "@/app/(dashboard)/actions"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { PerformanceChart } from "@/components/dashboard/charts"
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogHeader } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
    const [analysisMode, setAnalysisMode] = useState<'today' | 'period'>('today')
    const [selectedChartMetrics, setSelectedChartMetrics] = useState<string[]>(['cpa', 'cpc', 'ctr'])
    const [lifetimeData, setLifetimeData] = useState<Record<string, { spend: number, conversations: number }>>({})
    const [adsStatus, setAdsStatus] = useState<Record<string, string>>({})

    // Ideal Metrics State
    const [idealMetrics, setIdealMetrics] = useState<Record<string, number>>({})
    const [isIdealModalOpen, setIsIdealModalOpen] = useState(false)
    const [draftIdeal, setDraftIdeal] = useState<Record<string, string>>({})
    const [savingIdeal, setSavingIdeal] = useState(false)
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
                if (adsRes && adsRes.data) {
                    setRawData(adsRes.data)
                    setLifetimeData(adsRes.lifetimeData || {})
                    setAdsStatus(adsRes.adsStatus || {})
                    const idMetrics: any = adsRes.idealMetrics || {}
                    setIdealMetrics(idMetrics)

                    const draft: Record<string, string> = {}
                    Object.keys(idMetrics).forEach(k => {
                        if (idMetrics[k] !== undefined && idMetrics[k] !== null) {
                            draft[k] = String(idMetrics[k])
                        }
                    })
                    setDraftIdeal(draft)
                }
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

    const handleSaveIdeal = async () => {
        if (!accountId) return
        setSavingIdeal(true)
        const metricsToSave: Record<string, number> = {}

        Object.keys(draftIdeal).forEach(k => {
            if (draftIdeal[k] !== "" && !isNaN(parseFloat(draftIdeal[k]))) {
                metricsToSave[k] = parseFloat(draftIdeal[k])
            }
        })

        const res = await saveIdealMetrics(accountId, metricsToSave)
        setSavingIdeal(false)
        if (res.success) {
            setIdealMetrics(metricsToSave)
            setIsIdealModalOpen(false)
        } else {
            alert(res.error || "Erro ao salvar")
        }
    }

    // --- LOGIC: OVERVIEW & DEEP DIVE ---
    // Handler for Card Click
    const handleAccountClick = (id: string) => {
        const params = new URLSearchParams(searchParams?.toString())
        params.set('view', 'deep_dive')
        params.set('account', id)
        router.push(`?${params.toString()}`)
    }

    // Determine the most recent date with actual data (P0) to prevent 0-value cards at midnight
    const baseDateForToday = useMemo(() => {
        if (!rawData || rawData.length === 0) return parseDateSafe(dateRangeStr.to)
        const maxDateStr = rawData.reduce((max, item) => item.date > max ? item.date : max, rawData[0].date)
        return parseDateSafe(maxDateStr)
    }, [rawData, dateRangeStr.to])

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
        // P0 (Hoje relativo à seleção): O último dia COM DADOS no período
        // P1 (Passado): Todos os dias anteriores a P0 dentro do período retornado
        const p0Date = baseDateForToday
        const p0Start = startOfDay(p0Date)
        const p0End = endOfDay(p0Date)

        // --- Comparative Analysis Base (Average across account for the FULL PERIOD) ---
        const allAdMetricsFull = Array.from(adMap.values()).map(ad => {
            const fullPeriodData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) <= p0End)
            return fullPeriodData.reduce((acc: any, row: any) => ({
                spend: acc.spend + parseFloat(row.metrics.spend || '0'),
                clicks: acc.clicks + parseFloat(row.metrics.clicks || '0'),
                impressions: acc.impressions + parseFloat(row.metrics.impressions || '0'),
                conversations: acc.conversations + parseFloat(row.metrics.conversations || '0'),
            }), { spend: 0, clicks: 0, impressions: 0, conversations: 0 })
        }).filter(m => m.spend > 0)

        const totalAccountSpend = allAdMetricsFull.reduce((sum, m) => sum + m.spend, 0)
        const totalAccountClicks = allAdMetricsFull.reduce((sum, m) => sum + m.clicks, 0)
        const totalAccountConversations = allAdMetricsFull.reduce((sum, m) => sum + m.conversations, 0)

        const avgAccountCpc = safeDiv(totalAccountSpend, totalAccountClicks)
        const avgAccountCpa = safeDiv(totalAccountSpend, totalAccountConversations)
        const avgAccountCtr = safeDiv(totalAccountClicks, allAdMetricsFull.reduce((sum, m) => sum + (m.impressions || 100), 0)) * 100

        // Use dynamic account average for relative context
        const spendThreshold = avgAccountCpa > 0 ? avgAccountCpa * 1.5 : 30
        // -----------------------------------------------------------------

        return Array.from(adMap.values()).map(ad => {
            // Split Data into Display (Dynamic based on analysisMode) and Diagnostic (Always full/recent)
            let displayData: any[] = []
            if (analysisMode === 'today') {
                displayData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) >= p0Start && parseDateSafe(d.date) <= p0End)
            } else {
                displayData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) <= p0End)
            }

            const fullData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) <= p0End)
            const todayData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) >= p0Start && parseDateSafe(d.date) <= p0End)
            const pastData = ad.dailyData.filter((d: any) => parseDateSafe(d.date) < p0Start)

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

            const mDisplay = extractMetrics(displayData)
            const mFull = extractMetrics(fullData)
            const mToday = extractMetrics(todayData)
            const mPast = extractMetrics(pastData)

            // 1. Calculated Metrics (For the UI Display Grid)
            const ctr = safeDiv(mDisplay.inline_link_clicks, mDisplay.impressions) * 100
            const cpc = safeDiv(mDisplay.spend, mDisplay.inline_link_clicks)
            const cpa = safeDiv(mDisplay.spend, mDisplay.conversations)
            const frequency = safeDiv(mDisplay.impressions, mDisplay.reach)
            const hookRate = safeDiv(mDisplay.video_3s, mDisplay.impressions) * 100
            const holdRate = safeDiv(mDisplay.video_thruplay, mDisplay.video_3s) * 100

            // For the trend text in the UI Grid
            let trendCpc = 0; let trendCpa = 0; let trendCtr = 0;
            if (analysisMode === 'today') {
                const past_ctr = safeDiv(mPast.inline_link_clicks, mPast.impressions) * 100
                const past_cpc = safeDiv(mPast.spend, mPast.inline_link_clicks)
                const past_cpa = safeDiv(mPast.spend, mPast.conversations)
                trendCpc = past_cpc > 0 ? (cpc - past_cpc) / past_cpc : 0
                trendCpa = past_cpa > 0 ? (cpa - past_cpa) / past_cpa : 0
                trendCtr = past_ctr > 0 ? (ctr - past_ctr) / past_ctr : 0
            }

            // 2. Engine Diagnostics Metrics (Always computed off standard blocks, unaffected by 'Apenas Hoje/Periodo Todo' display toggle)
            const eng_ctr = safeDiv(mFull.inline_link_clicks, mFull.impressions) * 100
            const eng_cpc = safeDiv(mFull.spend, mFull.inline_link_clicks)
            const eng_cpa = safeDiv(mFull.spend, mFull.conversations)
            const eng_frequency = safeDiv(mFull.impressions, mFull.reach)
            const eng_hookRate = safeDiv(mFull.video_3s, mFull.impressions) * 100
            const eng_holdRate = safeDiv(mFull.video_thruplay, mFull.video_3s) * 100

            // Engine Trends (Is today getting worse than the past?)
            const today_cpa = safeDiv(mToday.spend, mToday.conversations)
            const past_cpa = safeDiv(mPast.spend, mPast.conversations)
            const eng_trendCpa = past_cpa > 0 ? (today_cpa - past_cpa) / past_cpa : 0

            // --- Analysis Engine & Methodical Diagnosis (8 Rules) ---
            let status: AnalysisStatus = 'neutral'
            const flags: string[] = []
            let verdict = "OK"
            let verdictColor = "text-slate-500"
            let detailedTip = ""

            // Lifetime context
            const lifetimeSpend = lifetimeData[ad.id]?.spend || mFull.spend
            const lifetimeConversations = lifetimeData[ad.id]?.conversations || mFull.conversations

            // Base formatters for text
            const fmtMoney = (v: number) => `R$ ${v.toFixed(2)}`

            const isActuallyActive = adsStatus[ad.id] === 'ACTIVE'
            const activeStatusLabel = adsStatus[ad.id]

            // 0. Pausado / Inativo
            if (activeStatusLabel && !isActuallyActive) {
                status = 'neutral'
                verdict = "Pausado / Inativo"
                verdictColor = "text-slate-500"
                detailedTip = `Este anúncio está atualmente com o status '${activeStatusLabel}' no Gerenciador de Anúncios. As métricas refletem apenas o período em que esteve ativo.`
            }
            // 1. Zumbi / Desperdício Crítico (Verifies Lifetime too, avoids killing old good campaigns having a short bad week)
            else if (mFull.conversations === 0 && mFull.spend > spendThreshold && lifetimeConversations === 0) {
                status = 'critical'
                verdict = "Pausar (Zumbi)"
                verdictColor = "text-red-500"
                detailedTip = `Anúncio nunca gerou resultados na sua história e já gastou histórico de ${fmtMoney(lifetimeSpend)} (muito acima do custo médio normal da conta: ${fmtMoney(avgAccountCpa || 30)}). Pausar para evitar desperdício relacional.`
            }
            // 2. Alta Frequência, mas muito Eficiente
            else if (mFull.conversations > 0 && eng_frequency > 3.0 && eng_cpa < (avgAccountCpa * 0.9)) {
                verdict = "Saturado porém Barato"
                verdictColor = "text-emerald-600"
                detailedTip = `No geral, a frequência está muito alta (público repetido), o que normalmente seria ruim. Mas o anúncio ainda gera conversões baratas historicamente (${fmtMoney(eng_cpa)} vs média local de ${fmtMoney(avgAccountCpa)}). Mantenha rodando, mas deixe um reserva pronto.`
            }
            // 3. Fadiga Criativa Clássica
            else if (mFull.conversations > 0 && eng_frequency >= 2.5 && eng_cpa > (avgAccountCpa * 1.2)) {
                verdict = "Fadiga Criativa (Trocar)"
                verdictColor = "text-orange-500"
                detailedTip = `No total do período, o público já viu este anúncio muitas vezes (Freq: ${eng_frequency.toFixed(1)}) e o custo disparou acima da média local da conta (${fmtMoney(eng_cpa)} vs ${fmtMoney(avgAccountCpa)}). Recomendado subir novos criativos.`
            }
            // 4. Oportunidade Escale - O Campeão
            else if (mFull.conversations > 0 && eng_cpa <= (avgAccountCpa * 0.8) && eng_frequency < 2.5) {
                verdict = "Oportunidade de Escala"
                verdictColor = "text-emerald-500 font-bold"
                detailedTip = `Excelente desempenho contínuo! Entregando conversões custando bem mais barato que a média geral desta conta (${fmtMoney(eng_cpa)} vs ${fmtMoney(avgAccountCpa)}). Considere testar aumentar o orçamento levemente aqui.`
            }
            // 5. Problema de Retenção de Vídeo (Hook / Hold)
            else if (mFull.video_3s > 0 && eng_cpa > avgAccountCpa && (eng_hookRate < 20 || eng_holdRate < 20)) {
                verdict = "Problema no Vídeo"
                verdictColor = "text-amber-500"
                if (eng_hookRate < 20) {
                    detailedTip = `Analisando os resultados gerais, o custo (CPA) está pior que a média da conta e a retenção inicial falhou (Hook ${eng_hookRate.toFixed(1)}%). Melhore o gancho visual e o título nos primeiros 3 segundos para prender a atenção.`
                } else {
                    detailedTip = `Analisando os resultados gerais, o custo (CPA) está ruim e as pessoas abandonam o vídeo no meio do caminho (Hold < 20%). A proposta de valor na mensagem central precisa ser mais direta.`
                }
            }
            // 6. Desempenho Piorando Temporalmente (Only when comparative past exists)
            else if (past_cpa > 0 && eng_trendCpa > 0.3) {
                verdict = "Aviso de Piora Atual"
                verdictColor = "text-amber-600"
                detailedTip = `Atenção: o custo por resultado subiu drasticamente ultimamente (+${(eng_trendCpa * 100).toFixed(0)}%) em relação ao histórico base do anúncio. Monitore de perto, pode estar entrando em fadiga.`
            }
            // 7. Desempenho Saudável Padrão
            else if (mFull.conversations > 0) {
                verdict = "Desempenho Normal"
                verdictColor = "text-blue-500"
                detailedTip = `No geral, as conversões estão acontecendo dentro da janela de custo padrão aceitável desta conta (${fmtMoney(eng_cpa)}). Nenhuma ação radical necessária, continue o monitoramento.`
            }
            // 8. Campanhas Maduras sem retorno neste período específico
            else if (lifetimeSpend > spendThreshold) {
                verdict = "Zerado no Período"
                verdictColor = "text-amber-500"
                detailedTip = `Este anúncio já possui investimento acumulado (${fmtMoney(lifetimeSpend)}), mas não gerou conversões nas datas filtradas acima. Verifique se vale a pena mantê-lo ativo ou se a oferta saturou.`
            }
            // 9. Aguardando Inteligência (Recém criado)
            else {
                verdict = "Em Aprendizado"
                verdictColor = "text-slate-500"
                detailedTip = `Anúncio rodando há pouco tempo ou com gasto histórico baixo (${fmtMoney(lifetimeSpend)}). O algoritmo ainda precisa de mais tempo e visualizações para realizar uma análise precisa.`
            }

            // Also keep simple visual flags if needed broadly, though detailedTip replaces most needs
            if (mFull.impressions > 50) {
                if (eng_frequency > 2.5) flags.push("Frequência")
                if (eng_hookRate > 0 && eng_hookRate < 20) flags.push("Hook Fraco")
            }

            // --- Cérebro 2: Diagnóstico Absoluto de Metas (Checklist) ---
            const absoluteChecks: any[] = []

            // For targets, we compare against the Currently Viewed date range (mDisplay), because goals are context-sensitive
            if (idealMetrics.cpa !== undefined) absoluteChecks.push({ label: 'CPA', value: cpa, meta: idealMetrics.cpa, passed: cpa <= idealMetrics.cpa, format: 'money' })
            if (idealMetrics.cpc !== undefined) absoluteChecks.push({ label: 'CPC', value: cpc, meta: idealMetrics.cpc, passed: cpc <= idealMetrics.cpc, format: 'money' })
            if (idealMetrics.ctr !== undefined) absoluteChecks.push({ label: 'CTR', value: ctr, meta: idealMetrics.ctr, passed: ctr >= idealMetrics.ctr, format: 'percent' })
            if (idealMetrics.frequency !== undefined) absoluteChecks.push({ label: 'Frequência', value: frequency, meta: idealMetrics.frequency, passed: frequency <= idealMetrics.frequency, format: 'number' })
            if (idealMetrics.conversations !== undefined) absoluteChecks.push({ label: 'Conversas', value: mDisplay.conversations, meta: idealMetrics.conversations, passed: mDisplay.conversations >= idealMetrics.conversations, format: 'number' })
            if (idealMetrics.reach !== undefined) absoluteChecks.push({ label: 'Alcance', value: mDisplay.reach, meta: idealMetrics.reach, passed: mDisplay.reach >= idealMetrics.reach, format: 'number' })
            if (idealMetrics.impressions !== undefined) absoluteChecks.push({ label: 'Impressões', value: mDisplay.impressions, meta: idealMetrics.impressions, passed: mDisplay.impressions >= idealMetrics.impressions, format: 'number' })
            if (idealMetrics.inline_link_clicks !== undefined) absoluteChecks.push({ label: 'Cliques (Link)', value: mDisplay.inline_link_clicks, meta: idealMetrics.inline_link_clicks, passed: mDisplay.inline_link_clicks >= idealMetrics.inline_link_clicks, format: 'number' })
            if (idealMetrics.clicks !== undefined) absoluteChecks.push({ label: 'Cliques Tot.', value: mDisplay.clicks, meta: idealMetrics.clicks, passed: mDisplay.clicks >= idealMetrics.clicks, format: 'number' })
            if (idealMetrics.profile_visits !== undefined) absoluteChecks.push({ label: 'Visitas Perfil', value: mDisplay.profile_visits || 0, meta: idealMetrics.profile_visits, passed: (mDisplay.profile_visits || 0) >= idealMetrics.profile_visits, format: 'number' })

            return {
                ...ad,
                // mDisplay properties used strictly for the numeric grids:
                currentMetrics: { ...mDisplay, ctr, cpc, cpa, frequency, hookRate, holdRate },
                trends: { cpc: trendCpc, cpa: trendCpa, ctr: trendCtr },
                analysis: { status, flags, verdict, verdictColor, detailedTip, absoluteChecks }
            }
        })
            .filter(a => a.currentMetrics.spend > 0 || a.currentMetrics.impressions > 0)
            .sort((a, b) => b.currentMetrics.spend - a.currentMetrics.spend)
    }, [rawData, lifetimeData, baseDateForToday, analysisMode, idealMetrics])

    const categorizedAccounts = useMemo(() => {
        return globalHealth
            .filter(acc => !acc.name.toLowerCase().includes("conta demo")) // REMOVE DEMO
            .map((acc: any) => {
                const hasLowPrepayBalance = acc.is_prepay_account && acc.balance < 100
                const idealCpa = acc.idealMetrics?.cpa || null
                const cpa = acc.conversations > 0 ? (acc.spend / acc.conversations) : 0

                // 1. Crítico (Erro Operacional)
                // account_status is usually 1=ACTIVE. Others: 2=DISABLED, 3=UNSETTLED, 7=PENDING_RISK_REVIEW, 8=PENDING_SETTLEMENT, 9=IN_GRACE_PERIOD, 100=PENDING_CLOSURE, 101=CLOSED, 201=ANY_ACTIVE, 202=ANY_CLOSED
                const isCriticalError = (acc.account_status && acc.account_status !== 1) || hasLowPrepayBalance

                // 2. Crítico (Desperdício)
                const targetWasteLimit = idealCpa ? idealCpa * 2 : 100
                const isCriticalWaste = !isCriticalError && acc.conversations === 0 && acc.spend > targetWasteLimit

                // 3. Baixa Performance (CPA Alto)
                const isWarningPerformance = !isCriticalError && !isCriticalWaste && acc.conversations > 0 && idealCpa && cpa > idealCpa

                // 4. Atenção (Quedas ou Inatividade)
                const hasZeroActiveCampaigns = acc.active_count === 0
                const isAttention = !isCriticalError && !isCriticalWaste && !isWarningPerformance && (acc.total_issues > 0 || acc.decaying_campaigns > 0 || hasZeroActiveCampaigns)

                let category = 'healthy'
                let statusMessage = <span className="text-emerald-600 flex gap-2 items-center"><CheckCircle2 className="h-4 w-4" /> Operação Saudável. {acc.conversations} conv no período.</span>
                let statusColor = "bg-white dark:bg-slate-900 border-l-emerald-500"

                if (isCriticalError) {
                    category = 'critical'
                    statusColor = "bg-red-50 dark:bg-red-950/20 border-l-red-500"
                    if (acc.account_status && acc.account_status !== 1) statusMessage = <span className="text-red-600 font-bold flex gap-2"><XCircle className="h-4 w-4" /> Conta Desabilitada ({acc.disable_reason || "Erro"})</span>
                    else statusMessage = <span className="text-red-600 font-bold flex gap-2"><AlertTriangle className="h-4 w-4" /> Saldo Insuficiente / Baixo</span>
                } else if (isCriticalWaste) {
                    category = 'critical'
                    statusColor = "bg-rose-50 dark:bg-rose-950/20 border-l-rose-500"
                    statusMessage = <span className="text-rose-600 font-bold flex gap-2"><XCircle className="h-4 w-4" /> Desperdício Extremo (R$ {acc.spend.toFixed(2)} gastos s/ conv)</span>
                } else if (isWarningPerformance) {
                    category = 'warning'
                    statusColor = "bg-orange-50 dark:bg-orange-950/20 border-l-orange-500"
                    statusMessage = <span className="text-orange-600 font-semibold flex gap-2"><ArrowDown className="h-4 w-4" /> CPA Alto (R$ {cpa.toFixed(2)} vs Alvo R$ {Number(idealCpa).toFixed(2)})</span>
                } else if (isAttention) {
                    category = 'warning'
                    statusColor = "bg-amber-50 dark:bg-amber-950/20 border-l-amber-500"
                    if (hasZeroActiveCampaigns) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> Nenhuma Campanha Ativa Hoje</span>
                    else if (acc.decaying_campaigns > 0) statusMessage = <span className="text-amber-600 font-medium flex gap-2"><ArrowDown className="h-4 w-4" /> Campanhas em Queda ({acc.decaying_campaigns} camp.)</span>
                    else statusMessage = <span className="text-amber-600 font-medium flex gap-2"><AlertTriangle className="h-4 w-4" /> Requer Atenção ({acc.total_issues} avisos)</span>
                } else if (acc.conversations === 0) {
                    statusMessage = <span className="text-emerald-600 flex gap-2 items-center"><CheckCircle2 className="h-4 w-4" /> Operação Saudável. Aguardando conversões.</span>
                }

                const isCritical = isCriticalError || isCriticalWaste
                const isWarning = isWarningPerformance || isAttention

                return { ...acc, category, hasLowPrepayBalance, isCritical, isWarning, statusMessage, statusColor }
            })
    }, [globalHealth])

    const sortByWorstToBest = (arr: any[]) => {
        return [...arr].sort((a, b) => {
            const aError = (a.account_status && a.account_status !== 1) || (a.is_prepay_account && a.balance < 100) ? 1 : 0
            const bError = (b.account_status && b.account_status !== 1) || (b.is_prepay_account && b.balance < 100) ? 1 : 0
            if (aError !== bError) return bError - aError

            if (a.conversations !== b.conversations) {
                return a.conversations - b.conversations
            }
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
                                <span className={cn("text-sm font-bold", acc.hasLowPrepayBalance || (acc.balance === 0 && acc.account_status !== 1) ? "text-red-500" : "text-emerald-600")}>
                                    {acc.is_prepay_account ? 'Saldo: ' : 'Fatura: '}R$ {(!isNaN(acc.balance) && acc.balance !== null ? Math.abs(acc.balance) / 100 : 0).toFixed(2)}
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
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-slate-950 p-4 border rounded-xl shadow-sm mb-6 gap-4">
                    <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
                        Data Base para "Hoje": <span className="font-bold text-slate-900 dark:text-slate-100">{format(baseDateForToday, "d 'de' MMMM", { locale: ptBR })}</span>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                        <Dialog open={isIdealModalOpen} onOpenChange={setIsIdealModalOpen}>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 text-xs mr-2 border-slate-300">
                                    <Tag className="w-3 h-3 mr-1" />
                                    Métricas Ideais
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[550px]">
                                <DialogHeader>
                                    <DialogTitle>Definir Metas Absolutas (Alvos)</DialogTitle>
                                    <DialogDescription>
                                        Digite os valores que representam sucesso para esta conta. A inteligência artificial usará esses tetos para gerar um diagnóstico rígido em cada anúncio.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-2 gap-x-6 gap-y-4 py-4 max-h-[60vh] overflow-y-auto px-2 mt-2">
                                    {[
                                        { id: 'cpa', label: 'CPA Alvo (Por Conversa)' },
                                        { id: 'cpc', label: 'CPC Alvo (Por Clique)' },
                                        { id: 'ctr', label: 'CTR Mínimo (%)' },
                                        { id: 'frequency', label: 'Frequência Máxima' },
                                        { id: 'conversations', label: 'Mínimo de Conversas' },
                                        { id: 'profile_visits', label: 'Visitas ao Perfil' },
                                        { id: 'reach', label: 'Alcance Mínimo' },
                                        { id: 'impressions', label: 'Impressões' },
                                        { id: 'inline_link_clicks', label: 'Cliques no Link' },
                                        { id: 'clicks', label: 'Cliques Totais' },
                                    ].map((f) => (
                                        <div key={f.id} className="flex flex-col gap-2">
                                            <Label htmlFor={`ideal-${f.id}`} className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                                {f.label}
                                            </Label>
                                            <Input
                                                id={`ideal-${f.id}`}
                                                placeholder="Auto (Não Avaliar)"
                                                className="h-9 text-sm"
                                                value={draftIdeal[f.id] || ""}
                                                onChange={(e) => setDraftIdeal({ ...draftIdeal, [f.id]: e.target.value.replace(',', '.') })}
                                                type="number"
                                                step="0.01"
                                            />
                                        </div>
                                    ))}
                                </div>
                                <DialogFooter className="mt-4">
                                    <Button disabled={savingIdeal} onClick={handleSaveIdeal} className="w-full sm:w-auto">
                                        {savingIdeal ? 'Salvando...' : 'Salvar Ideais'}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <button
                            onClick={() => setAnalysisMode('today')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                analysisMode === 'today' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700"
                            )}>
                            Apenas Hoje
                        </button>
                        <button
                            onClick={() => setAnalysisMode('period')}
                            className={cn(
                                "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                analysisMode === 'period' ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-100" : "text-slate-500 hover:text-slate-700"
                            )}>
                            Período Selecionado
                        </button>
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

                                                {/* NOVO: Cérebro 2 - Metas Absolutas (Checklist) abaixo do Gráfico */}
                                                {selectedAd.analysis.absoluteChecks && selectedAd.analysis.absoluteChecks.length > 0 && (
                                                    <div className="pt-6 px-6 pb-6 mt-2 border-t bg-slate-50/50 dark:bg-slate-900/50 rounded-b-xl">
                                                        <h5 className="text-xs uppercase font-extrabold tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                                                            <CheckCircle2 className="w-4 h-4 text-slate-400" /> Diagnóstico de Metas Absolutas (Raio-X)
                                                        </h5>
                                                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                                                            {selectedAd.analysis.absoluteChecks.map((check: any, i: number) => (
                                                                <div key={i} className={cn(
                                                                    "flex flex-col p-3 rounded-lg border",
                                                                    check.passed ? "bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30" : "bg-red-50/30 border-red-100 dark:bg-red-950/20 dark:border-red-900/30"
                                                                )}>
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        {check.passed ? (
                                                                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                                                        ) : (
                                                                            <XCircle className="w-4 h-4 text-red-500" />
                                                                        )}
                                                                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                                                            {check.label}
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex flex-col justify-end mt-1">
                                                                        <div className="flex items-end justify-between w-full">
                                                                            <span className={cn("font-bold text-lg leading-none", check.passed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                                                                                {check.format === 'money' ? `R$ ${check.value.toFixed(2)}` : check.format === 'percent' ? `${check.value.toFixed(2)}%` : check.value.toFixed(2)}
                                                                            </span>
                                                                            <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                                                Alvo: {check.format === 'money' ? `R$ ${check.meta.toFixed(2)}` : check.format === 'percent' ? `${check.meta.toFixed(2)}%` : check.meta.toFixed(2)}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
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
                                {deepDiveRows.length} anúncios
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

                                        {/* NOVO: Detailed Analysis Text Block */}
                                        {row.analysis.detailedTip && (
                                            <div className={cn(
                                                "px-4 py-3 border-t text-xs leading-relaxed font-medium flex gap-2 items-start",
                                                isExpanded ? "bg-white dark:bg-slate-950" : "bg-slate-100/50 dark:bg-slate-900",
                                                row.analysis.verdictColor
                                            )}>
                                                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                                <span>{row.analysis.detailedTip}</span>
                                            </div>
                                        )}

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
