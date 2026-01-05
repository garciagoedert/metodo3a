"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, getYear, parseISO, subMonths } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

export function MonthPicker({ className }: { className?: string }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const [selectedMonth, setSelectedMonth] = React.useState<string | undefined>(undefined)
    const [open, setOpen] = React.useState(false)

    // Initialize state from URL Params
    React.useEffect(() => {
        const fromParam = searchParams.get('from')
        if (fromParam) {
            const fromDate = parseISO(fromParam)
            const key = format(fromDate, 'yyyy-MM') // 2025-12
            setSelectedMonth(key)
        } else {
            // Default to LAST MONTH (Completed)
            const lastMonth = subMonths(new Date(), 1)
            const lastMonthKey = format(lastMonth, 'yyyy-MM')
            setSelectedMonth(lastMonthKey)
        }
    }, [searchParams])

    // View Year State (Default to selected year or current)
    const [viewYear, setViewYear] = React.useState(() => new Date().getFullYear())

    // Sync viewYear when selectedMonth changes
    React.useEffect(() => {
        if (selectedMonth) {
            const [y] = selectedMonth.split('-').map(Number)
            setViewYear(y)
        }
    }, [selectedMonth])


    const handleMonthSelect = (monthIndex: number) => {
        const date = new Date(viewYear, monthIndex, 1) // Month is 0-indexed

        const fromDate = startOfMonth(date)
        const toDate = endOfMonth(date)

        const fromStr = format(fromDate, 'yyyy-MM-dd')
        const toStr = format(toDate, 'yyyy-MM-dd')
        const key = format(date, 'yyyy-MM')

        const params = new URLSearchParams(searchParams.toString())
        params.set('from', fromStr)
        params.set('to', toStr)

        setSelectedMonth(key)
        setOpen(false)
        router.push(`${pathname}?${params.toString()}`)
    }

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant={"outline"}
                        className={cn(
                            "w-[240px] justify-start text-left font-normal bg-white",
                            !selectedMonth && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedMonth ? (
                            <span className="capitalize">
                                {format(parseISO(selectedMonth + '-01'), "MMMM yyyy", { locale: ptBR })}
                            </span>
                        ) : (
                            <span>Selecione o mês</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" align="start">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear - 1)}>
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <div className="font-semibold text-sm">{viewYear}</div>
                            <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setViewYear(viewYear + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            {Array.from({ length: 12 }).map((_, i) => {
                                const date = new Date(viewYear, i, 1)
                                // Check if this specific month is selected
                                const isSelected = selectedMonth === format(date, 'yyyy-MM')
                                const today = new Date()
                                // Disable Current Month and Future
                                const isFuture = viewYear > today.getFullYear() || (viewYear === today.getFullYear() && i >= today.getMonth())

                                return (
                                    <Button
                                        key={i}
                                        variant={isSelected ? "default" : "ghost"}
                                        size="sm"
                                        disabled={isFuture}
                                        className="text-xs h-9 w-full capitalize"
                                        onClick={() => handleMonthSelect(i)}
                                    >
                                        {format(date, 'MMM', { locale: ptBR })}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
