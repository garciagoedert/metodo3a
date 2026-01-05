"use client"

import { useState, useEffect } from "react"

import { getMonthlyComments, addComment, deleteComment, updateComment, getTeamMembers } from "./comments-actions"
import { Trash2, User, PlusCircle, PenLine, GripHorizontal, Edit3 } from "lucide-react"


import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { toast } from "sonner"
import ReactMarkdown from 'react-markdown'
import { cn } from "@/lib/utils"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Import Tiptap
import { TiptapEditor } from "@/components/ui/tiptap-editor"

interface AnalysisFeedProps {
    accountId: string
    month: string // YYYY-MM-01
    isLoggedIn: boolean
}

function RenderContent({ content }: { content: string }) {
    // Simple heuristic: if it contains HTML tags, treat as HTML.
    // Tiptap content usually starts with <p>, <h2>, blockquote, etc.
    // Legacy content is plain text or markdown.
    const isHtml = /<[a-z][\s\S]*>/i.test(content)

    if (isHtml) {
        return (
            <div
                className="prose prose-slate max-w-none prose-headings:font-bold prose-h2:text-xl prose-h3:text-lg prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-strong:text-slate-900 prose-a:text-blue-600 prose-blockquote:border-l-4 prose-blockquote:border-blue-200 prose-blockquote:pl-4 prose-blockquote:italic"
                dangerouslySetInnerHTML={{ __html: content }}
            />
        )
    }

    // Legacy Markdown Fallback
    return (
        <div className="prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-strong:text-slate-900">
            <ReactMarkdown
                components={{
                    h1: ({ node, ...props }) => <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3 tracking-tight" {...props} />,
                    h2: ({ node, ...props }) => <h4 className="text-lg font-bold text-slate-800 mt-5 mb-2" {...props} />,
                    ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 mb-4 marker:text-blue-500" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-2 mb-4 marker:text-blue-500" {...props} />,
                    li: ({ node, ...props }) => <li className="text-slate-700 pl-1" {...props} />,
                    p: ({ node, ...props }) => <p className="mb-4 last:mb-0 text-slate-700 leading-7" {...props} />,
                    strong: ({ node, ...props }) => <span className="font-bold text-slate-900" {...props} />,
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-blue-200 pl-4 py-1 my-4 bg-blue-50/50 rounded-r italic text-slate-700" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    )
}

const formatRole = (role?: string) => {
    switch (role) {
        case 'admin':
        case 'cs_manager':
            return 'Líder de Customer Success'
        case 'traffic_manager':
            return 'Gestor de Tráfego'
        case 'cs_agent':
            return 'Agente de Customer Success'
        default:
            return role || 'Membro da Equipe'
    }
}

export function AnalysisFeed({ accountId, month, isLoggedIn }: AnalysisFeedProps) {
    const [comments, setComments] = useState<any[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [newComment, setNewComment] = useState("")
    const [newHeadline, setNewHeadline] = useState("")
    const [selectedAuthor, setSelectedAuthor] = useState<string>("")
    const [sending, setSending] = useState(false)
    const [addDialogOpen, setAddDialogOpen] = useState(false)

    const [editingId, setEditingId] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true
        async function load() {
            setLoading(true)
            const [data, team] = await Promise.all([
                getMonthlyComments(accountId, month),
                isLoggedIn ? getTeamMembers() : Promise.resolve([])
            ])

            if (mounted) {
                setComments(data || [])
                setMembers(team || [])
                setLoading(false)
            }
        }
        load()
        return () => { mounted = false }
    }, [accountId, month, isLoggedIn])

    const handleSend = async () => {
        // Tiptap returns "<p></p>" or empty string for empty.
        if (!newComment.trim() || newComment === "<p></p>") return
        setSending(true)

        let res
        if (editingId) {
            res = await updateComment(editingId, newComment, newHeadline || undefined)
        } else {
            res = await addComment(accountId, month, newComment, newHeadline || undefined, selectedAuthor || undefined)
        }

        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(editingId ? "Análise atualizada!" : "Análise adicionada!")
            setNewComment("")
            setNewHeadline("")
            setEditingId(null)
            setAddDialogOpen(false)
            setSelectedAuthor("") // Reset
            // Refresh
            const data = await getMonthlyComments(accountId, month)
            setComments(data || [])
        }
        setSending(false)
    }

    const startEditing = (comment: any) => {
        setEditingId(comment.id)
        setNewComment(comment.content)
        setNewHeadline(comment.headline || "")
        // Author cannot be changed easily (maybe later?)
        setAddDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        const res = await deleteComment(id)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success("Análise removida.")
            setComments(prev => prev.filter(c => c.id !== id))
        }
    }

    if (loading) return <div className="h-40 animate-pulse bg-slate-50 rounded-xl"></div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-end">
                {isLoggedIn && (
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 text-blue-600 border-blue-100 hover:bg-blue-50">
                                <PlusCircle className="h-4 w-4" />
                                Adicionar Nota
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader>
                                <DialogTitle>{editingId ? "Editar Análise" : "Adicionar Análise"}</DialogTitle>
                                <DialogDescription>
                                    Use o editor abaixo para formatar sua análise com títulos, listas e destaques.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">

                                {members.length > 0 && (
                                    <div className="flex flex-col gap-2">
                                        <label className="text-sm font-medium text-slate-700">Assinar como (membro da equipe):</label>
                                        <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                                            <SelectTrigger className="w-[280px]">
                                                <SelectValue placeholder="Selecione um membro..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {members.map(m => (
                                                    <SelectItem key={m.id} value={m.id}>
                                                        {m.full_name} ({formatRole(m.role)})
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-slate-700">Manchete / Destaque (Opcional):</label>
                                    <input
                                        type="text"
                                        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                        placeholder="Ex: Dezembro 2025: Fechando o Ano com Chave de Ouro..."
                                        value={newHeadline}
                                        onChange={(e) => setNewHeadline(e.target.value)}
                                    />
                                </div>

                                <TiptapEditor
                                    value={newComment}
                                    onChange={setNewComment}
                                />

                                <div className="flex justify-end gap-2">
                                    <Button variant="ghost" onClick={() => setAddDialogOpen(false)}>Cancelar</Button>
                                    <Button onClick={handleSend} disabled={sending}>
                                        {sending ? "Salvando..." : "Salvar Análise"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {comments.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
                    <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                        <PenLine className="h-6 w-6 text-slate-400" />
                    </div>
                    <h4 className="text-slate-900 font-medium mb-1">Nenhuma análise publicada</h4>
                    <p className="text-slate-500 text-sm">
                        {isLoggedIn ? "Comece adicionando os destaques do mês." : "Aguardando análise da equipe."}
                    </p>
                    {isLoggedIn && (
                        <Button variant="link" onClick={() => setAddDialogOpen(true)} className="mt-2 text-blue-600">
                            Escrever agora
                        </Button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    {comments.map((comment, index) => (
                        <div key={comment.id} className={cn("p-8 md:p-10 relative group", index !== 0 && "border-t border-slate-100")}>
                            {/* Author Header */}
                            <div className="flex items-center gap-5 mb-6">
                                <Avatar className="h-24 w-24 border border-slate-100 shadow-sm">
                                    <AvatarImage src={comment.author?.avatar_url} className="object-cover w-full h-full" />
                                    <AvatarFallback className="bg-slate-50 text-slate-400">
                                        <User className="h-8 w-8" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 leading-none mb-1">
                                        {comment.author?.full_name || "Membro da Equipe"}
                                    </div>
                                    <div className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                                        {formatRole(comment.author?.role)}
                                    </div>
                                </div>
                                {isLoggedIn && (
                                    <div className="ml-auto flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => startEditing(comment)}
                                            className="text-blue-400 hover:text-blue-600 hover:bg-blue-50"
                                        >
                                            <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleDelete(comment.id)}
                                            className="text-red-400 hover:text-red-600 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {/* Headline (Highlight) */}
                            {comment.headline && (
                                <h3 className="text-xl font-bold text-slate-800 mb-3 leading-tight">
                                    {comment.headline}
                                </h3>
                            )}

                            {/* Content Viewer (HTML or Markdown) */}
                            <RenderContent content={comment.content} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
