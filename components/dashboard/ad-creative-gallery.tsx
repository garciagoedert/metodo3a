'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, MousePointer2, ExternalLink, BarChart3, TrendingUp, DollarSign, ImageOff, MessageCircle, Repeat, Coins, Users, LayoutGrid } from 'lucide-react'
import Image from 'next/image'
import { METRIC_CONFIG } from './interactive-board'

interface AdMetrics {
    spend: number
    impressions: number
    reach: number
    clicks: number
    profile_visits: number
    ctr: number
    cpc: number
    frequency: number
    conversations: number
}

interface AdCreative {
    id: string
    name: string
    image_url: string | null // Now nullable
    metrics: AdMetrics
}

interface AdCreativeGalleryProps {
    ads: AdCreative[]
}

type SortMetric = 'results' | 'spend' | 'impressions' | 'clicks' | 'ctr' | 'profile_visits' | 'reach' | 'cpc' | 'frequency' | 'conversations'

export function AdCreativeGallery({ ads }: AdCreativeGalleryProps) {
    const [sortBy, setSortBy] = useState<SortMetric>('spend')

    const sortedAds = [...ads].sort((a, b) => {
        // "Results" logic - if user selects specialized results, we use clicks or profile visits
        // If sorting by Results (generic), use Spend as proxy for importance if conversion data is missing, 
        // OR use link clicks. Let's map 'results' to 'clicks' for now based on user request "clicks no link".

        const metricKey = sortBy === 'results' ? 'clicks' : sortBy
        return (b.metrics[metricKey] || 0) - (a.metrics[metricKey] || 0)
    })

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)
    const formatNumber = (val: number) => new Intl.NumberFormat('pt-BR').format(val || 0)
    const formatPercent = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 2 }).format((val || 0) / 100)

    const SortButton = ({ metric, label, icon: Icon }: { metric: SortMetric, label: string, icon?: any }) => {
        const isActive = sortBy === metric
        // Map 'results' or 'clicks' to config keys if needed, but keys mostly match
        // Note: 'clicks' in gallery maps to 'inline_link_clicks' in config if we want exact color? 
        // METRIC_CONFIG has: spend, impressions, inline_link_clicks, ctr, profile_visits.
        // Gallery uses: spend, impressions, clicks, profile_visits, ctr.
        // We need to map 'clicks' -> 'inline_link_clicks' for color lookup.

        const configKey = metric === 'clicks' ? 'inline_link_clicks' : metric
        const config = METRIC_CONFIG[configKey] || { color: '#888' }

        return (
            <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(metric)}
                className={`text-xs h-8 transition-all ${isActive ? 'text-white border-transparent shadow-md font-medium' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                style={{
                    backgroundColor: isActive ? config.color : undefined,
                    borderColor: isActive ? config.color : undefined
                }}
            >
                {Icon && <Icon className="mr-1.5 h-3.5 w-3.5" />}
                {label}
            </Button>
        )
    }

    if (!ads || ads.length === 0) {
        return (
            <Card className="col-span-full">
                <CardHeader>
                    <CardTitle>Galeria de Criativos</CardTitle>
                </CardHeader>
                <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                    Nenhum anúncio encontrado para o período selecionado.
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider mt-1.5">
                    <LayoutGrid className="h-4 w-4" />
                    Top Anúncios
                </div>

                <div className="flex flex-col items-end gap-2 ml-auto">
                    <div className="flex flex-wrap justify-end gap-2">
                        <SortButton metric="spend" label="Valor Gasto" icon={DollarSign} />
                        <SortButton metric="impressions" label="Impressões" icon={Eye} />
                        <SortButton metric="clicks" label="Cliques no Link" icon={MousePointer2} />
                        <SortButton metric="profile_visits" label="Visitas Perfil" icon={ExternalLink} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <SortButton metric="conversations" label="Conversas" icon={MessageCircle} />
                        <SortButton metric="reach" label="Alcance" icon={Users} />
                        <SortButton metric="frequency" label="Frequência" icon={Repeat} />
                        <SortButton metric="cpc" label="CPC" icon={Coins} />
                        <SortButton metric="ctr" label="CTR" icon={TrendingUp} />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {sortedAds.map((ad, index) => {
                    const activeKey = sortBy === 'results' ? 'clicks' : sortBy
                    const configKey = activeKey === 'clicks' ? 'inline_link_clicks' : activeKey
                    const activeColor = METRIC_CONFIG[configKey]?.color

                    return (
                        <Card
                            key={ad.id}
                            className="p-0 gap-0 overflow-hidden hover:shadow-lg transition-all duration-300 group border flex flex-col"
                        >
                            {/* Image Header - Full Bleed */}
                            <div className="relative aspect-square w-full bg-slate-100 dark:bg-slate-900 border-b overflow-hidden shrink-0">
                                {ad.image_url ? (
                                    <img
                                        src={ad.image_url}
                                        alt={ad.name}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center w-full h-full text-slate-400">
                                        <ImageOff className="h-12 w-12" />
                                    </div>
                                )}
                                <div className="absolute top-0 left-0 z-10">
                                    <Badge
                                        className="text-white font-bold text-base px-3 py-1 shadow-md border-0 rounded-none rounded-br-lg"
                                        style={{ backgroundColor: activeColor }}
                                    >
                                        #{index + 1}
                                    </Badge>
                                </div>
                            </div>

                            {/* Metrics Body */}
                            <CardContent className="p-4 space-y-3 flex-1">
                                <h4 className="font-semibold text-sm line-clamp-1 min-h-[20px] title={ad.name}">
                                    {ad.name}
                                </h4>

                                <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-sm">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                                            Impressões
                                        </span>
                                        <p className="font-bold text-sm" style={{ color: sortBy === 'impressions' ? activeColor : undefined }}>
                                            {formatNumber(ad.metrics.impressions)}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                                            Alcance
                                        </span>
                                        <p className="font-bold text-sm">
                                            {formatNumber(ad.metrics.reach)}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                                            Cliques
                                        </span>
                                        <p className="font-bold text-sm" style={{ color: sortBy === 'clicks' || sortBy === 'results' ? activeColor : undefined }}>
                                            {formatNumber(ad.metrics.clicks)}
                                        </p>
                                    </div>
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase tracking-wide">
                                            CTR
                                        </span>
                                        <p className="font-bold text-sm" style={{ color: sortBy === 'ctr' ? activeColor : undefined }}>
                                            {formatPercent(ad.metrics.ctr)}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>

                            {/* Comparison Highlight (Footer - Direct Child) */}
                            <div
                                className="flex justify-between items-center px-4 py-3"
                                style={{ backgroundColor: activeColor, color: '#fff' }}
                            >
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-semibold tracking-wider opacity-90">
                                        {METRIC_CONFIG[configKey]?.label || 'Valor'}
                                    </span>
                                    <span className="font-bold text-lg leading-none">
                                        {sortBy === 'spend' && formatCurrency(ad.metrics.spend)}
                                        {sortBy === 'impressions' && formatNumber(ad.metrics.impressions)}
                                        {sortBy === 'clicks' && formatNumber(ad.metrics.clicks)}
                                        {sortBy === 'ctr' && formatPercent(ad.metrics.ctr)}
                                        {sortBy === 'profile_visits' && formatNumber(ad.metrics.profile_visits)}
                                        {sortBy === 'results' && formatNumber(ad.metrics.clicks)}
                                        {sortBy === 'reach' && formatNumber(ad.metrics.reach)}
                                        {sortBy === 'conversations' && formatNumber(ad.metrics.conversations)}
                                        {sortBy === 'cpc' && formatCurrency(ad.metrics.cpc)}
                                        {sortBy === 'frequency' && ad.metrics.frequency.toFixed(2)}
                                    </span>
                                </div>
                                {/* Secondary Metric (Investido or something else if Investido is primary) */}
                                {sortBy !== 'spend' && (
                                    <div className="flex flex-col items-end opacity-90">
                                        <span className="text-[10px] uppercase font-semibold tracking-wider">Investido</span>
                                        <span className="font-bold text-sm">{formatCurrency(ad.metrics.spend)}</span>
                                    </div>
                                )}
                            </div>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
