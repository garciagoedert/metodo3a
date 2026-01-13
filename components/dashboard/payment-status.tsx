"use client"

import { useEffect, useState } from "react"
import { getAccountPaymentStatus } from "@/app/(dashboard)/actions"
import { CreditCard, AlertCircle, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
// Use Popover for better mobile support (click instead of hover)
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface PaymentData {
    status: number
    disable_reason: number
    balance: number
    currency: string
    is_prepay_account: boolean
    amount_spent: number
    timezone_offset_hours_utc?: number
}

export function PaymentStatus({ accountId, className }: { accountId?: string, className?: string }) {
    const [data, setData] = useState<PaymentData | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(false)

    useEffect(() => {
        if (!accountId) {
            setData(null)
            return
        }

        let isMounted = true
        setLoading(true)
        setError(false)

        getAccountPaymentStatus(accountId)
            .then(res => {
                if (isMounted) {
                    setData(res)
                    setLoading(false)
                }
            })
            .catch(() => {
                if (isMounted) {
                    setError(true)
                    setLoading(false)
                }
            })

        return () => { isMounted = false }
    }, [accountId])

    if (!accountId) return null
    if (loading) return <div className={cn("h-9 w-32 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md", className)} />
    if (error || !data) return null

    // Logic for Display
    const isPrepay = data.is_prepay_account
    const currency = data.currency || 'BRL'

    // Formatting Balance
    const divisor = ['JPY', 'CLP', 'KRW', 'VND'].includes(currency) ? 1 : 100
    const rawBalance = Math.abs(Number(data.balance))
    const balanceValue = rawBalance / divisor

    const formattedBalance = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency
    }).format(balanceValue)

    // PAYMENT PROBLEM DETECTION
    const hasPaymentIssue = data.status === 3 || data.status === 2 || data.disable_reason === 4

    if (isPrepay) {
        // MANUAL/PREPAY
        const isLowBalance = balanceValue < 50
        const isEmpty = balanceValue <= 1

        const statusColor = isEmpty ? "bg-red-100 text-red-700 border-red-200" :
            isLowBalance ? "bg-amber-100 text-amber-700 border-amber-200" :
                "bg-emerald-100 text-emerald-700 border-emerald-200"

        const Icon = isEmpty ? AlertCircle : Wallet

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors cursor-pointer", statusColor, className)}>
                        <Icon className="h-4 w-4" />
                        <div className="flex flex-col leading-none gap-0.5">
                            <span className="text-[10px] uppercase font-bold opacity-80">Saldo Pré-pago</span>
                            <span>{formattedBalance}</span>
                        </div>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Conta Pré-paga</h4>
                        <p className="text-sm text-muted-foreground">
                            Este é o saldo disponível para veiculação de anúncios.
                            {isEmpty
                                ? " Seus anúncios podem estar pausados por falta de saldo."
                                : isLowBalance
                                    ? " Recomendamos recarregar em breve."
                                    : " Seu saldo está saudável."}
                        </p>
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="text-xs text-muted-foreground">Status da Conta:</span>
                            <span className={cn("text-xs font-bold", isEmpty ? "text-red-500" : "text-green-600")}>
                                {isEmpty ? "Saldo Insuficiente" : "Ativa"}
                            </span>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        )
    } else {
        // AUTOMATIC/POSTPAID
        const statusColor = hasPaymentIssue ? "bg-red-100 text-red-700 border-red-200" :
            "bg-slate-100 text-slate-700 border-slate-200"

        return (
            <Popover>
                <PopoverTrigger asChild>
                    <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium transition-colors cursor-pointer", statusColor, className)}>
                        {hasPaymentIssue ? <AlertCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                        <div className="flex flex-col leading-none gap-0.5">
                            <span className="text-[10px] uppercase font-bold opacity-80">Pagamento</span>
                            <span>{hasPaymentIssue ? "Problema Detectado" : "Cartão Automático"}</span>
                        </div>
                    </div>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="space-y-2">
                        <h4 className="text-sm font-semibold">{hasPaymentIssue ? "Detalhes do Erro" : "Status de Pagamento"}</h4>
                        <p className="text-sm text-muted-foreground">
                            {hasPaymentIssue
                                ? "Ocorreu um erro ao processar o pagamento. Verifique o método de pagamento no Gerenciador de Anúncios."
                                : "A cobrança é realizada automaticamente no cartão cadastrado."
                            }
                        </p>
                        <div className="flex justify-between pt-2 border-t mt-2">
                            <span className="text-xs text-muted-foreground">Gasto Atual (não faturado):</span>
                            <span className="text-xs font-mono">{formattedBalance}</span>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        )
    }
}
