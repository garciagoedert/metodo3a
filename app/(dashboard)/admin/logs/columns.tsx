"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { ArrowUpDown, MoreHorizontal, RotateCcw, Loader2, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { restoreUser, permanentDeleteUser } from "../team/actions"

export type LogEntry = {
    id: string
    created_at: string
    user_name: string | null
    user_email: string | null
    action: string
    status: "success" | "warning" | "error"
    details: string | null
}

const LogActions = ({ log }: { log: LogEntry }) => {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [restoreOpen, setRestoreOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const isDeleteAction = log.action === "Exclusão de Usuário" && log.status === "success"

    // Extract UUID from details: "Desativou usuário ID <UUID>"
    const targetUserId = isDeleteAction && log.details
        ? log.details.match(/ID ([0-9a-fA-F-]+)/)?.[1]
        : null

    const handleRestore = async () => {
        if (!targetUserId) return
        setIsLoading(true)
        const res = await restoreUser(targetUserId)
        setIsLoading(false)
        setRestoreOpen(false)

        if (res?.error) {
            alert("Erro ao restaurar: " + res.error)
        } else {
            router.refresh()
        }
    }

    const handlePermanentDelete = async () => {
        if (!targetUserId) return
        setIsLoading(true)
        const res = await permanentDeleteUser(targetUserId)
        setIsLoading(false)
        setDeleteOpen(false)

        if (res?.error) {
            alert("Erro ao excluir: " + res.error)
        } else {
            router.refresh()
        }
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Ações</DropdownMenuLabel>
                    <DropdownMenuItem
                        onClick={() => navigator.clipboard.writeText(log.id)}
                    >
                        Copiar ID do Log
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                    {targetUserId && (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); setRestoreOpen(true); }}
                                className="text-green-600 focus:text-green-700 bg-green-50 focus:bg-green-100 font-medium cursor-pointer"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Restaurar Usuário
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onSelect={(e) => { e.preventDefault(); setDeleteOpen(true); }}
                                className="text-red-600 focus:text-red-700 bg-red-50 focus:bg-red-100 font-medium cursor-pointer"
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir Permanentemente
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Restore Dialog */}
            <AlertDialog open={restoreOpen} onOpenChange={setRestoreOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar este usuário?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Isso devolverá o acesso ao usuário alvo desta ação.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleRestore(); }} disabled={isLoading} className="bg-green-600 focus:ring-green-600 hover:bg-green-700">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sim, restaurar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Permanent Delete Dialog */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription className="text-red-600 font-medium">
                            ATENÇÃO: Esta ação é irreversível.
                        </AlertDialogDescription>
                        <AlertDialogDescription>
                            Isso apagará todos os dados do usuário, incluindo histórico e logs associados, de forma definitiva.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handlePermanentDelete(); }} disabled={isLoading} className="bg-red-600 focus:ring-red-600 hover:bg-red-700">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sim, excluir para sempre
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

export const columns: ColumnDef<LogEntry>[] = [
    {
        accessorKey: "created_at",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    Data/Hora
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => {
            const date = new Date(row.getValue("created_at"))
            return date.toLocaleString('pt-BR')
        }
    },
    {
        accessorKey: "user_name",
        header: "Usuário",
        cell: ({ row }) => {
            return (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.user_name}</span>
                    <span className="text-xs text-muted-foreground">{row.original.user_email}</span>
                </div>
            )
        },
    },
    {
        accessorKey: "action",
        header: "Ação",
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue("status") as string
            return (
                <Badge
                    variant={
                        status === "success" ? "default" :
                            status === "error" ? "destructive" : "secondary"
                    }
                    className={
                        status === "success" ? "bg-green-600 hover:bg-green-700" :
                            status === "warning" ? "bg-amber-600 hover:bg-amber-700" : ""
                    }
                >
                    {status === "success" && "Sucesso"}
                    {status === "warning" && "Atenção"}
                    {status === "error" && "Erro"}
                </Badge>
            )
        },
    },
    {
        id: "actions",
        cell: ({ row }) => <LogActions log={row.original} />,
    },
]
