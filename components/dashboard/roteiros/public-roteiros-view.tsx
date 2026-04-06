"use client"

import React, { useState } from "react"
import { type Roteiro } from "@/app/(dashboard)/actions/roteiros"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { FileText, Filter, CheckCircle2, Clock, Eye, MessageSquareText, Lightbulb, Settings } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PublicRoteiroApprovalDialog } from "./public-roteiro-approval-dialog"
import { PublicMonthNoteDialog } from "./public-month-note-dialog"
import { CustomNoticeDialog } from "./custom-notice-dialog"
import { Button } from "@/components/ui/button"
import { saveAccountMonthNote } from "@/components/dashboard/share-actions"
import { toast } from "sonner"

interface PublicRoteirosViewProps {
    account: any
    isLoggedIn: boolean
    token: string
    initialRoteiros: Roteiro[]
    initialMonthNotes: any[]
    teamMembers?: any[]
    roteirosNotice?: string | null
}

type ViewMode = 'mensal' | 'bimensal' | 'semestral' | 'anual'
const VIEW_COLS: Record<ViewMode, number> = { mensal: 1, bimensal: 2, semestral: 6, anual: 12 }

export function PublicRoteirosView({ account, isLoggedIn, token, initialRoteiros, initialMonthNotes, teamMembers = [], roteirosNotice = null }: PublicRoteirosViewProps) {
    const [roteiros, setRoteiros] = useState<Roteiro[]>(initialRoteiros)
    const [monthNotes, setMonthNotes] = useState<any[]>(initialMonthNotes)
    const [selectedRoteiro, setSelectedRoteiro] = useState<Roteiro | null>(null)
    const [selectedMonthNote, setSelectedMonthNote] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<ViewMode>('bimensal')
    const [isNoticeOpen, setIsNoticeOpen] = useState(false)

    const defaultNotice = "O roteiro é um suporte para a sua autoridade, mas é o seu jeito de falar que gera conexão e confiança. Nós cuidamos da sua comunicação e você entra com o que mais importa: a sua especialidade e técnica. Use nosso roteiro como uma referência e faça o ajuste necessário no desenvolvimento para que ele reflita exatamente a forma como você explica os tratamentos no consultório."
    const displayNotice = roteirosNotice && roteirosNotice.trim().length > 0 ? roteirosNotice : defaultNotice;

    // Helper to get distinct months present in the roteiros data, sorted chronologically ONLY for non-criação
    const availableMonths = React.useMemo(() => {
        const uniqueMonths = new Set(roteiros.filter(r => r.status !== 'criacao').map(r => r.month_year))
        return Array.from(uniqueMonths).sort() // Ascending order
    }, [roteiros])

    const displayMonths = React.useMemo(() => {
        const cols = VIEW_COLS[viewMode]
        // Get the latest 'cols' months from availableMonths
        return availableMonths.slice(-cols)
    }, [availableMonths, viewMode])

    const groupedRoteiros = displayMonths.reduce((acc, month) => {
        const filtered = roteiros.filter(r => r.month_year === month && r.status !== 'criacao')
        // Sort inside each group strictly by created_at (descending) to match the admin DND order
        acc[month] = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        return acc
    }, {} as Record<string, Roteiro[]>)

    const handleMonthNoteSave = async (monthStr: string, content: string, authorId: string = "") => {
        const toastId = toast.loading(content ? "Salvando estratégia..." : "Excluindo estratégia...")

        try {
            const result = await saveAccountMonthNote(token, monthStr, content, authorId)

            if (result.error) {
                toast.error(result.error, { id: toastId })
                return
            }

            toast.success(content ? "Estratégia salva!" : "Estratégia excluída!", { id: toastId })

            setMonthNotes(prev => {
                const existingIndex = prev.findIndex(n => n.month_year === monthStr)
                const authorData = teamMembers.find(m => m.id === authorId)

                if (existingIndex >= 0) {
                    if (!content.trim()) return prev.filter((_, i) => i !== existingIndex)
                    const copy = [...prev]
                    copy[existingIndex] = {
                        ...copy[existingIndex],
                        content,
                        author_id: authorId,
                        author_name: authorData ? authorData.full_name : copy[existingIndex].author_name,
                        author_avatar_url: authorData ? authorData.avatar_url : copy[existingIndex].author_avatar_url
                    }
                    return copy
                } else {
                    if (!content.trim()) return prev
                    return [...prev, {
                        month_year: monthStr,
                        content,
                        author_id: authorId,
                        author_name: authorData ? authorData.full_name : null,
                        author_avatar_url: authorData ? authorData.avatar_url : null
                    }]
                }
            })
        } catch (error) {
            toast.error("Erro inesperado", { id: toastId })
        }
    }

    const getGridClass = (length: number) => {
        if (length === 0) return "grid-cols-1"
        if (length === 1) return "grid-cols-1 max-w-4xl mx-auto w-full" // Occupies most of the screen
        if (length === 2) return "grid-cols-1 md:grid-cols-2" // Equal halves
        if (length === 3) return "grid-cols-1 md:grid-cols-3" // Side by side
        if (length === 4) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-2" // 2 on top, 2 on bot (or just grid-cols-2 makes it 2x2)
        if (length === 5) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" // 3 on top, 2 on bot
        if (length === 6) return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" // 3 on top, 3 on bot
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-4" // 7+: 4 on top, 3 on bot...
    }

    const getStatusInfo = (status: Roteiro['status']) => {
        if (status === 'liberado' || status === 'em_gravacao' || status === 'criacao') return {
            label: '',
            color: '',
            icon: null
        }
        if (status === 'gravado') return {
            label: 'Gravado',
            color: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />
        }
        if (status === 'postado') return {
            label: 'Postado',
            color: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />
        }
        return { label: '', color: '', icon: null }
    }

    const handleStatusChange = (roteiroId: string, newStatus: string) => {
        setRoteiros(prev => prev.map(r => r.id === roteiroId ? { ...r, status: newStatus as Roteiro['status'] } : r))
    }

    return (
        <div className="flex flex-col gap-6 w-full">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Aprovação de Roteiros</h2>
                    <p className="text-slate-500 text-sm mt-1">Revise os scripts de vídeo e publicações criadas para a sua conta.</p>
                </div>
                {availableMonths.length > 0 && (
                    <Select value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                        <SelectTrigger className="w-[180px] bg-white dark:bg-slate-950">
                            <SelectValue placeholder="Visualização" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mensal">1 Mês</SelectItem>
                            {availableMonths.length > 1 && <SelectItem value="bimensal">Bimensal</SelectItem>}
                            {availableMonths.length > 2 && <SelectItem value="semestral">Semestral</SelectItem>}
                            {availableMonths.length > 6 && <SelectItem value="anual">Anual</SelectItem>}
                        </SelectContent>
                    </Select>
                )}
            </div>

            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4 md:p-5 flex gap-3 text-amber-900 dark:text-amber-200 shadow-sm mb-2 relative group">
                <Lightbulb className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="text-[13px] md:text-sm leading-relaxed whitespace-pre-wrap pr-8">
                    <strong className="font-semibold">Lembre-se:</strong> {displayNotice}
                </div>
                {isLoggedIn && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-700/50 hover:text-amber-700 hover:bg-amber-100/50 dark:text-amber-500/50 dark:hover:text-amber-400 dark:hover:bg-amber-900/50"
                            onClick={() => setIsNoticeOpen(true)}
                            title="Configurar Aviso do Cliente"
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                )}
            </div>

            {isLoggedIn && (
                <CustomNoticeDialog
                    accountId={account.provider_account_id}
                    initialNotice={roteirosNotice}
                    isOpen={isNoticeOpen}
                    onClose={() => setIsNoticeOpen(false)}
                />
            )}

            <div className={cn("grid gap-y-6 gap-x-6", getGridClass(displayMonths.length))}>
                {displayMonths.map((monthStr, colIndex) => {
                    const dateObj = parse(monthStr, 'yyyy-MM', new Date())
                    const monthName = format(dateObj, 'MMM yyyy', { locale: ptBR })
                    // For client view, NEVER show 'criacao' roteiros. Only 'aprovacao' and 'aprovado'
                    const items = (groupedRoteiros[monthStr] || []).filter(r => r.status !== 'criacao')
                    const monthNote = monthNotes.find(n => n.month_year === monthStr)

                    return (
                        <div key={colIndex} className="flex flex-col bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden h-full min-h-[400px]">
                            {/* Column Header */}
                            <div className="flex items-center justify-center p-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50 relative">
                                <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                    {monthName}
                                </h3>
                                {(isLoggedIn || monthNote?.content) && (
                                    <button
                                        onClick={() => setSelectedMonthNote(monthStr)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors group/note"
                                        title={monthNote?.author_name ? `Comentário por ${monthNote.author_name}` : "Comentários e Estratégia do Mês"}
                                    >
                                        <MessageSquareText className={cn("w-4 h-4", monthNote?.content && "text-blue-500 fill-blue-50/50")} />
                                    </button>
                                )}
                            </div>

                            {/* Cards Area */}
                            <div className="flex-1 p-3 flex flex-col gap-3">
                                {items.length === 0 ? (
                                    <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800 h-full flex items-center justify-center">
                                        Nenhum roteiro para aprovação
                                    </div>
                                ) : (
                                    items.map((item) => {
                                        const statusInfo = getStatusInfo(item.status)
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => setSelectedRoteiro(item)}
                                                className="group flex flex-col p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-md cursor-pointer"
                                            >
                                                <div className="flex-1 min-w-0 flex flex-col gap-2">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <h4 className="font-bold text-[14px] text-slate-800 dark:text-slate-100 leading-tight">
                                                            {item.title || "Sem Título"}
                                                        </h4>
                                                        {statusInfo.label && (
                                                            <span className={cn("flex shrink-0 items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border font-bold tracking-wide", statusInfo.color)}>
                                                                {statusInfo.icon}
                                                                {statusInfo.label}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {item.funnel_stage && (
                                                        <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
                                                            <Filter className="w-3.5 h-3.5" /> Etapa do Funil: {item.funnel_stage}
                                                        </div>
                                                    )}

                                                    <button className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg border transition-colors">
                                                        <Eye className="w-4 h-4" /> Ler Roteiro
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <PublicRoteiroApprovalDialog
                roteiro={selectedRoteiro}
                isOpen={!!selectedRoteiro}
                onClose={() => setSelectedRoteiro(null)}
                token={token}
                onStatusChange={handleStatusChange}
                isLoggedIn={isLoggedIn}
            />

            <PublicMonthNoteDialog
                monthStr={selectedMonthNote}
                initialContent={monthNotes.find(n => n.month_year === selectedMonthNote)?.content || ''}
                initialAuthorId={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_id || ''}
                authorName={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_name || null}
                authorAvatar={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_avatar_url || null}
                isOpen={!!selectedMonthNote}
                onClose={() => setSelectedMonthNote(null)}
                token={token}
                isLoggedIn={isLoggedIn}
                onSave={handleMonthNoteSave}
                teamMembers={teamMembers}
            />
        </div>
    )
}
