"use client"

import React, { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { TiptapEditor } from "@/components/ui/tiptap-editor"
import { saveRoteiro, getRoteiroById, deleteRoteiro, getRoteiroComments, type Roteiro, type RoteiroComment } from "@/app/(dashboard)/actions/roteiros"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { ArrowLeft, Trash2, MessageSquare, ArrowRight, Edit2 } from "lucide-react"
import { RoteiroCommentsArea } from "./roteiro-comments"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function RoteiroEditorView() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const accountId = searchParams.get('accountId')
    const id = searchParams.get('id')
    const defaultMonth = searchParams.get('month')

    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [commentsOpen, setCommentsOpen] = useState(false)
    const [latestComment, setLatestComment] = useState<RoteiroComment | null>(null)
    const [showDeleteAlert, setShowDeleteAlert] = useState(false)

    const [roteiro, setRoteiro] = useState<Roteiro | null>(null)
    const [title, setTitle] = useState("")
    const [focus, setFocus] = useState("")
    const [funnelStage, setFunnelStage] = useState("")
    const [content, setContent] = useState("")
    const [monthYear, setMonthYear] = useState("")
    const [status, setStatus] = useState<Roteiro['status']>('criacao')

    useEffect(() => {
        if (!accountId) {
            toast.error("Conta não especificada.")
            router.push('/roteiros')
            return
        }

        if (id) {
            const loadRoteiro = async () => {
                setIsLoading(true)
                const data = await getRoteiroById(id)
                if (data) {
                    setRoteiro(data)
                    setTitle(data.title || "")
                    setFocus(data.focus || "")
                    setFunnelStage(data.funnel_stage || "")
                    setContent(data.content || "")
                    setMonthYear(data.month_year || "")
                    setStatus(data.status || 'criacao')

                    const comments = await getRoteiroComments(data.id)
                    if (comments && comments.length > 0) {
                        setLatestComment(comments[0])
                    }
                } else {
                    toast.error("Roteiro não encontrado.")
                    router.push(accountId ? `/roteiros?account=${accountId}` : '/roteiros')
                }
                setIsLoading(false)
            }
            loadRoteiro()
        } else {
            setMonthYear(defaultMonth || format(new Date(), 'yyyy-MM'))
        }
    }, [id, accountId, defaultMonth, router])

    const handleSave = async (sendForApproval: boolean, explicitStatus?: Roteiro['status']) => {
        if (!accountId) return
        if (!title || !focus || !funnelStage || !monthYear) {
            toast.error("Preencha todos os campos obrigatórios.")
            return
        }

        setIsSaving(true)
        const toastId = toast.loading("Salvando roteiro...")

        const payload: Partial<Roteiro> = {
            id: roteiro?.id,
            title,
            focus,
            funnel_stage: funnelStage,
            content,
            month_year: monthYear,
            status: explicitStatus ? explicitStatus : status
        }

        const res = await saveRoteiro(accountId, payload)

        setIsSaving(false)
        if (res.error) {
            toast.error("Erro ao salvar: " + res.error, { id: toastId })
        } else {
            toast.success("Roteiro salvo com sucesso!", { id: toastId })
            router.push(accountId ? `/roteiros?account=${accountId}` : '/roteiros') // Voltar para a página de roteiros com o filtro da conta
        }
    }

    const handleDeleteClick = () => {
        if (!roteiro?.id) {
            router.push(accountId ? `/roteiros?account=${accountId}` : '/roteiros')
            return
        }
        setShowDeleteAlert(true)
    }

    const confirmDelete = async () => {
        setIsDeleting(true)
        setShowDeleteAlert(false)
        const toastId = toast.loading("Apagando roteiro...")
        const res = await deleteRoteiro(roteiro!.id)
        setIsDeleting(false)

        if (res.error) {
            toast.error("Erro ao apagar: " + res.error, { id: toastId })
        } else {
            toast.success("Roteiro apagado.", { id: toastId })
            router.push(accountId ? `/roteiros?account=${accountId}` : '/roteiros')
        }
    }

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-12">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push(accountId ? `/roteiros?account=${accountId}` : '/roteiros')} disabled={isSaving || isDeleting}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold">{roteiro ? "Editar Roteiro" : "Novo Roteiro de Vídeo"}</h1>
                        <p className="text-sm text-slate-500">Escreva o script e defina as configurações do lado direito.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto mt-2 md:mt-0">
                    <Button
                        variant="destructive"
                        onClick={handleDeleteClick}
                        disabled={isSaving || isDeleting}
                        className="flex-1 md:flex-none gap-2"
                    >
                        {roteiro ? <Trash2 className="w-4 h-4" /> : null}
                        {roteiro ? "Apagar" : "Cancelar"}
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => handleSave(false)}
                        disabled={isSaving || isDeleting}
                        className="flex-1 md:flex-none"
                    >
                        {roteiro?.id ? "Salvar Alteração" : "Salvar Rascunho"}
                    </Button>
                    <Button
                        className={(status === 'liberado' || status === 'em_gravacao')
                            ? "bg-amber-500 hover:bg-amber-600 text-white flex-1 md:flex-none"
                            : "bg-blue-600 hover:bg-blue-700 text-white flex-1 md:flex-none"}
                        onClick={() => {
                            if (status === 'liberado' || status === 'em_gravacao') {
                                handleSave(false, 'criacao') 
                            } else {
                                handleSave(false, 'liberado')
                            }
                        }}
                        disabled={isSaving || isDeleting}
                    >
                        {(status === 'liberado' || status === 'em_gravacao') ? "Remover da Área do Cliente" : "Enviar p/ Área do Cliente"}
                    </Button>
                </div>
            </div>

            {/* Editor Content */}
            {isLoading ? (
                <div className="flex items-center justify-center p-12">
                    <div className="text-slate-500">Carregando roteiro...</div>
                </div>
            ) : (
                <div className="flex flex-col gap-6 items-start w-full">
                    {/* Top Configuration & Comments Row */}
                    <div className="flex flex-col xl:flex-row gap-6 w-full">
                        {/* Configurações (Esquerda) */}
                        <div className="flex-1 bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-xl border shadow-sm flex flex-col gap-6 min-w-0">
                            <Input
                                id="title"
                                placeholder="Título do Post (ex: 3 Dicas contra olho seco...)"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="text-2xl sm:text-3xl font-bold border-2 border-slate-200 dark:border-slate-800 focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg shadow-sm px-4 py-6 min-h-[64px] transition-all bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white focus:bg-white placeholder:text-slate-300 dark:placeholder:text-slate-700 hover:border-blue-300"
                            />

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="monthYear" className="text-xs text-slate-500 font-semibold uppercase">Mês Alvo *</Label>
                                    <Input
                                        id="monthYear"
                                        type="month"
                                        value={monthYear}
                                        onChange={(e) => setMonthYear(e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-900 border-slate-200"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="focus" className="text-xs text-slate-500 font-semibold uppercase">Foco do Anúncio *</Label>
                                    <Select value={focus} onValueChange={setFocus}>
                                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200">
                                            <SelectValue placeholder="Selecione o Foco" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Atrair Seguidores">Atrair Seguidores</SelectItem>
                                            <SelectItem value="Conversão de Consultas">Conversão de Consultas</SelectItem>
                                            <SelectItem value="Engajamento Geral">Engajamento Geral</SelectItem>
                                            <SelectItem value="Autoridade/Conteúdo Forte">Autoridade/Conteúdo Forte</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="funnelStage" className="text-xs text-slate-500 font-semibold uppercase">Etapa do Funil *</Label>
                                    <Select value={funnelStage} onValueChange={setFunnelStage}>
                                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200">
                                            <SelectValue placeholder="Selecione a Etapa" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Topo de Funil">Topo de Funil</SelectItem>
                                            <SelectItem value="Meio de Funil">Meio de Funil</SelectItem>
                                            <SelectItem value="Fundo de Funil">Fundo de Funil</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-xs text-slate-500 font-semibold uppercase">Status Atual</Label>
                                    <Select value={status} onValueChange={(v: Roteiro['status']) => setStatus(v)}>
                                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-slate-200 font-bold text-xs uppercase tracking-wider h-10 shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="criacao">Em Criação</SelectItem>
                                            <SelectItem value="liberado">Área do Cliente</SelectItem>
                                            <SelectItem value="em_gravacao">Em Gravação</SelectItem>
                                            <SelectItem value="gravado">Gravado</SelectItem>
                                            <SelectItem value="postado">Postado</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Comentários (Direita, mesma linha) */}
                        <div className="w-full xl:w-[350px] flex-shrink-0">
                            {roteiro?.id ? (
                                <>
                                    {latestComment ? (
                                        <div
                                            onClick={() => setCommentsOpen(true)}
                                            className="bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900 transition-colors cursor-pointer p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between group h-full min-h-[180px]"
                                        >
                                            <div className="flex items-start gap-4">
                                                <Avatar className="h-10 w-10 border shadow-sm">
                                                    <AvatarImage src={latestComment.user?.avatar_url} className="object-cover w-full h-full" />
                                                    <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs">
                                                        {latestComment.user?.name?.substring(0, 2).toUpperCase() || "??"}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0 flex flex-col">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200 truncate pr-2">{latestComment.user?.name}</span>
                                                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                                            {format(new Date(latestComment.created_at), "dd MMM HH:mm", { locale: ptBR })}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3 whitespace-pre-wrap leading-relaxed mt-1">
                                                        {latestComment.content}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex justify-end">
                                                <Button variant="ghost" size="sm" className="h-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-slate-900 font-semibold px-2">
                                                    Ver Comentários <ArrowRight className="ml-1 h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => setCommentsOpen(true)}
                                            className="h-full min-h-[180px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-white/50 hover:bg-slate-50 dark:bg-slate-950/50 dark:hover:bg-slate-900 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 group p-6"
                                        >
                                            <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform mb-1">
                                                <Edit2 className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                                            </div>
                                            <span className="text-slate-700 dark:text-slate-300 font-bold text-[15px] block">Nenhuma nota publicada</span>
                                            <p className="text-slate-500 dark:text-slate-400 text-xs max-w-[200px]">Comece adicionando os destaques do roteiro.</p>
                                            <span className="text-blue-600 dark:text-blue-500 font-semibold text-xs mt-1 group-hover:underline">Escrever agora</span>
                                        </div>
                                    )}

                                    <Sheet open={commentsOpen} onOpenChange={setCommentsOpen}>
                                        <SheetContent side="right" className="w-[90vw] sm:max-w-[450px] sm:w-[450px] p-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                                            <SheetHeader className="p-6 border-b bg-white dark:bg-slate-900">
                                                <SheetTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                                    <MessageSquare className="h-5 w-5 text-blue-500" />
                                                    Comentários
                                                </SheetTitle>
                                                <SheetDescription>
                                                    Deixe notas, sugestões ou dúvidas sobre este roteiro.
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
                                                <RoteiroCommentsArea roteiroId={roteiro.id} />
                                            </div>
                                        </SheetContent>
                                    </Sheet>
                                </>
                            ) : (
                                <div className="bg-white/50 dark:bg-slate-950/50 p-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-800 text-center flex flex-col items-center justify-center gap-2 h-full min-h-[220px]">
                                    <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center opacity-50 mb-2">
                                        <MessageSquare className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Comentários Indisponíveis</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 max-w-[200px]">
                                        Salve o roteiro pela primeira vez para liberar esta área.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Editor Area (Bloco inteiro abaixo das configs/comentarios) */}
                    <div className="w-full bg-white dark:bg-slate-950 p-6 sm:p-8 rounded-xl border shadow-sm flex flex-col gap-6 min-w-0">
                        <div className="min-h-[500px]">
                            <TiptapEditor
                                value={content}
                                onChange={setContent}
                            />
                        </div>
                    </div>
                </div>
            )}

            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. Isso irá apagar permanentemente este roteiro e todos os comentários associados a ele.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {isDeleting ? "Apagando..." : "Sim, apagar roteiro"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
