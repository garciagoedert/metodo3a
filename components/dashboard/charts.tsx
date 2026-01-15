"use client"

import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, CartesianGrid, ReferenceLine } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useState, useEffect } from "react"
import { Slider } from "@/components/ui/slider"

interface ChartMetricConfig {
    dataKey: string
    color: string
    label: string
    formatter?: (value: number) => string
}

interface PerformanceChartProps {
    data: any[]
    metrics: ChartMetricConfig[]
}

export function PerformanceChart({
    data,
    metrics = []
}: PerformanceChartProps) {
    if (metrics.length === 0) return null

    // Sort data
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))

    // State for Mobile Slider
    const [selectedIndex, setSelectedIndex] = useState<number>(sortedData.length - 1)

    // Update selected index when data length changes (e.g. month change)
    useEffect(() => {
        setSelectedIndex(sortedData.length - 1)
    }, [data.length])

    // Dual Axis Logic: Determine which metrics go to which axis
    // Heuristic: If label contains "%" or "CTR" or "Frequência", use Right Axis.
    const isRightAxis = (metric: ChartMetricConfig) => metric.label.includes("CTR") || metric.label.includes("Frequência")

    const hasRightAxisMetrics = metrics.some(isRightAxis)
    const hasLeftAxisMetrics = metrics.some(m => !isRightAxis(m))

    const selectedData = sortedData[selectedIndex]

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex flex-wrap items-center gap-2">
                    Tendência:
                    {metrics.map(m => (
                        <span key={m.dataKey} className="text-sm px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800" style={{ color: m.color }}>
                            {m.label}
                        </span>
                    ))}
                </CardTitle>
            </CardHeader>
            <CardContent className="pl-0 pb-2">
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={sortedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                {metrics.map(m => (
                                    <linearGradient key={m.dataKey} id={`color-${m.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={m.color} stopOpacity={0.8} />
                                        <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                                    </linearGradient>
                                ))}
                            </defs>
                            <XAxis
                                dataKey="date"
                                stroke="#888888"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                                tickFormatter={(val) => {
                                    try {
                                        return format(parseISO(val), "dd/MM")
                                    } catch (e) {
                                        return val
                                    }
                                }}
                            />

                            {/* Left Axis - Default */}
                            <YAxis
                                yAxisId="left"
                                stroke="#888888"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => {
                                    // Find a metric on the left axis to use its formatter
                                    const metric = metrics.find(m => !isRightAxis(m))
                                    const safeVal = (val === undefined || val === null) ? 0 : val
                                    return metric?.formatter ? metric.formatter(safeVal) : (safeVal >= 1000 ? `${safeVal / 1000}k` : safeVal)
                                }}
                                width={60}
                            />

                            {/* Right Axis - Only if needed */}
                            {hasRightAxisMetrics && (
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#888888"
                                    fontSize={11}
                                    tickLine={false}
                                    axisLine={false}
                                    tickFormatter={(val) => {
                                        const metric = metrics.find(isRightAxis)
                                        const safeVal = (val === undefined || val === null) ? 0 : val
                                        return metric?.formatter ? metric.formatter(safeVal) : `${safeVal}`
                                    }}
                                    width={40}
                                />
                            )}

                            {/* Mobile Reference Line (Guide) */}
                            <ReferenceLine x={selectedData?.date} stroke="#94a3b8" strokeDasharray="3 3" className="md:hidden" />

                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                labelStyle={{ color: '#666' }}
                                labelFormatter={(label) => {
                                    try {
                                        return format(parseISO(label), "dd/MM/yyyy")
                                    } catch (e) {
                                        return label
                                    }
                                }}
                                formatter={(value: any, name: any) => {
                                    // Find metric config by label (name)
                                    const metric = metrics.find(m => m.label === name)
                                    const safeVal = (value === undefined || value === null) ? 0 : value
                                    const formatted = metric?.formatter ? metric.formatter(safeVal) : safeVal
                                    return [formatted, name]
                                }}
                            />

                            {metrics.map((m) => {
                                const axisId = isRightAxis(m) ? "right" : "left"
                                return (
                                    <Area
                                        key={m.dataKey}
                                        yAxisId={axisId}
                                        type="monotone"
                                        dataKey={m.dataKey}
                                        name={m.label}
                                        stroke={m.color}
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill={`url(#color-${m.dataKey})`}
                                        animationDuration={500}
                                    />
                                )
                            })}
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* Mobile Slider Controls */}
                <div className="px-5 mt-4 md:hidden space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block flex justify-between">
                            <span>Selecionar Dia</span>
                            <span className="text-slate-900 dark:text-slate-100">
                                {selectedData ? format(parseISO(selectedData.date), "dd/MM", { locale: ptBR }) : ""}
                            </span>
                        </label>
                        <Slider
                            value={[selectedIndex]}
                            max={Math.max(0, sortedData.length - 1)}
                            step={1}
                            onValueChange={(val) => setSelectedIndex(val[0])}
                            className="w-full cursor-pointer"
                        />
                    </div>

                    {/* Selected Info Box */}
                    {selectedData && (
                        <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border space-y-3">
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-200 border-b pb-2">
                                {format(parseISO(selectedData.date), "d 'de' MMMM", { locale: ptBR })}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {metrics.map(m => (
                                    <div key={m.dataKey} className="flex flex-col">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{m.label}</span>
                                        <span className="text-base font-semibold" style={{ color: m.color }}>
                                            {(() => {
                                                const val = selectedData[m.dataKey]
                                                if (val === undefined || val === null) return '-'
                                                return m.formatter ? m.formatter(val) : val
                                            })()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

interface PlatformChartProps {
    data: any[]
}

export function PlatformChart({ data }: PlatformChartProps) {
    if (!data || data.length === 0) return null

    // Sort data for better bar visualization
    const sortedData = [...data].sort((a, b) => b.percentage - a.percentage)

    return (
        <Card>
            <CardHeader>
                <CardTitle>Distribuição por Plataforma (%)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={sortedData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis
                                type="category"
                                dataKey="platform"
                                width={100}
                                tickFormatter={(val) => val.replace('_', ' ')}
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                cursor={{ fill: 'transparent' }}
                                formatter={(value: number | undefined) => [`${(value || 0).toFixed(1)}%`, 'Share']}
                            />
                            <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={32}>
                                {sortedData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
