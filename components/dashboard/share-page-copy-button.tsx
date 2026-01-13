"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Link as LinkIcon, Check } from "lucide-react"
import { toast } from "sonner"

export function SharePageCopyButton() {
    const [copied, setCopied] = useState(false)

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href)
            setCopied(true)
            toast.success("Link copiado!")
            setTimeout(() => setCopied(false), 2000)
        } catch (e) {
            toast.error("Erro ao copiar link")
        }
    }

    return (
        <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 shrink-0"
            onClick={handleCopy}
            title={copied ? "Copiado!" : "Copiar Link"}
        >
            {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            <span className="whitespace-nowrap hidden md:inline">{copied ? "Copiado!" : "Copiar Link"}</span>
        </Button>
    )
}
