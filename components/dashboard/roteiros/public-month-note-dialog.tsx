"use client"

import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
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
import { saveAccountMonthNote } from "@/components/dashboard/share-actions"
import { toast } from "sonner"
import { format, parse } from "date-fns"
import { ptBR } from "date-fns/locale"
import { MessageSquareText, Trash2 } from "lucide-react"

interface PublicMonthNoteDialogProps {
    monthStr: string | null
    initialContent: string
    initialAuthorId: string
    authorName?: string | null
    authorAvatar?: string | null
    isOpen: boolean
    onClose: () => void
    token: string
    isLoggedIn: boolean
    onSave: (monthStr: string, newContent: string, authorId: string) => void
    teamMembers?: any[]
}

export function PublicMonthNoteDialog({ monthStr, initialContent, initialAuthorId, authorName, authorAvatar, isOpen, onClose, token, isLoggedIn, onSave, teamMembers = [] }: PublicMonthNoteDialogProps) {
    const [content, setContent] = useState(initialContent)
    const [authorId, setAuthorId] = useState(initialAuthorId)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [showDeleteAlert, setShowDeleteAlert] = useState(false)

    // Sync content when opened
    useEffect(() => {
        setContent(initialContent)
        setAuthorId(initialAuthorId)
    }, [initialContent, initialAuthorId, isOpen])

    if (!monthStr) return null

    const dateObj = parse(monthStr, 'yyyy-MM', new Date())
    const monthName = format(dateObj, 'MMMM yyyy', { locale: ptBR })

    const handleSave = async () => {
        setIsSubmitting(true)

        try {
            await onSave(monthStr, content, authorId)
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleDeleteClick = () => {
        setShowDeleteAlert(true)
    }

    const confirmDelete = async () => {
        setIsSubmitting(true)
        setShowDeleteAlert(false)

        try {
            await onSave(monthStr, "", "")
            setContent("")
            setAuthorId("")
            onClose()
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[90vw] sm:max-w-[800px] sm:w-[800px] overflow-y-auto p-0 flex flex-col">
                <SheetHeader className="p-8 pb-6 border-b bg-white">
                    <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <MessageSquareText className="h-6 w-6 text-blue-600" />
                        Estratégia: {monthName}
                    </SheetTitle>
                    <SheetDescription className="text-base text-slate-600">
                        {isLoggedIn
                            ? "Adicione um contexto ou observação geral sobre os roteiros deste mês para o seu cliente."
                            : "Recomendações e contexto estratégico para as gravações deste mês."}
                    </SheetDescription>
                </SheetHeader>

                <div className="p-8 flex-1 bg-slate-50/50 flex flex-col gap-6">
                    {isLoggedIn ? (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-8 flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700">Observações Estratégicas</label>
                                <Textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    placeholder="Ex: O foco deste mês será na conversão de consultas finais de ano..."
                                    className="min-h-[250px] resize-none text-base leading-relaxed p-4"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-semibold text-slate-700">Responsável pela Estratégia (Opcional)</label>
                                <Select value={authorId} onValueChange={setAuthorId} disabled={isSubmitting}>
                                    <SelectTrigger className="w-full h-12">
                                        <SelectValue placeholder="Selecione o membro da equipe..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {teamMembers.map(member => (
                                            <SelectItem key={member.id} value={member.id}>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-7 w-7">
                                                        <AvatarImage src={member.avatar_url || ''} className="object-cover" />
                                                        <AvatarFallback>{member.full_name?.charAt(0) || 'U'}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-medium">{member.full_name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden p-8 md:p-10">
                            {authorName && (
                                <div className="flex items-center gap-5 mb-8">
                                    <Avatar className="h-20 w-20 border border-slate-100 shadow-sm">
                                        <AvatarImage src={authorAvatar || ''} className="object-cover w-full h-full" />
                                        <AvatarFallback className="bg-slate-50 text-slate-400 text-2xl font-bold">
                                            {authorName.charAt(0)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="text-lg font-bold text-slate-900 leading-none mb-1.5">
                                            {authorName}
                                        </div>
                                        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                                            Responsável pela Estratégia
                                        </div>
                                    </div>
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-slate-800 mb-5 leading-tight">
                                Estratégia e Visão Geral – {monthName}
                            </h3>

                            <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed whitespace-pre-wrap text-base">
                                {content || <span className="italic text-slate-400">Nenhuma observação ou estratégia foi documentada para este mês.</span>}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 mt-auto">
                        {isLoggedIn && initialContent && (
                            <Button variant="ghost" onClick={handleDeleteClick} disabled={isSubmitting} className="h-11 px-4 text-red-500 hover:text-red-600 hover:bg-red-50/50 mr-auto">
                                <Trash2 className="w-4 h-4 mr-2" />
                                Excluir
                            </Button>
                        )}
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-11 px-6">
                            Fechar
                        </Button>
                        {isLoggedIn && (
                            <Button onClick={handleSave} disabled={isSubmitting} className="h-11 px-6 bg-blue-600 hover:bg-blue-700">
                                {isSubmitting ? "Salvando..." : "Salvar Alterações"}
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>

            {/* Custom Browser Alert */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Estratégia?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tem certeza que deseja apagar permanentemente todas as anotações e estratégias registradas neste mês?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => {
                            e.preventDefault()
                            confirmDelete()
                        }} className="bg-red-600 hover:bg-red-700 text-white" disabled={isSubmitting}>
                            {isSubmitting ? "Excluindo..." : "Sim, Excluir"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    )
}
