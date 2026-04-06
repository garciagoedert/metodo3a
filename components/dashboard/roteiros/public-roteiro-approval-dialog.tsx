"use client"

import React, { useState, useEffect } from "react"
import { type Roteiro } from "@/app/(dashboard)/actions/roteiros"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { updatePublicRoteiroStatus, getPublicRoteiroCommentCount } from "@/components/dashboard/share-actions"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Clock, Eye, FileText, MessageSquare, Copy } from "lucide-react"
import DOMPurify from 'isomorphic-dompurify'
import { cn } from "@/lib/utils"
import { RoteiroCommentsArea } from "./roteiro-comments"

interface PublicRoteiroApprovalDialogProps {
    roteiro: Roteiro | null
    isOpen: boolean
    onClose: () => void
    token: string
    onStatusChange: (roteiroId: string, newStatus: string) => void
    isLoggedIn: boolean
}

export function PublicRoteiroApprovalDialog({ roteiro, isOpen, onClose, token, onStatusChange, isLoggedIn }: PublicRoteiroApprovalDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isCommentsOpen, setIsCommentsOpen] = useState(false)
    const [dynamicCommentCount, setDynamicCommentCount] = useState<number>(0)

    useEffect(() => {
        let mounted = true
        if (roteiro && roteiro.id) {
            getPublicRoteiroCommentCount(token, roteiro.id).then((res) => {
                if (mounted && res && typeof res.count === 'number') {
                    setDynamicCommentCount(res.count)
                }
            }).catch(console.error)
        }
        return () => { mounted = false }
    }, [roteiro?.id, token])

    if (!roteiro) return null

    console.log("Roteiro passed to dialog (to check comments):", roteiro)

    const handleCopy = () => {
        if (!roteiro) return

        const tempDiv = document.createElement("div")
        tempDiv.innerHTML = roteiro.content || ""
        const plainTextContent = tempDiv.innerText || tempDiv.textContent || ""

        const copyText = `Título: ${roteiro.title || "Sem Título"}
Foco/Etapa: ${roteiro.funnel_stage || "Não especificado"}
Mês Alvo: ${roteiro.month_year}

Roteiro:
${plainTextContent.trim()}`

        navigator.clipboard.writeText(copyText).then(() => {
            toast.success("Roteiro copiado para a área de transferência!")
        }).catch(() => {
            toast.error("Erro ao copiar o roteiro.")
        })
    }

    const handleAction = async (newStatus: 'em_gravacao' | 'gravado' | 'postado' | 'liberado') => {
        setIsSubmitting(true)
        const toastId = toast.loading("Atualizando status...")

        try {
            const result = await updatePublicRoteiroStatus(token, roteiro.id, newStatus)

            if (result.error) {
                toast.error(result.error, { id: toastId })
            } else if (result.success && result.newStatus) {
                toast.success("Status atualizado com sucesso!", { id: toastId })
                onStatusChange(roteiro.id, result.newStatus)
                onClose()
            }
        } catch (error) {
            toast.error("Erro inesperado ao atualizar", { id: toastId })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-[800px] sm:w-[800px] p-0 flex flex-col h-full bg-white dark:bg-slate-950">
                <SheetHeader className="p-6 md:p-8 pb-6 border-b bg-white dark:bg-slate-950 shrink-0 relative">
                    <div className="flex items-start justify-between gap-4">
                        <div className="pr-6">
                            <SheetTitle className="text-xl md:text-2xl font-bold flex items-start gap-3 text-slate-800 text-left">
                                <FileText className="h-6 w-6 text-blue-600 shrink-0 md:mt-0.5" />
                                <span className="leading-tight">{roteiro.title || "Roteiro sem Título"}</span>
                            </SheetTitle>
                            <SheetDescription className="mt-2 text-base text-slate-600">
                                Revise o conteúdo preparado para <span className="font-semibold text-slate-800">{roteiro.month_year}</span>
                            </SheetDescription>
                        </div>

                        {roteiro.status === 'gravado' && (
                            <div className="px-4 py-2 rounded-full border text-sm font-bold whitespace-nowrap flex items-center gap-2 bg-purple-50 text-purple-700 border-purple-200">
                                <CheckCircle2 className="w-5 h-5" /> Gravado
                            </div>
                        )}
                        {roteiro.status === 'postado' && (
                            <div className="px-4 py-2 rounded-full border text-sm font-bold whitespace-nowrap flex items-center gap-2 bg-emerald-50 text-emerald-700 border-emerald-200">
                                <CheckCircle2 className="w-5 h-5" /> Postado
                            </div>
                        )}
                    </div>
                </SheetHeader>

                <div className="p-8 md:p-10 flex-1 min-h-0 overflow-y-auto">
                    <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed text-base pb-8"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(roteiro.content || '<p class="text-slate-400 italic">Nenhum conteúdo adicionado.</p>') }}
                    />
                </div>

                <div className="p-4 md:p-6 border-t bg-white dark:bg-slate-950 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] w-full">
                    <div className="flex w-full sm:w-auto gap-2">
                        {(() => {
                            const showCommentsButton = isLoggedIn || dynamicCommentCount > 0;

                            return showCommentsButton ? (
                                <Button variant="outline" onClick={() => setIsCommentsOpen(true)} className="flex-1 sm:flex-none h-11 px-3 sm:px-4 gap-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800 shrink-0">
                                    <MessageSquare className="w-5 h-5" />
                                    Comentários
                                    {dynamicCommentCount > 0 && <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">{dynamicCommentCount}</span>}
                                </Button>
                            ) : null;
                        })()}
                        
                        <Button variant="outline" onClick={handleCopy} className="flex-1 sm:flex-none h-11 px-3 sm:px-4 gap-2 text-slate-700 border-slate-200 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 shrink-0">
                            <Copy className="h-4 w-4" />
                            <span>Copiar Texto</span>
                        </Button>
                    </div>

                    <div className="flex w-full sm:w-auto gap-2 sm:ml-auto">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="flex-1 sm:flex-none h-11 px-2 sm:px-6 text-[11px] sm:text-sm">
                            Fechar
                        </Button>

                        {roteiro.status !== 'gravado' && roteiro.status !== 'postado' && (
                            <Button
                                className="flex-[2] sm:flex-none bg-purple-600 hover:bg-purple-700 text-white gap-2 h-11 px-2 sm:px-6 text-[11px] sm:text-sm font-semibold"
                                onClick={() => handleAction('gravado')}
                                disabled={isSubmitting}
                            >
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                Gravado
                            </Button>
                        )}
                        
                        {roteiro.status === 'gravado' && (
                            <>
                                <Button
                                    variant="outline"
                                    className="flex-[1.5] sm:flex-none h-11 px-1 sm:px-4 text-[11px] sm:text-sm whitespace-nowrap"
                                    onClick={() => handleAction('liberado')}
                                    disabled={isSubmitting}
                                >
                                    Voltar Etapa
                                </Button>
                                <Button
                                    className="flex-[1.5] sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white gap-1 sm:gap-2 h-11 px-1 sm:px-4 text-[11px] sm:text-sm font-semibold whitespace-nowrap"
                                    onClick={() => handleAction('postado')}
                                    disabled={isSubmitting}
                                >
                                    <CheckCircle2 className="w-4 h-4 shrink-0 hidden sm:block" />
                                    Postado
                                </Button>
                            </>
                        )}

                        {roteiro.status === 'postado' && (
                            <Button
                                variant="outline"
                                className="flex-[2] sm:flex-none h-11 px-2 sm:px-6 text-[11px] sm:text-sm whitespace-nowrap"
                                onClick={() => handleAction('gravado')}
                                disabled={isSubmitting}
                            >
                                Voltar p/ Gravado
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>

            {/* Comments Overlay Sheet */}
            <Sheet open={isCommentsOpen} onOpenChange={setIsCommentsOpen}>
                <SheetContent side="right" className="w-[90vw] sm:max-w-[450px] sm:w-[450px] p-0 flex flex-col h-full bg-slate-50 dark:bg-slate-950">
                    <SheetHeader className="p-6 border-b bg-white dark:bg-slate-900">
                        <SheetTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                            <MessageSquare className="h-5 w-5 text-blue-500" />
                            Comentários
                        </SheetTitle>
                        <SheetDescription>
                            Orientações e detalhes estruturais sobre este roteiro.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20">
                        <RoteiroCommentsArea roteiroId={roteiro.id} isPublic={true} token={token} />
                    </div>
                </SheetContent>
            </Sheet>
        </Sheet>
    )
}
