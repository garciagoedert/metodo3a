"use client"

import { Menu, Link as LinkIcon, ExternalLink, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import * as React from "react"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ClientSelector } from "./client-selector"
import { DateRangePicker } from "./date-range-picker"
import { Sidebar } from "./Sidebar"
import { useUserRole } from "@/hooks/use-user-role"
import { toast } from "sonner"
import { getPublicLink } from "./share-actions"
import { PaymentStatus } from "./payment-status"

export function Header({ dateRange, accounts = [], currentAccountId }: {
    dateRange?: { from: Date, to: Date },
    accounts?: { provider_account_id: string, name: string }[],
    currentAccountId?: string
}) {
    const { role } = useUserRole()
    const [isCopied, setIsCopied] = React.useState(false)

    const handleShare = async (mode: 'copy' | 'open') => {
        if (!currentAccountId) {
            toast.error("Selecione uma conta primeiro")
            return
        }

        const toastId = toast.loading("Gerando link...")
        const { url, error } = await getPublicLink(currentAccountId)

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
            window.open(url, '_blank')
        }
    }

    return (
        <header className="sticky top-0 z-40 w-full flex flex-col md:flex-row h-auto md:h-16 items-start md:items-center justify-between border-b bg-background px-6 py-4 md:py-0 gap-4 md:gap-0 shadow-sm">
            <div className="flex w-full md:w-auto items-center justify-between gap-4">
                <ClientSelector className="w-auto flex-1 md:w-[400px]" accounts={accounts} currentAccountId={currentAccountId} />
                <PaymentStatus accountId={currentAccountId} />
            </div>


            <div className="flex w-full md:w-auto flex-col md:flex-row items-stretch md:items-center gap-4">
                <DateRangePicker className="w-full md:w-auto" initialDate={dateRange} />

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
                        className="flex-1 md:flex-none gap-2 bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleShare('open')}
                    >
                        <ExternalLink className="h-4 w-4" />
                        <span className="whitespace-nowrap">Área do Cliente</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
