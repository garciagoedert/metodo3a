"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface ClientSelectorProps {
    className?: string
    accounts: { provider_account_id: string, name: string }[]
    currentAccountId?: string
}

export function ClientSelector({ className, accounts, currentAccountId }: ClientSelectorProps) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [open, setOpen] = React.useState(false)

    // Handle selection
    const handleSelect = (accountId: string) => {
        const params = new URLSearchParams(searchParams.toString())
        if (accountId) {
            params.set('account', accountId)
        } else {
            params.delete('account')
        }
        router.push(`${pathname}?${params.toString()}`)
        setOpen(false)
    }

    const currentAccountName = accounts.find(a => a.provider_account_id === currentAccountId)?.name || "Selecione o Cliente..."

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full md:w-[400px] justify-between", className)}
                >
                    <span className="truncate">{currentAccountName}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput placeholder="Buscar cliente..." />
                    <CommandList>
                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                        <CommandGroup>
                            {accounts.map((account) => (
                                <CommandItem
                                    key={account.provider_account_id}
                                    value={account.name} // Command searches by this value
                                    onSelect={() => handleSelect(account.provider_account_id)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            currentAccountId === account.provider_account_id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {account.name} <span className="ml-auto text-xs text-muted-foreground">({account.provider_account_id})</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
