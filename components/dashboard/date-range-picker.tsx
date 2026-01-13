"use client"

import * as React from "react"
import { addDays, format, subDays, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react"
import { DateRange } from "react-day-picker"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function DateRangePicker({
    className,
    initialDate
}: React.HTMLAttributes<HTMLDivElement> & { initialDate?: DateRange }) {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    // Initialize state from URL Params ONLY to avoid Server/Client timezone mismatch on hydration
    // We ignore initialDate prop intentionally now to ensure client-side consistent parsing
    const [date, setDate] = React.useState<DateRange | undefined>(undefined)

    // Initialize from URL on mount
    React.useEffect(() => {
        if (!date) {
            const fromParam = searchParams.get('from')
            const toParam = searchParams.get('to')
            if (fromParam && toParam) {
                // Fix: Parse YYYY-MM-DD manually and set to Noon to avoid ALL timezone shifts
                const [fromY, fromM, fromD] = fromParam.split('-').map(Number)
                const [toY, toM, toD] = toParam.split('-').map(Number)

                setDate({
                    from: new Date(fromY, fromM - 1, fromD, 12, 0, 0),
                    to: new Date(toY, toM - 1, toD, 12, 0, 0)
                })
            } else if (initialDate) {
                // Fallback to initialDate ONLY if URL params are missing, but re-parse it to be safe if possible, 
                // or simpler: just trust the URL params logic as primary.
                // Actually, if we want to respect the server's default "Last 30 days" logic without passing the Date object:
                // Let's just default to client-side 30 days calculation if URL is empty.
                const today = new Date()
                today.setHours(12, 0, 0, 0)
                const thirtyDaysAgo = subDays(today, 30)
                thirtyDaysAgo.setHours(12, 0, 0, 0)
                setDate({ from: thirtyDaysAgo, to: today })
            } else {
                // Default Fallback
                const today = new Date()
                today.setHours(12, 0, 0, 0)
                const thirtyDaysAgo = subDays(today, 30)
                thirtyDaysAgo.setHours(12, 0, 0, 0)
                setDate({ from: thirtyDaysAgo, to: today })
            }
        }
    }, [searchParams, date, initialDate])

    const [preset, setPreset] = React.useState<string>("last_30d")

    // Helper to ensure we format exactly what is in the local date object, ignoring timezones
    const toLocalISODate = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }

    // Update URL when date changes
    React.useEffect(() => {
        if (date?.from && date?.to) {
            const params = new URLSearchParams(searchParams.toString())
            // Use manual formatter to guarantee "What You See Is What You Get"
            const newFrom = toLocalISODate(date.from)
            const newTo = toLocalISODate(date.to)

            const currentFrom = params.get('from')
            const currentTo = params.get('to')

            if (currentFrom !== newFrom || currentTo !== newTo) {
                params.set('from', newFrom)
                params.set('to', newTo)
                router.push(`${pathname}?${params.toString()}`)
            }
        }
    }, [date, router, pathname, searchParams])

    const handlePresetChange = (value: string) => {
        setPreset(value)
        // Normalize today to Noon
        const today = new Date()
        today.setHours(12, 0, 0, 0)

        let newDate: DateRange | undefined

        switch (value) {
            case "today":
                newDate = { from: today, to: today }
                break
            case "this_week":
                newDate = { from: startOfWeek(today), to: endOfWeek(today) }
                break
            case "last_15d":
                newDate = { from: subDays(today, 15), to: today }
                break
            case "this_month":
                newDate = { from: startOfMonth(today), to: endOfMonth(today) }
                break
            case "last_month":
                const lastMonth = subMonths(today, 1)
                newDate = { from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }
                break
            case "last_30d":
                newDate = { from: subDays(today, 30), to: today }
                break
            case "last_60d":
                newDate = { from: subDays(today, 60), to: today }
                break
            case "last_90d":
                newDate = { from: subDays(today, 90), to: today }
                break
            case "maximum":
                newDate = { from: subMonths(today, 36), to: today }
                break
            default:
                break
        }

        if (newDate) {
            setDate(newDate)
        }
    }

    const [open, setOpen] = React.useState(false)
    const [isMobile, setIsMobile] = React.useState(false)

    React.useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                            "w-full md:w-[300px] justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <span suppressHydrationWarning>
                                    {format(date.from, "dd MMM yyyy", { locale: ptBR })} -{" "}
                                    {format(date.to, "dd MMM yyyy", { locale: ptBR })}
                                </span>
                            ) : (
                                <span suppressHydrationWarning>
                                    {format(date.from, "dd MMM yyyy", { locale: ptBR })}
                                </span>
                            )
                        ) : (
                            <span>Selecione a data</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end" avoidCollisions={true}>
                    <div className="flex flex-col md:flex-row">
                        <div className="p-2 md:p-3 border-b md:border-b-0 md:border-r w-full md:w-[180px] grid grid-cols-2 md:flex md:flex-col gap-2">
                            <Button variant={preset === 'today' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('today')}>Hoje</Button>
                            <Button variant={preset === 'this_week' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('this_week')}>Esta Semana</Button>
                            <Button variant={preset === 'this_month' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('this_month')}>Este Mês</Button>
                            <Button variant={preset === 'last_month' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('last_month')}>Mês Passado</Button>

                            <Button variant={preset === 'last_7d' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('last_7d')}>7 Dias</Button>
                            <Button variant={preset === 'last_15d' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('last_15d')}>15 Dias</Button>
                            <Button variant={preset === 'last_30d' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('last_30d')}>30 Dias</Button>
                            <Button variant={preset === 'last_90d' ? 'secondary' : 'ghost'} className="h-8 md:h-9 justify-center md:justify-start text-xs font-normal" onClick={() => handlePresetChange('last_90d')}>90 Dias</Button>

                            <Button variant={preset === 'maximum' ? 'secondary' : 'ghost'} className="col-span-2 md:col-span-1 h-8 md:h-9 justify-center md:justify-start text-xs font-normal md:mb-2" onClick={() => handlePresetChange('maximum')}>Todo Período</Button>
                        </div>
                        <div className="flex flex-col justify-between">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={date?.from}
                                selected={date}
                                onSelect={(val) => {
                                    setDate(val)
                                    setPreset("custom")
                                }}
                                numberOfMonths={isMobile ? 1 : 2}
                            />
                            <div className="p-3 border-t flex justify-end">
                                <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                                    Fechar
                                </Button>
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
