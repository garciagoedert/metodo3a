"use client"

import { Target, Trophy } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

interface GoalProgressBarProps {
    metricLabel: string
    current: number // Total accumulated
    periodCurrent?: number // Value in selected period
    target: number
    periodLabel: string
    completedAt?: string | null
}

export function GoalProgressBar({ metricLabel, current, periodCurrent = 0, target, periodLabel, completedAt }: GoalProgressBarProps) {
    const safeCurrent = current || 0
    const safePeriod = periodCurrent || 0
    const safeTarget = target || 1

    const percentage = Math.min(100, Math.max(0, (safeCurrent / safeTarget) * 100))
    const periodPercentage = Math.min(100, Math.max(0, (safePeriod / safeTarget) * 100))

    return (
        <div className="bg-white dark:bg-slate-950 border rounded-xl p-4 shadow-sm mb-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/50 rounded-lg text-blue-600 dark:text-blue-400">
                        <Target className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                            Meta: {metricLabel}
                        </h3>
                        <p className="text-xs text-muted-foreground">{periodLabel}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-right">
                    {percentage >= 100 && (
                        <Trophy className="h-5 w-5 text-yellow-500 animate-pulse" />
                    )}
                    <div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">
                            {safeCurrent.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-sm text-muted-foreground mx-1">/</span>
                        <span className="text-sm text-muted-foreground">
                            {safeTarget.toLocaleString('pt-BR')}
                        </span>
                    </div>
                </div>
            </div>

            <div className="relative pt-1">
                <div className="relative h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    {/* Total Progress (Lighter - History) */}
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-300 dark:bg-blue-900 transition-all opacity-70"
                        style={{ width: `${percentage}%` }}
                    />
                    {/* Period Progress (Darker - Current Selection) */}
                    <div
                        className="absolute top-0 left-0 h-full bg-blue-600 transition-all"
                        style={{ width: `${periodPercentage}%` }}
                    />
                </div>

                <div className="flex justify-between mt-1 items-start">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground font-medium">{percentage.toFixed(1)}% Concluído (Geral)</span>
                        {safePeriod > 0 && (
                            <span className="text-[10px] text-blue-600 font-semibold">
                                +{safePeriod.toLocaleString('pt-BR')} neste período
                            </span>
                        )}
                    </div>
                    {percentage >= 100 && (
                        <span className="text-xs text-green-600 font-bold self-center flex items-center gap-1">
                            {completedAt
                                ? `Meta batida em ${format(parseISO(completedAt), 'MMM', { locale: ptBR })}! 🚀`
                                : "Meta Atingida! 🚀"
                            }
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
