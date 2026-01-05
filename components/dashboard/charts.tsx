"use client"

import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell, CartesianGrid } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, parseISO } from "date-fns"

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

    // Dual Axis Logic: Determine which metrics go to which axis
    // Heuristic: If label contains "%" or "CTR" or "Frequência", use Right Axis.
    const isRightAxis = (metric: ChartMetricConfig) => metric.label.includes("CTR") || metric.label.includes("Frequência")

    const hasRightAxisMetrics = metrics.some(isRightAxis)
    const hasLeftAxisMetrics = metrics.some(m => !isRightAxis(m))

    // Ensure data is sorted by date ascending (Oldest -> Newest) using standard string comparison for ISO dates
    const sortedData = [...data].sort((a, b) => a.date.localeCompare(b.date))

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
                                    return metric?.formatter ? metric.formatter(val) : (val >= 1000 ? `${val / 1000}k` : val)
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
                                        return metric?.formatter ? metric.formatter(val) : `${val}`
                                    }}
                                    width={40}
                                />
                            )}

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
                                    const formatted = metric?.formatter ? metric.formatter(value) : value
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
