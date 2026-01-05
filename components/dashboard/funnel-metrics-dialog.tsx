"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getFunnelMetrics, updateFunnelMetric } from "@/app/(dashboard)/actions/funnel"
import { saveFunnelConfig } from "./funnel-actions"
import { Settings2, Loader2, CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { format, getYear, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"

interface FunnelMetricsDialogProps {
    accountId: string
    currentMonthStart: string // YYYY-MM-01
    currentConfig?: any[]
}

const METRIC_OPTIONS = [
    { value: 'impressions', label: 'Impressões' },
    { value: 'reach', label: 'Alcance' },
    { value: 'profile_visits', label: 'Visitas ao Perfil' },
    { value: 'followers', label: 'Novos Seguidores' },
    { value: 'scheduled', label: 'Consultas Agendadas' },
    { value: 'showed', label: 'Compareceram' },
    { value: 'inline_link_clicks', label: 'Cliques no Link' },
    { value: 'conversations', label: 'Conversas' },
    { value: 'ctr', label: 'CTR' },
    { value: 'frequency', label: 'Frequência' },
    { value: 'spend', label: 'Valor Usado' },
    { value: 'cpc', label: 'CPC' }
]

export function FunnelMetricsDialog({ accountId, currentMonthStart, currentConfig }: FunnelMetricsDialogProps) {
    const [open, setOpen] = useState(false)
    const [isPopoverOpen, setIsPopoverOpen] = useState(false)
    const [selectedMonth, setSelectedMonth] = useState(currentMonthStart) // Default to current dashboard month

    // Initialize viewYear
    const [viewYear, setViewYear] = useState(() => {
        return currentMonthStart ? getYear(parseISO(currentMonthStart)) : new Date().getFullYear()
    })

    const [metrics, setMetrics] = useState<{
        scheduled: number
        showed: number
        new_followers: number | null
    }>({ scheduled: 0, showed: 0, new_followers: null })

    // Config State
    const [configSteps, setConfigSteps] = useState(currentConfig || [
        { id: '1', metric: 'impressions' },
        { id: '2', metric: 'reach' },
        { id: '3', metric: 'profile_visits' },
        { id: '4', metric: 'followers' },
        { id: '5', metric: 'scheduled' },
        { id: '6', metric: 'showed' }
    ])

    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // Update viewYear logic
    useEffect(() => {
        if (selectedMonth) {
            setViewYear(getYear(parseISO(selectedMonth)))
        }
    }, [selectedMonth])

    useEffect(() => {
        if (open) {
            fetchMetrics(selectedMonth)
            // Reset config state if needed? 
            if (currentConfig) setConfigSteps(currentConfig)
        }
    }, [open, selectedMonth, accountId, currentConfig])

    const fetchMetrics = async (month: string) => {
        setLoading(true)
        try {
            const data = await getFunnelMetrics(accountId, month)
            setMetrics({
                scheduled: data?.appointments_scheduled || 0,
                showed: data?.appointments_showed || 0,
                new_followers: typeof data?.new_followers === 'number' ? data.new_followers : null
            })
        } catch (error) {
            console.error("Failed to fetch metrics", error)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveValues = async () => {
        setSaving(true)
        try {
            const resFollowers = await updateFunnelMetric(accountId, selectedMonth, 'new_followers', metrics.new_followers)
            if (resFollowers.error) throw new Error(resFollowers.error)

            const res = await updateFunnelMetric(accountId, selectedMonth, 'appointments_scheduled', metrics.scheduled)
            if (res.error) throw new Error(res.error)

            const res2 = await updateFunnelMetric(accountId, selectedMonth, 'appointments_showed', metrics.showed)
            if (res2.error) throw new Error(res2.error)

            toast.success("Métricas atualizadas com sucesso!")
            setOpen(false)
            window.location.reload()
        } catch (error: any) {
            console.error("Failed to save metrics", error)
            toast.error(error.message || "Erro inesperado ao salvar.")
        } finally {
            setSaving(false)
        }
    }

    const handleSaveConfig = async () => {
        setSaving(true)
        try {
            const res = await saveFunnelConfig(accountId, configSteps)
            if (res.error) throw new Error(res.error)

            toast.success("Configuração do funil salva!")
            setOpen(false)
            window.location.reload()
        } catch (error: any) {
            console.error("Failed to save config", error)
            toast.error(error.message || "Erro inesperado ao salvar.")
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-6 px-2 text-xs border-slate-200 dark:border-slate-800">
                    <Settings2 className="h-4 w-4" />
                    Editar Métricas
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Métricas & Configuração</DialogTitle>
                    <DialogDescription>
                        Edite os valores manuais ou personalize a estrutura do funil.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="values" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="values">Valores Manuais</TabsTrigger>
                        <TabsTrigger value="config">Personalizar Funil</TabsTrigger>
                    </TabsList>

                    {/* TAB 1: VALUES */}
                    <TabsContent value="values">
                        <div className="grid gap-4 py-4">
                            {/* Month Picker */}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="month" className="text-right">
                                    Mês
                                </Label>
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={"outline"}
                                            className={cn(
                                                "col-span-3 justify-start text-left font-normal",
                                                !selectedMonth && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {selectedMonth ? format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR }).charAt(0).toUpperCase() + format(parseISO(selectedMonth), "MMMM yyyy", { locale: ptBR }).slice(1) : <span>Selecione</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-64 p-3" align="start">
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear - 1)}>
                                                    <ChevronLeft className="h-4 w-4" />
                                                </Button>
                                                <div className="font-semibold text-sm">{viewYear}</div>
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear + 1)}>
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                                {Array.from({ length: 12 }).map((_, i) => {
                                                    const date = new Date(viewYear, i, 1)
                                                    const isSelected = selectedMonth ? (parseISO(selectedMonth).getMonth() === i && parseISO(selectedMonth).getFullYear() === viewYear) : false
                                                    return (
                                                        <Button
                                                            key={i}
                                                            variant={isSelected ? "default" : "ghost"}
                                                            size="sm"
                                                            className="text-xs h-9 w-full capitalize"
                                                            onClick={() => {
                                                                setSelectedMonth(format(date, 'yyyy-MM-dd'))
                                                                setIsPopoverOpen(false)
                                                            }}
                                                        >
                                                            {format(date, 'MMM', { locale: ptBR })}
                                                        </Button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="new_followers" className="text-right">Seguidores</Label>
                                        <div className="col-span-3 flex flex-col gap-1">
                                            <Input
                                                id="new_followers"
                                                type="number"
                                                placeholder="Auto"
                                                value={metrics.new_followers ?? ''}
                                                onChange={(e) => {
                                                    const val = e.target.value
                                                    setMetrics({ ...metrics, new_followers: val === '' ? null : parseInt(val) })
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="scheduled" className="text-right">Agendadas</Label>
                                        <Input
                                            id="scheduled"
                                            type="number"
                                            value={metrics.scheduled}
                                            onChange={(e) => setMetrics({ ...metrics, scheduled: parseInt(e.target.value) || 0 })}
                                            className="col-span-3"
                                        />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="showed" className="text-right">Compareceram</Label>
                                        <Input
                                            id="showed"
                                            type="number"
                                            value={metrics.showed}
                                            onChange={(e) => setMetrics({ ...metrics, showed: parseInt(e.target.value) || 0 })}
                                            className="col-span-3"
                                        />
                                    </div>
                                </>
                            )}

                            <Button className="w-full mt-2" onClick={handleSaveValues} disabled={loading || saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Valores
                            </Button>
                        </div>
                    </TabsContent>

                    {/* TAB 2: CONFIG */}
                    <TabsContent value="config">
                        <div className="space-y-4 py-4">
                            <div className="text-sm text-muted-foreground mb-4">
                                Defina quais métricas aparecem em cada etapa do funil.
                                As métricas removidas aparecerão nos cartões de performance.
                            </div>

                            {configSteps.map((step: any, idx: number) => (
                                <div key={idx} className="grid grid-cols-4 items-center gap-4">
                                    <Label className="text-right text-xs uppercase text-muted-foreground">Etapa {idx + 1}</Label>
                                    <div className="col-span-3">
                                        <Select
                                            value={step.metric}
                                            onValueChange={(val) => {
                                                const newSteps = [...configSteps]
                                                newSteps[idx] = { ...newSteps[idx], metric: val }
                                                setConfigSteps(newSteps)
                                            }}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {METRIC_OPTIONS.map(opt => (
                                                    <SelectItem key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            ))}

                            <Button className="w-full mt-4" onClick={handleSaveConfig} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Estrutura
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    )
}
