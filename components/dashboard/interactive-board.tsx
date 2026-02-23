'use client'

import { useState, useRef, useEffect } from "react"
import { MetricCard } from "./metric-card"
import { PerformanceChart } from "./charts"
import { AdCreativeGallery } from "./ad-creative-gallery"
import { FunnelSection } from "./funnel-section"
import { FunnelMetricsDialog } from "./funnel-metrics-dialog"
import { GoalProgressBar } from "./goal-progress-bar"
import { getAccountGoals, getGoalsProgress } from "@/app/(dashboard)/actions"
import { startOfMonth, endOfMonth, parseISO, isSameMonth } from "date-fns"
import { MousePointer2, DollarSign, Tag, TrendingUp, Users, MessageSquare, Clock, Eye, UserPlus, UserCheck, Calendar, CheckCircle2, Check, ChevronLeft, ChevronRight } from "lucide-react"

interface DashboardInteractiveBoardProps {
    insights: any
    daily: any[]
    distribution: any[]
    topCreatives: any[]
    manualMetrics: any
    funnelData: any
    accountId?: string
    monthStart: string
    dateRange?: { from: Date, to: Date } // Added prop
    dashboardConfig?: any
    readOnly?: boolean
}

// Configuration for each metric type (color, label, format)
export const METRIC_CONFIG: Record<string, { label: string, color: string, gradient?: string, icon?: any, prefix: string, formatter?: (v: number) => string }> = {
    impressions: {
        label: "Impressões",
        color: "#3b82f6",
        gradient: "from-blue-500 to-blue-600",
        icon: Eye,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    reach: {
        label: "Alcance",
        color: "#6366f1",
        gradient: "from-indigo-500 to-indigo-600",
        icon: Users,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    profile_visits: {
        label: "Visitas ao Perfil",
        color: "#a855f7",
        gradient: "from-purple-500 to-purple-600",
        icon: UserPlus,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    followers: {
        label: "Novos Seguidores",
        color: "#ec4899",
        gradient: "from-pink-500 to-pink-600",
        icon: UserCheck,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    scheduled: {
        label: "Consultas Agendadas",
        color: "#f97316",
        gradient: "from-orange-500 to-orange-600",
        icon: Calendar,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    showed: {
        label: "Compareceram",
        color: "#10b981",
        gradient: "from-emerald-500 to-emerald-600",
        icon: CheckCircle2,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    inline_link_clicks: {
        label: "Cliques no Link",
        color: "#8b5cf6",
        icon: MousePointer2,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    conversations: {
        label: "Conversas",
        color: "#f97316",
        gradient: "from-orange-500 to-orange-600", // Optional gradient if used in funnel
        icon: MessageSquare,
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    },
    ctr: {
        label: "CTR (Taxa de Clique)",
        color: "#f59e0b",
        icon: TrendingUp,
        prefix: "",
        formatter: (v) => `${v.toFixed(2)}%`
    },
    frequency: {
        label: "Frequência",
        color: "#14b8a6",
        icon: Clock,
        prefix: "",
        formatter: (v) => v.toFixed(2)
    },
    spend: {
        label: "Valor Usado",
        color: "#10b981",
        icon: DollarSign,
        prefix: "R$",
        formatter: (v) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    },
    cpc: {
        label: "CPC",
        color: "#ec4899",
        icon: Tag,
        prefix: "R$",
        formatter: (v) => `R$ ${v.toFixed(2)}`
    },
    results: {
        label: "Resultados (Conversas)",
        color: "#ef4444",
        prefix: "",
        formatter: (v) => v.toLocaleString('pt-BR')
    }
}

export function DashboardInteractiveBoard({ insights, daily, distribution, topCreatives, manualMetrics, funnelData, accountId, monthStart, dateRange, dashboardConfig, readOnly = false }: DashboardInteractiveBoardProps) {
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["spend"])
    const [goals, setGoals] = useState<any[]>([])
    const selectedDate = parseISO(monthStart)

    useEffect(() => {
        if (accountId) {
            getGoalsProgress(accountId).then(data => setGoals(data || []))
        }
    }, [accountId])

    const conversasValue = insights?.actions
        ? insights.actions
            .filter((a: any) => a.action_type.startsWith('onsite_conversion.messaging_conversation_started'))
            .reduce((a: any, b: any) => a + parseInt(b.value), 0)
        : 0

    const handleMetricClick = (metricKey: string) => {
        setSelectedMetrics(prev => {
            if (prev.includes(metricKey)) {
                if (prev.length === 1) return prev
                return prev.filter(k => k !== metricKey)
            }
            return [...prev, metricKey]
        })
    }

    // --- Dynamic Funnel Logic ---
    const defaultFunnelSteps = [
        { id: '1', metric: 'impressions' },
        { id: '2', metric: 'reach' },
        { id: '3', metric: 'profile_visits' },
        { id: '4', metric: 'followers' },
        { id: '5', metric: 'scheduled' },
        { id: '6', metric: 'showed' }
    ]

    const funnelStepsConfig = dashboardConfig?.funnel_steps || defaultFunnelSteps

    const getMetricValue = (key: string) => {
        if (key === 'conversations') return conversasValue

        // Explicit mapping for mismatched keys
        if (key === 'followers') return funnelData?.newFollowers ?? null
        if (key === 'profile_visits') return funnelData?.profileViews ?? insights?.profile_visits ?? 0

        if (key === 'scheduled') return manualMetrics?.appointments_scheduled ?? null
        if (key === 'showed') return manualMetrics?.appointments_showed ?? null

        // Fallback checks
        if (funnelData && funnelData[key] !== undefined) return funnelData[key]
        if (insights && insights[key] !== undefined) return insights[key]
        return 0
    }

    // --- Carousel Logic ---
    const perfRef = useRef<HTMLDivElement>(null)
    const finRef = useRef<HTMLDivElement>(null)

    const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
        if (ref.current) {
            const scrollAmount = 300 // Approximately 2 cards width
            ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
        }
    }

    // --- Dynamic Performance Cards Logic ---
    const funnelMetricKeys = funnelStepsConfig.map((s: any) => s.metric)

    let performanceMetrics = ['inline_link_clicks', 'ctr', 'frequency', 'conversations']
    // Remove if in funnel
    performanceMetrics = performanceMetrics.filter(m => !funnelMetricKeys.includes(m))

    // Add Displaced Metrics if space (Followers, Profile Visits)
    if (!funnelMetricKeys.includes('followers')) performanceMetrics.push('followers')
    if (!funnelMetricKeys.includes('profile_visits')) performanceMetrics.push('profile_visits')

    // Limit to 4 for grid
    performanceMetrics = performanceMetrics.slice(0, 4)

    // Chart Metrics map
    const chartMetrics = selectedMetrics.map(key => ({
        dataKey: key,
        ...METRIC_CONFIG[key]
    }))

    // Prepare steps for Funnel Section
    const resolvedFunnelSteps = funnelStepsConfig.map((step: any) => ({
        ...step,
        ...METRIC_CONFIG[step.metric],
        value: getMetricValue(step.metric),
        metricKey: step.metric
    }))

    return (
        <div className="flex flex-col gap-6">
            {goals.filter(goal => {
                // Archive Visibility Logic: Show if met this month
                let showArchived = false
                if (goal.archived && goal.completed_at) {
                    const metDate = parseISO(goal.completed_at)
                    if (isSameMonth(metDate, selectedDate)) showArchived = true
                }

                if (goal.archived && !showArchived) return false
                if (goal.period !== 'monthly') return true

                const goalDate = goal.start_date ? parseISO(goal.start_date) : new Date()
                const goalStart = startOfMonth(goalDate)
                const goalEnd = endOfMonth(goalDate)

                const rangeFrom = dateRange?.from || new Date()
                const rangeTo = dateRange?.to || new Date()

                // Ensure comparison works (dates)
                return (goalStart <= rangeTo) && (goalEnd >= rangeFrom)
            }).map(goal => {
                const goalTotal = goal.current || 0
                const goalPeriod = getMetricValue(goal.metric)
                const goalLabel = METRIC_CONFIG[goal.metric]?.label || goal.metric

                return (
                    <GoalProgressBar
                        key={goal.id || goal.metric}
                        metricLabel={goalLabel}
                        current={goalTotal}
                        periodCurrent={goalPeriod}
                        target={goal.target}
                        periodLabel={goal.period === 'monthly' ? 'Meta Mensal' : 'Meta Geral'}
                        completedAt={goal.completed_at}
                    />
                )
            })}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* LEFT COLUMN: Metrics & Charts (Span 8) */}
                <div className="lg:col-span-8 space-y-6 order-2 lg:order-1">

                    {/* 1. Performance Metrics Row */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-500 uppercase tracking-wider">
                                <MousePointer2 className="h-4 w-4" />
                                Performance de Anúncios
                            </h2>
                            <div className="flex gap-1 md:hidden">
                                <button onClick={() => scroll(perfRef, 'left')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <ChevronLeft className="h-5 w-5 text-slate-500" />
                                </button>
                                <button onClick={() => scroll(perfRef, 'right')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <ChevronRight className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>
                        </div>
                        <div ref={perfRef} className="flex overflow-x-auto pb-2 -mx-6 px-6 snap-x gap-3 md:grid md:grid-cols-4 md:gap-3 md:pb-0 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {performanceMetrics.map(key => {
                                const config = METRIC_CONFIG[key] || { label: key, color: '#000', prefix: '' }
                                const val = getMetricValue(key)
                                const isNull = val === undefined || val === null
                                return (
                                    <MetricCard
                                        key={key}
                                        title={config.label}
                                        value={isNull ? '-' : (config.formatter ? config.formatter(val) : val.toLocaleString('pt-BR'))}
                                        icon={config.icon || MousePointer2}
                                        isActive={selectedMetrics.includes(key)}
                                        activeColor={config.color}
                                        onClick={() => handleMetricClick(key)}
                                        className="py-3 min-w-[150px] snap-center md:min-w-0"
                                    />
                                )
                            })}
                        </div>
                    </div>

                    {/* 2. Financial Metrics Row */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-500 uppercase tracking-wider">
                                <DollarSign className="h-4 w-4" />
                                Investimento & Retorno
                            </h2>
                            <div className="flex gap-1 md:hidden">
                                <button onClick={() => scroll(finRef, 'left')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <ChevronLeft className="h-5 w-5 text-slate-500" />
                                </button>
                                <button onClick={() => scroll(finRef, 'right')} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                                    <ChevronRight className="h-5 w-5 text-slate-500" />
                                </button>
                            </div>
                        </div>
                        <div ref={finRef} className="flex overflow-x-auto pb-2 -mx-6 px-6 snap-x gap-3 md:grid md:grid-cols-4 md:gap-3 md:pb-0 md:mx-0 md:px-0 scrollbar-hide [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <MetricCard
                                title="Valor Usado"
                                value={`R$ ${(insights?.spend || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                icon={DollarSign}
                                isActive={selectedMetrics.includes('spend')}
                                activeColor={METRIC_CONFIG['spend'].color}
                                onClick={() => handleMetricClick('spend')}
                                className="py-3 min-w-[150px] snap-center md:min-w-0"
                            />
                            <MetricCard
                                title="CPC (Custo p/ Clique)"
                                value={`R$ ${(insights?.cpc || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                icon={Tag}
                                isActive={selectedMetrics.includes('cpc')}
                                activeColor={METRIC_CONFIG['cpc'].color}
                                onClick={() => handleMetricClick('cpc')}
                                className="py-3 min-w-[150px] snap-center md:min-w-0"
                            />
                            <MetricCard
                                title="Custo p/ Seguidor"
                                value={`R$ ${(function () {
                                    const followers = getMetricValue('followers');
                                    const spend = insights?.spend || 0;
                                    return followers > 0 ? (spend / followers).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                                })()}`}
                                icon={Users}
                                className="py-3 min-w-[150px] snap-center md:min-w-0"
                            />
                            <MetricCard
                                title="Custo por Conversa"
                                value={`R$ ${(function () {
                                    const spend = insights?.spend || 0;
                                    const convs = conversasValue || 0;
                                    return convs > 0 ? (spend / convs).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
                                })()}`}
                                icon={MessageSquare}
                                className="py-3 min-w-[150px] snap-center md:min-w-0"
                            />
                            {manualMetrics?.appointments_scheduled > 0 && (
                                <MetricCard
                                    title="CPA (Agendamento)"
                                    value={`R$ ${((insights?.spend || 0) / manualMetrics.appointments_scheduled).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    icon={Check}
                                    className="py-3 min-w-[150px] snap-center md:min-w-0"
                                />
                            )}
                        </div>
                    </div>

                    {/* 3. Charts Section */}
                    <div className="grid grid-cols-1 gap-6">
                        <PerformanceChart
                            data={daily}
                            metrics={chartMetrics}
                        />
                    </div>

                    {/* 4. Top Creatives */}
                    <div className="mt-2">
                        <AdCreativeGallery ads={topCreatives} disableLinks={readOnly} />
                    </div>
                </div>

                <div className="lg:col-span-4 order-1 lg:order-2">
                    <div className="sticky top-24 -mt-[10px]">
                        {/* Header: Funnel Title & Edit Button (Absolute Positioned for alignment) */}
                        <div className="relative shrink-0">
                            <h2 className="text-sm font-semibold flex items-center gap-2 mb-3 text-slate-500 uppercase tracking-wider">
                                <Eye className="h-4 w-4" />
                                Funil de Conversão
                            </h2>
                            <div className="absolute right-0 top-[-2px]">
                                {!readOnly && (
                                    <FunnelMetricsDialog
                                        accountId={accountId || ""}
                                        currentMonthStart={monthStart}
                                        currentConfig={funnelStepsConfig}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Funnel Box */}
                        <div className="bg-white dark:bg-slate-950 rounded-xl border shadow-sm p-4 h-auto max-h-none lg:max-h-[calc(100vh-8rem)] overflow-visible lg:overflow-y-auto custom-scrollbar">
                            {resolvedFunnelSteps.length > 0 ? (
                                <FunnelSection
                                    steps={resolvedFunnelSteps}
                                    selectedMetrics={selectedMetrics}
                                    onMetricClick={handleMetricClick}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-40 text-muted-foreground">
                                    Carregando funil...
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
