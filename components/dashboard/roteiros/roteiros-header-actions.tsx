"use client"

import { Link as LinkIcon, ExternalLink, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as React from "react"
import { toast } from "sonner"
import { getPublicLink } from "@/components/dashboard/share-actions"

export function RoteirosHeaderActions({ accountId }: { accountId: string }) {
    const [isCopied, setIsCopied] = React.useState(false)

    const handleShare = async (mode: 'copy' | 'open') => {
        if (!accountId) {
            toast.error("Nenhuma conta selecionada")
            return
        }

        const toastId = toast.loading("Gerando link...")
        // Reusing the same public link generator from metrics
        const { url, error } = await getPublicLink(accountId)

        if (error || !url) {
            toast.error("Erro ao gerar link", { id: toastId })
            return
        }

        if (mode === 'copy') {
            await navigator.clipboard.writeText(url)
            toast.success("Link copiado para a área de transferência!", { id: toastId })
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } else {
            toast.dismiss(toastId)
            // Redirect straight to Roteiros tab
            window.open(`${url}?view=roteiros`, '_blank')
        }
    }

    return (
        <div className="flex w-full md:w-auto items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                className="flex-1 md:flex-none gap-2"
                onClick={() => handleShare('copy')}
            >
                {isCopied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                <span className="whitespace-nowrap">{isCopied ? "Copiado!" : "Copiar Link"}</span>
            </Button>
            <Button
                size="sm"
                className="flex-1 md:flex-none gap-2 bg-blue-600 hover:bg-blue-700 text-white h-9"
                onClick={() => handleShare('open')}
            >
                <ExternalLink className="h-4 w-4" />
                <span className="whitespace-nowrap">Área do Cliente</span>
            </Button>
        </div>
    )
}
