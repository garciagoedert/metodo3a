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
import { submitRoteiroApproval, getPublicRoteiroCommentCount } from "@/components/dashboard/share-actions"
import { toast } from "sonner"
import { CheckCircle2, XCircle, Clock, Eye, FileText, MessageSquare } from "lucide-react"
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

    const handleAction = async (action: 'approve' | 'request_changes') => {
        setIsSubmitting(true)
        const toastId = toast.loading("Enviando avaliação...")

        try {
            const result = await submitRoteiroApproval(token, roteiro.id, action)

            if (result.error) {
                toast.error(result.error, { id: toastId })
            } else if (result.success && result.newStatus) {
                toast.success(action === 'approve' ? "Roteiro Aprovado!" : "Alteração Solicitada!", { id: toastId })
                onStatusChange(roteiro.id, result.newStatus)
                onClose()
            }
        } catch (error) {
            toast.error("Erro inesperado ao enviar avaliação", { id: toastId })
        } finally {
            setIsSubmitting(false)
        }
    }

    const isAprovado = roteiro.status === 'aprovado'

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-[90vw] sm:max-w-[800px] sm:w-[800px] overflow-y-auto p-0 flex flex-col bg-white dark:bg-slate-950">
                <SheetHeader className="p-8 pb-6 border-b bg-white dark:bg-slate-950 sticky top-0 z-10 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                                <FileText className="h-6 w-6 text-blue-600" />
                                {roteiro.title || "Roteiro sem Título"}
                            </SheetTitle>
                            <SheetDescription className="mt-2 text-base text-slate-600">
                                Revise o conteúdo preparado para <span className="font-semibold text-slate-800">{roteiro.month_year}</span>
                            </SheetDescription>
                        </div>

                        {/* Status Badge */}
                        <div className={cn("px-4 py-2 rounded-full border text-sm font-bold whitespace-nowrap flex items-center gap-2",
                            isAprovado
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                        )}>
                            {isAprovado ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                            {isAprovado ? "Aprovado" : "Aguardando Aprovação"}
                        </div>
                    </div>
                </SheetHeader>

                <div className="p-8 md:p-10 flex-1 min-h-[300px]">
                    <div className="prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed text-base"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(roteiro.content || '<p class="text-slate-400 italic">Nenhum conteúdo adicionado.</p>') }}
                    />
                </div>

                <div className="p-6 md:px-8 border-t bg-white dark:bg-slate-950 flex items-center justify-between gap-3 sticky bottom-0 z-10 mt-auto shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    {(() => {
                        const showCommentsButton = isLoggedIn || dynamicCommentCount > 0;

                        return showCommentsButton ? (
                            <Button variant="outline" onClick={() => setIsCommentsOpen(true)} className="h-11 px-6 gap-2 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 hover:text-blue-800">
                                <MessageSquare className="w-5 h-5" />
                                Comentários
                                {dynamicCommentCount > 0 && <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">{dynamicCommentCount}</span>}
                            </Button>
                        ) : <div />;
                    })()}

                    <div className="flex gap-3">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="h-11 px-6">
                            Fechar
                        </Button>

                        {!isAprovado && (
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 px-6 font-semibold"
                                onClick={() => handleAction('approve')}
                                disabled={isSubmitting}
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Aprovar Roteiro
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
