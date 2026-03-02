"use client"

import React, { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { saveRoteirosNotice } from "@/app/(dashboard)/actions/roteiros"
import { toast } from "sonner"
import { Lightbulb } from "lucide-react"

interface CustomNoticeDialogProps {
    accountId: string
    initialNotice: string | null
    isOpen: boolean
    onClose: () => void
}

export function CustomNoticeDialog({ accountId, initialNotice, isOpen, onClose }: CustomNoticeDialogProps) {
    const [notice, setNotice] = useState(initialNotice || "")
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setNotice(initialNotice || "")
        }
    }, [isOpen, initialNotice])

    const handleSave = async () => {
        setIsSubmitting(true)
        const toastId = toast.loading("Salvando aviso...")

        try {
            // Nullify if empty so it falls back to default
            const valueToSave = notice.trim() ? notice : null
            const result = await saveRoteirosNotice(accountId, valueToSave)

            if (result && result.error) {
                toast.error(result.error, { id: toastId })
            } else {
                toast.success("Aviso atualizado com sucesso!", { id: toastId })
                onClose()
            }
        } catch (error) {
            toast.error("Erro inesperado", { id: toastId })
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleReset = () => {
        setNotice("")
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-amber-500" />
                        Configurar Aviso do Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Personalize a mensagem "Lembre-se" que aparece na Área do Cliente acima dos roteiros.
                        Deixe em branco para usar a mensagem padrão do sistema.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Textarea
                        value={notice}
                        onChange={(e) => setNotice(e.target.value)}
                        placeholder="Ex: O roteiro é um suporte para a sua autoridade..."
                        className="min-h-[150px] resize-none"
                    />

                    <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200">
                        <strong className="font-semibold block mb-1">Preview de como vai aparecer:</strong>
                        <span className="whitespace-pre-wrap">{notice || "O roteiro é um suporte para a sua autoridade, mas é o seu jeito de falar que gera conexão e confiança. Nós cuidamos da sua comunicação e você entra com o que mais importa: a sua especialidade e técnica. Use nosso roteiro como uma referência e faça o ajuste necessário no desenvolvimento para que ele reflita exatamente a forma como você explica os tratamentos no consultório."}</span>
                    </div>
                </div>

                <DialogFooter className="flex justify-between items-center w-full sm:justify-between">
                    <Button variant="ghost" onClick={handleReset} className="text-slate-500 hover:text-slate-700">
                        Restaurar Padrão
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isSubmitting ? "Salvando..." : "Salvar Aviso"}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
} 
