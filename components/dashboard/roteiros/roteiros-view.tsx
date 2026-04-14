"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { getRoteiros, moveRoteiro, type Roteiro } from "@/app/(dashboard)/actions/roteiros"
import { addMonths, format, parse, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Plus, GripVertical, FileText, Filter, MessageSquareText } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getAdminAccountMonthNotes, saveAdminAccountMonthNote } from "@/app/(dashboard)/actions/roteiros"
import { getTeamMembers } from "@/components/dashboard/comments-actions"
import { PublicMonthNoteDialog } from "./public-month-note-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"

// Tipos de visualização
type ViewMode = 'mensal' | 'bimensal' | 'semestral' | 'anual'
const VIEW_COLS = {
    'mensal': 1,
    'bimensal': 2,
    'semestral': 6,
    'anual': 12
}

export function RoteirosView({ accountId }: { accountId: string }) {
    const [viewMode, setViewMode] = useState<ViewMode>('bimensal')
    const [baseDate, setBaseDate] = useState(new Date())
    const [roteiros, setRoteiros] = useState<Roteiro[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const router = useRouter()

    // Custom controls
    const [columnOffsets, setColumnOffsets] = useState<number[]>([])
    const [isHydrated, setIsHydrated] = useState(false)

    // Month Note states
    const [monthNotes, setMonthNotes] = useState<any[]>([])
    const [teamMembers, setTeamMembers] = useState<any[]>([])
    const [selectedMonthNote, setSelectedMonthNote] = useState<string | null>(null)

    // Confirmation Modal State
    const [confirmMove, setConfirmMove] = useState<{ id: string, sourceMonth: string, destMonth: string } | null>(null)

    // Load from localStorage on mount
    useEffect(() => {
        if (!accountId) return;
        const savedMode = localStorage.getItem(`m3a_roteiros_mode_${accountId}`) as ViewMode
        const savedOffsets = localStorage.getItem(`m3a_roteiros_offsets_${accountId}`)
        
        let initialMode: ViewMode = 'bimensal'
        let initialOffsets: number[] | null = null

        if (savedMode && VIEW_COLS[savedMode]) {
            initialMode = savedMode
        }
        
        if (savedOffsets) {
            try {
                initialOffsets = JSON.parse(savedOffsets)
            } catch (e) {}
        }
        
        setViewMode(initialMode)
        
        if (initialOffsets && Array.isArray(initialOffsets) && initialOffsets.length === VIEW_COLS[initialMode]) {
            setColumnOffsets(initialOffsets)
        } else {
            setColumnOffsets(Array(VIEW_COLS[initialMode]).fill(0).map((_, i) => i))
        }
        
        setIsHydrated(true)
    }, [accountId])

    // Save to localStorage when changed
    useEffect(() => {
        if (!isHydrated || !accountId) return
        localStorage.setItem(`m3a_roteiros_mode_${accountId}`, viewMode)
        localStorage.setItem(`m3a_roteiros_offsets_${accountId}`, JSON.stringify(columnOffsets))
    }, [viewMode, columnOffsets, isHydrated, accountId])

    const handleViewModeChange = (mode: ViewMode) => {
        setViewMode(mode)
        setColumnOffsets(Array(VIEW_COLS[mode]).fill(0).map((_, i) => i))
    }

    const activeMonths = useMemo(() => {
        return columnOffsets.map(offset => {
            const date = addMonths(baseDate, offset)
            return format(date, 'yyyy-MM')
        })
    }, [baseDate, columnOffsets])

    // Load Data
    useEffect(() => {
        if (!accountId || activeMonths.length === 0) return

        const load = async () => {
            setIsLoading(true)
            const [data, notes, members] = await Promise.all([
                getRoteiros(accountId, activeMonths),
                getAdminAccountMonthNotes(accountId, activeMonths),
                getTeamMembers()
            ])
            setRoteiros(data || [])
            setMonthNotes(notes || [])
            setTeamMembers(members || [])
            setIsLoading(false)
        }
        load()
    }, [accountId, activeMonths])

    const handleMonthNoteSave = (monthStr: string, content: string, authorId: string = "") => {
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
    }

    // Grouping by Month
    const groupedRoteiros = useMemo(() => {
        const groups: Record<string, Roteiro[]> = {}
        activeMonths.forEach(m => groups[m] = [])
        roteiros.forEach(r => {
            if (groups[r.month_year]) {
                groups[r.month_year].push(r)
            }
        })

        // Sort inside each group strictly by created_at (descending)
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        })

        return groups
    }, [roteiros, activeMonths])

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result
        if (!destination) return

        const sourceMonth = source.droppableId
        const destMonth = destination.droppableId

        if (sourceMonth === destMonth && source.index === destination.index) return

        if (sourceMonth === destMonth) {
            handleReorder(sourceMonth, source.index, destination.index, draggableId)
            return
        }

        setConfirmMove({ id: draggableId, sourceMonth, destMonth })
    }

    const handleReorder = async (monthStr: string, sourceIdx: number, destIdx: number, draggableId: string) => {
        // Optimistic UI update
        const originalRoteiros = [...roteiros]
        const groupElements = [...(groupedRoteiros[monthStr] || [])]
        
        const [movedItem] = groupElements.splice(sourceIdx, 1)
        groupElements.splice(destIdx, 0, movedItem)

        // Find created_at values of siblings in the new position
        const prevItem = groupElements[destIdx - 1]
        const nextItem = groupElements[destIdx + 1]

        let newTime: number

        if (!prevItem && !nextItem) {
            return
        } else if (!prevItem) {
            // Moved to the top -> make it strictly LARGER than the current top item
            newTime = new Date(nextItem.created_at).getTime() + 60000 
        } else if (!nextItem) {
            // Moved to the bottom -> make it strictly SMALLER than the current bottom item
            newTime = new Date(prevItem.created_at).getTime() - 60000 
        } else {
            // Mid drop point
            const t1 = new Date(prevItem.created_at).getTime()
            const t2 = new Date(nextItem.created_at).getTime()
            newTime = t1 - ((t1 - t2) / 2)
        }

        const newCreatedAt = new Date(newTime).toISOString()

        setRoteiros(prev => prev.map(r => r.id === draggableId ? { ...r, created_at: newCreatedAt } : r))

        import('@/app/(dashboard)/actions/roteiros').then(async ({ reorderRoteiro }) => {
            const res = await reorderRoteiro(draggableId, newCreatedAt)
            if (res.error) {
                toast.error("Erro ao reordenar.")
                setRoteiros(originalRoteiros)
            }
        }).catch(() => {
            toast.error("Erro inesperado e interno.")
            setRoteiros(originalRoteiros)
        })
    }

    const confirmDrag = async () => {
        if (!confirmMove) return

        // Optimistic UI update
        const id = confirmMove.id
        const destMonth = confirmMove.destMonth
        setRoteiros(prev => prev.map(r => r.id === id ? { ...r, month_year: destMonth } : r))

        setConfirmMove(null)

        const res = await moveRoteiro(id, destMonth)
        if (res.error) {
            toast.error("Erro ao mover roteiro.")
            // Rollback is complex here without re-fetching, let's just re-fetch
            const data = await getRoteiros(accountId, activeMonths)
            setRoteiros(data || [])
        } else {
            toast.success("Roteiro movido com sucesso!")
        }
    }

    const cancelDrag = () => setConfirmMove(null)

    const getStatusLabel = (status: Roteiro['status']) => {
        if (status === 'criacao') return 'EM CRIAÇÃO'
        if (status === 'liberado') return 'ÁREA DO CLIENTE'
        if (status === 'em_gravacao') return 'EM GRAVAÇÃO'
        if (status === 'gravado') return 'GRAVADO'
        if (status === 'postado') return 'POSTADO'
        return String(status).toUpperCase()
    }

    const getBadgeStyles = (status: Roteiro['status']) => {
        if (status === 'criacao') return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
        if (status === 'liberado') return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
        if (status === 'em_gravacao') return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
        if (status === 'gravado') return "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800"
        if (status === 'postado') return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800"
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300"
    }

    // Change individual column month
    const adjustColumnOffset = (colIndex: number, delta: number) => {
        setColumnOffsets(prev => {
            const copy = [...prev]
            copy[colIndex] += delta
            return copy
        })
    }

    if (!isHydrated) {
        return null; // Prevents hydration mismatch and flashes
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border">
                <div className="flex items-center gap-2">
                    <Select value={viewMode} onValueChange={(v) => handleViewModeChange(v as ViewMode)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Visualização" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="mensal">1 Mês</SelectItem>
                            <SelectItem value="bimensal">Bimensal</SelectItem>
                            <SelectItem value="semestral">Semestral</SelectItem>
                            <SelectItem value="anual">Anual</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => {
                            const defaultM = activeMonths[0] || format(new Date(), 'yyyy-MM')
                            router.push(`/roteiros/editor?accountId=${accountId}&month=${defaultM}`)
                        }}
                        className="gap-2 bg-blue-600 hover:bg-blue-700"
                    >
                        <Plus className="w-4 h-4" />
                        Criar Roteiro
                    </Button>
                </div>
            </div>

            {/* Kanban / Calendar Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className={cn(
                    "grid gap-4",
                    viewMode === 'mensal' && "grid-cols-1",
                    viewMode === 'bimensal' && "grid-cols-1 md:grid-cols-2",
                    viewMode === 'semestral' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-6",
                    viewMode === 'anual' && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6", // wrapping 12 cols
                )}>
                    {activeMonths.map((monthStr, colIndex) => {
                        const dateObj = parse(monthStr, 'yyyy-MM', new Date())
                        const monthName = format(dateObj, 'MMM yyyy', { locale: ptBR })
                        const items = groupedRoteiros[monthStr] || []
                        const monthNote = monthNotes.find(n => n.month_year === monthStr)

                        return (
                            <div key={colIndex} className="flex flex-col bg-slate-50/50 dark:bg-slate-900/20 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-sm overflow-hidden h-full min-h-[500px]">
                                {/* Column Header */}
                                <div className="flex items-center justify-between p-4 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/50 dark:bg-slate-950/50">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => adjustColumnOffset(colIndex, -1)}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-[13px] font-bold uppercase tracking-widest text-slate-700 dark:text-slate-200">
                                            {monthName}
                                        </h3>
                                        <button
                                            onClick={() => setSelectedMonthNote(monthStr)}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors group/note"
                                            title={monthNote?.author_name ? `Estratégia por ${monthNote.author_name}` : "Estratégia do Mês"}
                                        >
                                            <MessageSquareText className={cn("w-4 h-4", monthNote?.content && "text-blue-500 fill-blue-50/50")} />
                                        </button>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" onClick={() => adjustColumnOffset(colIndex, 1)}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>

                                {/* Droppable Area */}
                                <Droppable droppableId={monthStr}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn(
                                                "flex-1 p-3 flex flex-col gap-3 transition-colors",
                                                snapshot.isDraggingOver && "bg-blue-50/50 dark:bg-blue-900/10"
                                            )}
                                        >
                                            {isLoading ? (
                                                <div className="text-center text-xs text-slate-400 py-4">Carregando...</div>
                                            ) : items.length === 0 ? (
                                                <div className="text-center text-xs text-slate-400 py-8 border-2 border-dashed rounded-lg border-slate-200 dark:border-slate-800">
                                                    Nenhum roteiro neste mês
                                                </div>
                                            ) : (
                                                items.map((item, index) => (
                                                    <Draggable key={item.id} draggableId={item.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                className={cn(
                                                                    "group flex items-stretch rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-950 transition-all hover:shadow-md",
                                                                    snapshot.isDragging && "shadow-xl border-blue-400 dark:border-blue-600 scale-[1.03] z-50 opacity-95 ring-2 ring-blue-500/20"
                                                                )}
                                                            >
                                                                <div {...provided.dragHandleProps} className="flex flex-col justify-center px-4 py-4 text-slate-300 hover:text-slate-500 dark:text-slate-600 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing transition-colors bg-slate-50/80 border-r border-slate-100/50 rounded-l-xl dark:bg-slate-900/50 dark:border-slate-800/80">
                                                                    <GripVertical className="w-5 h-5 mx-auto" />
                                                                </div>
                                                                <Link 
                                                                    href={`/roteiros/editor?accountId=${accountId}&id=${item.id}&month=${item.month_year}`}
                                                                    className="flex-1 min-w-0 flex flex-col gap-2 p-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/30 rounded-r-xl transition-colors cursor-pointer outline-none"
                                                                >
                                                                    <h4 className="font-bold text-[14px] text-slate-800 dark:text-slate-100 leading-tight line-clamp-2" title={item.title || "Sem Título"}>
                                                                        {item.title || "Sem Título"}
                                                                    </h4>
                                                                    <div className="flex flex-wrap items-center gap-2 mt-auto pt-1">
                                                                        {(item.status === 'gravado' || item.status === 'postado' || item.status === 'liberado') && (
                                                                            <span className={cn("text-[10px] px-2 py-0.5 rounded-md border font-bold tracking-wide", getBadgeStyles(item.status))}>
                                                                                {getStatusLabel(item.status)}
                                                                            </span>
                                                                        )}
                                                                        {item.funnel_stage && (
                                                                            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-md px-2 py-0.5 whitespace-nowrap bg-slate-50 dark:bg-slate-900 flex items-center gap-1.5">
                                                                                <Filter className="w-3 h-3 text-slate-400" /> {item.funnel_stage}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                </Link>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))
                                            )}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        )
                    })}
                </div>
            </DragDropContext>

            {/* Confirm Move Dialog */}
            <Dialog open={!!confirmMove} onOpenChange={(open: boolean) => !open && cancelDrag()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mover Roteiro</DialogTitle>
                        <DialogDescription>
                            Você tem certeza que deseja alterar este roteiro do mês de {confirmMove && format(parse(confirmMove.sourceMonth, 'yyyy-MM', new Date()), 'MMM yyyy', { locale: ptBR })} para {confirmMove && format(parse(confirmMove.destMonth, 'yyyy-MM', new Date()), 'MMM yyyy', { locale: ptBR })}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4">
                        <Button variant="outline" onClick={cancelDrag}>Cancelar</Button>
                        <Button onClick={confirmDrag} className="bg-blue-600 px-6">Sim, Mover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PublicMonthNoteDialog
                monthStr={selectedMonthNote}
                initialContent={monthNotes.find(n => n.month_year === selectedMonthNote)?.content || ''}
                initialAuthorId={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_id || ''}
                authorName={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_name || null}
                authorAvatar={monthNotes.find(n => n.month_year === selectedMonthNote)?.author_avatar_url || null}
                isOpen={!!selectedMonthNote}
                onClose={() => setSelectedMonthNote(null)}
                token="" // Token is not needed here as we use the admin action
                isLoggedIn={true} // Admin view is always logged in
                onSave={async (monthStr, newContent, authorId) => {
                    // Also fire the server action to save it in DB for the admin view
                    const toastId = toast.loading("Salvando comentário...")
                    try {
                        const result = await saveAdminAccountMonthNote(accountId, monthStr, newContent, authorId)
                        if (result.error) {
                            toast.error(result.error, { id: toastId })
                        } else {
                            handleMonthNoteSave(monthStr, newContent, authorId)
                            toast.success("Comentário salvo!", { id: toastId })
                        }
                    } catch (error) {
                        toast.error("Erro inesperado", { id: toastId })
                    }
                }}
                teamMembers={teamMembers}
            />
        </div>
    )
}
