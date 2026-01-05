'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

import { Eye, Users, UserPlus, Calendar, CheckCircle2, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"

interface FunnelSectionProps {
    steps: any[]
    selectedMetrics?: string[]
    onMetricClick?: (key: string) => void
}

export function FunnelSection({ steps, selectedMetrics = [], onMetricClick }: FunnelSectionProps) {

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
                    const currentVal = Number(step.value)
                    const nextVal = nextStep ? Number(nextStep.value) : 0
                    const rate = nextStep ? getConversionRate(nextVal, currentVal) : null

                    // Width logic: Inline styles to ensure funnel shape works regardless of Tailwind JIT
                    const widthPct = Math.max(100 - (index * 8), 60) // Simple auto-funnel width: 100, 92 ... 60

                    const isSelected = step.metricKey ? selectedMetrics.includes(step.metricKey) : false

                    // Fallback helpers
                    const Icon = step.icon || Eye
                    // If formatter is present use it, else raw value
                    const displayVal = step.formatter ? step.formatter(step.value) : step.value.toLocaleString('pt-BR')

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
                                    // Override ring color if custom activeColor exists (mapped from config.color)
                                    ...(isSelected && step.color ? { '--tw-ring-color': step.color } as any : {})
                                }}
                            >
                                {/* Icon - Anchored Left (z-10 to stay on top) */}
                                <div className="relative z-10 shrink-0 p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                                    <Icon className="h-5 w-5 text-white" />
                                </div>

                                {/* Content - Absolute Centered (z-0) */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-10">
                                    <span className="font-medium tracking-wide opacity-90 leading-tight mb-0.5 whitespace-nowrap" style={{ fontSize: 'container-label' }}>
                                        {/* Fluid typography using clamp (min, val, max) logic via min(viewport_rel, pixel_limit) */}
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

                            {/* Visual Connector Arrow (Centered in Spacer) */}
                            {index < steps.length - 1 && (
                                <div className="w-full flex items-center justify-center relative z-20 py-3">
                                    <div
                                        className="flex items-center justify-center gap-1.5"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-slate-300 dark:text-slate-600">
                                            <path d="M12 6L12 18M12 18L16 14M12 18L8 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <span className="text-xs font-semibold text-slate-300 dark:text-slate-600">
                                            {rate}%
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
