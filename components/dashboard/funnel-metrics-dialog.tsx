"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getFunnelMetrics, updateFunnelMetric } from "@/app/(dashboard)/actions/funnel"
import { getAccountGoals, getGoalsProgress, saveAccountGoal, deleteAccountGoal, toggleGoalStatus } from "@/app/(dashboard)/actions"
import { saveFunnelConfig } from "./funnel-actions"
import { Settings2, Loader2, CalendarIcon, ChevronLeft, ChevronRight, Target, Plus, Trash2, Pencil, Archive, Eye, EyeOff, CheckCircle2 } from "lucide-react"
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

    // Goal Picker State
    const [isGoalPopoverOpen, setIsGoalPopoverOpen] = useState(false)
    const [goalViewYear, setGoalViewYear] = useState(new Date().getFullYear())

    // Goal Tab Month Picker State
    const [goalTabMonth, setGoalTabMonth] = useState<string>(currentMonthStart || format(new Date(), 'yyyy-MM-dd'))
    const [isGoalTabPopoverOpen, setIsGoalTabPopoverOpen] = useState(false)
    const [goalTabViewYear, setGoalTabViewYear] = useState(new Date().getFullYear())

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

    // Goals State
    const [goals, setGoals] = useState<any[]>([])
    const [goalView, setGoalView] = useState<'list' | 'form' | 'archived'>('list')
    const [editingGoal, setEditingGoal] = useState<any>(null)
    const [goalToToggle, setGoalToToggle] = useState<any>(null)

    const [goalForm, setGoalForm] = useState({
        metric: 'followers',
        target: '',
        period: 'monthly',
        start_date: undefined as string | undefined
    })

    const GOAL_OPTIONS = [
        { value: 'followers', label: 'Seguidores' },
        { value: 'conversations', label: 'Mensagens / Conversas' },
        { value: 'appointments_scheduled', label: 'Consultas Agendadas' },
        { value: 'appointments_showed', label: 'Consultas Realizadas' }
    ]

    useEffect(() => {
        if (open && accountId) {
            loadGoals()
        }
    }, [open, accountId])

    const loadGoals = () => {
        getGoalsProgress(accountId).then(data => {
            setGoals(data || [])
        })
    }

    const handleCreateGoal = () => {
        setEditingGoal(null)
        setGoalForm({
            metric: 'followers',
            target: '',
            period: 'monthly',
            start_date: undefined
        })
        setGoalView('form')
    }

    const handleEditGoal = (goal: any) => {
        setEditingGoal(goal)
        setGoalForm({
            metric: goal.metric,
            target: goal.target.toString(),
            period: goal.period,
            start_date: goal.start_date
        })
        setGoalView('form')
    }

    const handleDeleteGoal = async (goalId: string) => {
        if (!confirm("Tem certeza que deseja excluir esta meta?")) return
        setLoading(true)
        try {
            await deleteAccountGoal(goalId)
            toast.success("Meta excluída")
            loadGoals()
        } catch (e) {
            toast.error("Erro ao excluir meta")
        } finally {
            setLoading(false)
        }
    }

    const handleToggleConfirmation = async () => {
        if (!goalToToggle) return
        try {
            await toggleGoalStatus(goalToToggle.id, !goalToToggle.archived)
            toast.success(goalToToggle.archived ? "Meta reativada" : "Meta arquivada")
            loadGoals()
        } catch (e) {
            toast.error("Erro ao alterar status da meta")
        } finally {
            setGoalToToggle(null)
        }
    }

    const handleSaveGoal = async () => {
        if (!goalForm.target || parseInt(goalForm.target) <= 0) {
            toast.error("Defina uma meta válida maior que zero")
            return
        }
        setSaving(true)
        try {
            await saveAccountGoal(accountId, {
                id: editingGoal?.id, // If editing, pass ID
                metric: goalForm.metric,
                target: parseInt(goalForm.target),
                period: goalForm.period as 'monthly' | 'total',
                start_date: goalForm.start_date
            })
            toast.success("Meta salva com sucesso!")
            setGoalView('list')
            loadGoals()
            // Optionally reload page to update dashboard?
            // window.location.reload() 
            // Better: User closes dialog, then maybe reload?
            // For now, let's reload on close OR reload here if needed.
        } catch (error) {
            toast.error("Erro ao salvar meta")
        } finally {
            setSaving(false)
        }
    }

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

    const handleMetricChange = (field: keyof typeof metrics, value: string) => {
        setMetrics(prev => ({ ...prev, [field]: value === '' ? null : parseInt(value) }))
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
        <>
            <Dialog open={open} onOpenChange={(v) => {
                setOpen(v)
                if (!v) window.location.reload() // Reload on close to refresh dashboard goals
            }}>
                <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2 h-6 px-2 text-xs border-slate-200 dark:border-slate-800">
                        <Settings2 className="h-4 w-4" />
                        Editar Métricas
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Métricas & Configuração</DialogTitle>
                        <DialogDescription>
                            Edite valores, funil ou gerencie suas metas.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="values" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 h-auto">
                            <TabsTrigger value="values" className="text-xs px-1 whitespace-normal h-full">Valores Manuais</TabsTrigger>
                            <TabsTrigger value="config" className="text-xs px-1 whitespace-normal h-full">Personalizar Funil</TabsTrigger>
                            <TabsTrigger value="goals" className="text-xs px-1 whitespace-normal h-full">Metas ({goals.length})</TabsTrigger>
                        </TabsList>

                        {/* TAB 1: VALUES */}
                        <TabsContent value="values">
                            <div className="grid gap-4 py-4">
                                {/* Month Picker */}
                                <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                    <Label htmlFor="month" className="text-left md:text-right">
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
                                        <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                            <Label htmlFor="new_followers" className="text-left md:text-right">Seguidores</Label>
                                            <div className="col-span-3 flex flex-col gap-1">
                                                <Input
                                                    id="new_followers"
                                                    type="number"
                                                    placeholder="—"
                                                    value={metrics.new_followers ?? ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value
                                                        setMetrics({ ...metrics, new_followers: val === '' ? null : parseInt(val) })
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                            <Label htmlFor="scheduled" className="text-left md:text-right">Agendadas</Label>
                                            <Input
                                                id="scheduled"
                                                type="number"
                                                value={metrics.scheduled}
                                                onChange={(e) => handleMetricChange('scheduled', e.target.value)}
                                                className="col-span-3"
                                            />
                                        </div>
                                        <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                            <Label htmlFor="showed" className="text-left md:text-right">Compareceram</Label>
                                            <Input
                                                id="showed"
                                                type="number"
                                                value={metrics.showed}
                                                onChange={(e) => handleMetricChange('showed', e.target.value)}
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

                        {/* TAB 3: GOALS (LIST & FORM) */}
                        <TabsContent value="goals">
                            <div className="space-y-4 py-4">

                                {goalView === 'list' && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center mb-4">
                                            <Button variant="ghost" size="sm" onClick={() => setGoalView('archived')} className="gap-2 text-muted-foreground hover:text-foreground">
                                                <Archive className="h-4 w-4" />
                                                Ver Arquivadas
                                            </Button>
                                            <Button size="sm" onClick={handleCreateGoal} className="gap-1">
                                                <Plus className="h-4 w-4" />
                                                Nova Meta
                                            </Button>
                                        </div>

                                        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            {/* MONTHLY GOALS SECTION */}
                                            <div>
                                                <div className="flex items-center justify-between mb-4 sticky top-0 bg-background z-10 py-2 border-b">
                                                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Metas Mensais</h3>
                                                    {/* Month Picker for Goals Tab */}
                                                    <Popover open={isGoalTabPopoverOpen} onOpenChange={setIsGoalTabPopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                size="sm"
                                                                className={cn(
                                                                    "justify-start text-left font-normal w-[180px] h-8 text-xs",
                                                                    !goalTabMonth && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-3 w-3" />
                                                                {goalTabMonth ? format(parseISO(goalTabMonth), "MMMM yyyy", { locale: ptBR }).charAt(0).toUpperCase() + format(parseISO(goalTabMonth), "MMMM yyyy", { locale: ptBR }).slice(1) : <span>Selecione</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-3" align="end">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setGoalTabViewYear(goalTabViewYear - 1)}>
                                                                        <ChevronLeft className="h-4 w-4" />
                                                                    </Button>
                                                                    <div className="font-semibold text-sm">{goalTabViewYear}</div>
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setGoalTabViewYear(goalTabViewYear + 1)}>
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                                        const date = new Date(goalTabViewYear, i, 1)
                                                                        const isSelected = goalTabMonth ? (parseISO(goalTabMonth).getMonth() === i && parseISO(goalTabMonth).getFullYear() === goalTabViewYear) : false
                                                                        return (
                                                                            <Button
                                                                                key={i}
                                                                                variant={isSelected ? "default" : "ghost"}
                                                                                size="sm"
                                                                                className="text-xs h-9 w-full capitalize"
                                                                                onClick={() => {
                                                                                    setGoalTabMonth(format(date, 'yyyy-MM-dd'))
                                                                                    setIsGoalTabPopoverOpen(false)
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

                                                <div className="space-y-3">
                                                    {goals.filter(g => g.period === 'monthly' && !g.archived && (!g.start_date || g.start_date.substring(0, 7) === goalTabMonth.substring(0, 7))).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed rounded bg-slate-50 dark:bg-slate-900/50">
                                                            Nenhuma meta ativa para este mês.
                                                        </p>
                                                    ) : (
                                                        goals.filter(g => g.period === 'monthly' && !g.archived && (!g.start_date || g.start_date.substring(0, 7) === goalTabMonth.substring(0, 7))).map((goal) => {
                                                            const isMet = (goal.current || 0) >= goal.target
                                                            return (
                                                                <div key={goal.id} className={cn("flex items-center justify-between p-3 border rounded-lg bg-card transition-all",
                                                                    goal.archived ? "opacity-60 bg-slate-50 dark:bg-slate-900/50 grayscale" : (isMet ? "border-green-200 bg-green-50/50 dark:bg-green-900/20 dark:border-green-800" : "")
                                                                )}>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="font-medium text-sm flex items-center gap-2">
                                                                            {GOAL_OPTIONS.find(o => o.value === goal.metric)?.label || goal.metric}
                                                                            {goal.archived && <span className="bg-slate-200 dark:bg-slate-700 text-[9px] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wide">Arquivada</span>}
                                                                            {isMet && <span className="text-green-600 dark:text-green-400 flex items-center text-[10px] uppercase font-bold tracking-wider"><CheckCircle2 className="h-3 w-3 mr-1" /> {goal.completed_at ? `Batida em ${format(parseISO(goal.completed_at), 'MMM', { locale: ptBR })}` : "Batida"}</span>}
                                                                        </span>
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                            <span>
                                                                                Alvo: {goal.target} {goal.metric === 'spend' || goal.metric === 'cpc' ? 'R$' : ''}
                                                                            </span>
                                                                            {!goal.archived && (
                                                                                <span className={cn("font-medium", isMet ? "text-green-600 dark:text-green-400" : "")}>
                                                                                    (Atual: {goal.current || 0})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                                                            onClick={() => setGoalToToggle(goal)}
                                                                            title={goal.archived ? "Reativar Meta" : "Arquivar Meta"}
                                                                        >
                                                                            {goal.archived ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => handleEditGoal(goal)}>
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteGoal(goal.id)}>
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>

                                            {/* GENERAL GOALS SECTION */}
                                            <div>
                                                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 pb-2 border-b sticky top-0 bg-background z-10 pt-4">Metas Gerais</h3>
                                                <div className="space-y-3">
                                                    {goals.filter(g => g.period === 'total' && !g.archived).length === 0 ? (
                                                        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed rounded bg-slate-50 dark:bg-slate-900/50">
                                                            Nenhuma meta geral ativa.
                                                        </p>
                                                    ) : (
                                                        goals.filter(g => g.period === 'total' && !g.archived).map((goal) => {
                                                            const isMet = (goal.current || 0) >= goal.target
                                                            return (
                                                                <div key={goal.id} className={cn("flex items-center justify-between p-3 border rounded-lg bg-card transition-all",
                                                                    goal.archived ? "opacity-60 bg-slate-50 dark:bg-slate-900/50 grayscale" : (isMet ? "border-green-200 bg-green-50/50 dark:bg-green-900/20 dark:border-green-800" : "")
                                                                )}>
                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="font-medium text-sm flex items-center gap-2">
                                                                            {GOAL_OPTIONS.find(o => o.value === goal.metric)?.label || goal.metric}
                                                                            {goal.archived && <span className="bg-slate-200 dark:bg-slate-700 text-[9px] px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wide">Arquivada</span>}
                                                                            {isMet && <span className="text-green-600 dark:text-green-400 flex items-center text-[10px] uppercase font-bold tracking-wider"><CheckCircle2 className="h-3 w-3 mr-1" /> {goal.completed_at ? `Batida em ${format(parseISO(goal.completed_at), 'MMM', { locale: ptBR })}` : "Batida"}</span>}
                                                                        </span>
                                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                            <span>
                                                                                Alvo: {goal.target} {goal.metric === 'spend' || goal.metric === 'cpc' ? 'R$' : ''}
                                                                            </span>
                                                                            {!goal.archived && (
                                                                                <span className={cn("font-medium", isMet ? "text-green-600 dark:text-green-400" : "")}>
                                                                                    (Atual: {goal.current || 0})
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600"
                                                                            onClick={() => setGoalToToggle(goal)}
                                                                            title={goal.archived ? "Reativar Meta" : "Arquivar Meta"}
                                                                        >
                                                                            {goal.archived ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600" onClick={() => handleEditGoal(goal)}>
                                                                            <Pencil className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteGoal(goal.id)}>
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {goalView === 'archived' && (
                                    <div className="space-y-4 animation-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Button variant="ghost" size="sm" onClick={() => setGoalView('list')} className="p-0 h-6 w-6">
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="font-semibold text-sm">Metas Arquivadas</span>
                                        </div>

                                        <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                            <div>
                                                {goals.filter(g => g.archived).length === 0 ? (
                                                    <p className="text-xs text-muted-foreground italic py-8 text-center border border-dashed rounded bg-slate-50 dark:bg-slate-900/50">
                                                        Nenhuma meta arquivada.
                                                    </p>
                                                ) : (
                                                    goals.filter(g => g.archived).map((goal) => {
                                                        const isMet = (goal.current || 0) >= goal.target
                                                        return (
                                                            <div key={goal.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50 opacity-80 mb-3">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-medium text-sm flex items-center gap-2">
                                                                        {GOAL_OPTIONS.find(o => o.value === goal.metric)?.label || goal.metric}
                                                                        {goal.period === 'monthly' && goal.start_date && (
                                                                            <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                                                                                {format(parseISO(goal.start_date), 'MMM yyyy', { locale: ptBR })}
                                                                            </span>
                                                                        )}
                                                                        {isMet && <span className="text-green-600 dark:text-green-400 flex items-center text-[10px] uppercase font-bold tracking-wider"><CheckCircle2 className="h-3 w-3 mr-1" /> {goal.completed_at ? `Batida em ${format(parseISO(goal.completed_at), 'MMM', { locale: ptBR })}` : "Batida"}</span>}
                                                                    </span>
                                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                        <span>Alvo: {goal.target}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-green-600"
                                                                        onClick={() => setGoalToToggle(goal)}
                                                                        title="Reativar Meta"
                                                                    >
                                                                        <EyeOff className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600" onClick={() => handleDeleteGoal(goal.id)}>
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )
                                                    })
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {goalView === 'form' && (
                                    <div className="space-y-4 animation-in slide-in-from-right-4 duration-300">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Button variant="ghost" size="sm" onClick={() => setGoalView('list')} className="p-0 h-6 w-6">
                                                <ChevronLeft className="h-4 w-4" />
                                            </Button>
                                            <span className="font-semibold text-sm">{editingGoal ? 'Editar Meta' : 'Nova Meta'}</span>
                                        </div>

                                        <div className="grid gap-4 border p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                                            <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                                <Label className="text-left md:text-right">Métrica</Label>
                                                <div className="col-span-3">
                                                    <Select
                                                        value={goalForm.metric}
                                                        onValueChange={(val) => setGoalForm({ ...goalForm, metric: val })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {GOAL_OPTIONS.map(opt => (
                                                                <SelectItem key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                                <Label className="text-left md:text-right">Alvo</Label>
                                                <div className="col-span-3">
                                                    <Input
                                                        type="number"
                                                        placeholder="Ex: 1000"
                                                        value={goalForm.target}
                                                        onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                                <Label className="text-left md:text-right">Período</Label>
                                                <div className="col-span-3">
                                                    <Select
                                                        value={goalForm.period}
                                                        onValueChange={(val) => setGoalForm({ ...goalForm, period: val })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="monthly">Mensal</SelectItem>
                                                            <SelectItem value="total">Geral (Campanha/Total)</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 md:grid md:grid-cols-4 md:items-center md:gap-4">
                                                <Label className="text-left md:text-right">{goalForm.period === 'monthly' ? 'Mês' : 'Início'}</Label>
                                                <div className="col-span-3">
                                                    <Popover open={isGoalPopoverOpen} onOpenChange={setIsGoalPopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                className={cn(
                                                                    "w-full justify-start text-left font-normal",
                                                                    !goalForm.start_date && "text-muted-foreground"
                                                                )}
                                                            >
                                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                                {goalForm.start_date ? format(parseISO(goalForm.start_date), "MMMM yyyy", { locale: ptBR }).charAt(0).toUpperCase() + format(parseISO(goalForm.start_date), "MMMM yyyy", { locale: ptBR }).slice(1) : <span>Selecione</span>}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-3" align="start">
                                                            <div className="space-y-4">
                                                                <div className="flex items-center justify-between">
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setGoalViewYear(goalViewYear - 1)}>
                                                                        <ChevronLeft className="h-4 w-4" />
                                                                    </Button>
                                                                    <div className="font-semibold text-sm">{goalViewYear}</div>
                                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setGoalViewYear(goalViewYear + 1)}>
                                                                        <ChevronRight className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    {Array.from({ length: 12 }).map((_, i) => {
                                                                        const date = new Date(goalViewYear, i, 1)
                                                                        const isSelected = goalForm.start_date ? (parseISO(goalForm.start_date).getMonth() === i && parseISO(goalForm.start_date).getFullYear() === goalViewYear) : false
                                                                        return (
                                                                            <Button
                                                                                key={i}
                                                                                variant={isSelected ? "default" : "ghost"}
                                                                                size="sm"
                                                                                className="text-xs h-9 w-full capitalize"
                                                                                onClick={() => {
                                                                                    setGoalForm({ ...goalForm, start_date: format(date, 'yyyy-MM-dd') })
                                                                                    setIsGoalPopoverOpen(false)
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
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" onClick={() => setGoalView('list')}>Cancelar</Button>
                                            <Button onClick={handleSaveGoal} disabled={saving}>
                                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Salvar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!goalToToggle} onOpenChange={(v) => !v && setGoalToToggle(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{goalToToggle?.archived ? "Reativar Meta?" : "Arquivar Meta?"}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {goalToToggle?.archived
                                ? "A meta voltará a aparecer nos cálculos e no painel."
                                : "A meta será ocultada do painel principal, mas seus dados históricos serão preservados."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleConfirmation}>
                            {goalToToggle?.archived ? "Reativar" : "Arquivar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}
