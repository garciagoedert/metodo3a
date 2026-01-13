'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { Eye, Users, UserPlus, Calendar, CheckCircle2, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface FunnelSectionProps {
    steps: any[]
    selectedMetrics?: string[]
    onMetricClick?: (key: string) => void
    data?: any
}

export function FunnelSection({ steps, selectedMetrics = [], onMetricClick, data: funnelData }: FunnelSectionProps) {

    // Calculate Conversion Rates between steps
    const getConversionRate = (current: number, previous: number) => {
        if (previous === 0) return 0;
        return ((current / previous) * 100).toFixed(1)
    }

    return (
        <Card className="w-full h-full border-none shadow-none bg-transparent flex flex-col">

            <CardContent className="px-0 flex-1 flex flex-col items-center justify-start pt-0 pb-6">
                {steps.map((step, index) => {
                    const nextStep = index < steps.length - 1 ? steps[index + 1] : null
                    const currentVal = (step.value === null || step.value === undefined) ? null : Number(step.value)
                    const nextVal = (nextStep && nextStep.value !== null && nextStep.value !== undefined) ? Number(nextStep.value) : null

                    const rate = (nextStep && currentVal !== null && currentVal !== 0 && nextVal !== null) ? getConversionRate(nextVal, currentVal) : null

                    // Width logic: Inline styles to ensure funnel shape works regardless of Tailwind JIT
                    const widthPct = Math.max(100 - (index * 8), 60)

                    const isSelected = step.metricKey ? selectedMetrics.includes(step.metricKey) : false

                    // Fallback helpers
                    const Icon = step.icon || Eye
                    // Display Value Logic: Handle NULL as '?'
                    let displayVal = '?'
                    if (step.value !== null && step.value !== undefined) {
                        displayVal = step.formatter ? step.formatter(step.value) : step.value.toLocaleString('pt-BR')
                    } else {
                        // Keep '?' for null
                        displayVal = '?'
                    }
                    // Special case: If value is 0, do we show 0? Yes. Only null is ?.

                    return (
                        <div key={step.label || step.metricKey || index} className="w-full flex flex-col items-center relative">
                            <div
                                onClick={() => step.metricKey && onMetricClick && onMetricClick(step.metricKey)}
                                className={cn(
                                    "relative flex items-center px-4 rounded-xl shadow-lg transition-all text-white bg-gradient-to-r",
                                    step.gradient || "from-slate-500 to-slate-600",
                                    step.metricKey && onMetricClick ? "cursor-pointer hover:brightness-110 active:scale-[0.98]" : "",
                                    isSelected ? "ring-4 ring-offset-2 ring-offset-white ring-blue-500/50" : ""
                                )}
                                style={{
                                    minHeight: '90px',
                                    width: `${widthPct}%`,
                                    // Override ring color if custom activeColor exists 
                                    ...(isSelected && step.color ? { '--tw-ring-color': step.color } as any : {})
                                }}
                            >
                                {/* Icon - Anchored Left */}
                                <div className="relative z-10 shrink-0 p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <Icon className="h-5 w-5 text-white" />
                                </div>

                                {/* Content - Absolute Centered */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-16">
                                    <span className="font-medium tracking-wide opacity-90 leading-tight mb-0.5 whitespace-normal break-words w-full" style={{ fontSize: 'container-label' }}>
                                        <span className="text-[min(3.5vw,13px)] sm:text-[min(2vw,14px)]">
                                            {step.label}
                                        </span>
                                    </span>
                                    <div className="font-bold tracking-tighter leading-none">
                                        <span className="text-[min(8vw,20px)] sm:text-[min(5vw,28px)]">
                                            {displayVal}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Visual Connector Arrow */}
                            {index < steps.length - 1 && (
                                <div className="w-full flex flex-col items-center justify-center relative z-20 py-2">
                                    <div
                                        className="flex items-center justify-center gap-1.5"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-slate-300 dark:text-slate-600">
                                            <path d="M12 6L12 18M12 18L16 14M12 18L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">
                                            {rate ? `${rate}%` : '-'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
