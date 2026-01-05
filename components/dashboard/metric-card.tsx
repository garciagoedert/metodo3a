import { ArrowDown, ArrowUp, LucideIcon, Minus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
    title: string
    value: string
    icon?: LucideIcon
    description?: string
    trend?: {
        value: number
        label: string
    }
    isActive?: boolean
    activeColor?: string
    onClick?: () => void
    className?: string
}

export function MetricCard({ title, value, icon: Icon, description, trend, isActive, activeColor, onClick, className }: MetricCardProps) {
    return (
        <Card
            onClick={onClick}
            className={cn(
                "transition-all duration-200",
                onClick ? "cursor-pointer hover:shadow-md" : "",
                isActive
                    ? "bg-muted/50 dark:bg-muted/10 shadow-sm border-2"
                    : "hover:border-slate-300 dark:hover:border-slate-700",
                className
            )}
            style={isActive && activeColor ? { borderColor: activeColor } : undefined}
        >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {title}
                </CardTitle>
                {Icon && <Icon
                    className={cn("h-4 w-4", !isActive && "text-muted-foreground")}
                    style={isActive && activeColor ? { color: activeColor } : undefined}
                />}
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div
                    className={cn("text-xl font-bold")}
                    style={isActive && activeColor ? { color: activeColor } : undefined}
                >
                    {value}
                </div>
                {(description || trend) && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        {trend && (
                            <span className={cn(
                                "flex items-center font-medium",
                                trend.value > 0 ? "text-green-500" : trend.value < 0 ? "text-red-500" : "text-gray-500"
                            )}>
                                {trend.value > 0 ? <ArrowUp className="h-3 w-3 mr-0.5" /> : trend.value < 0 ? <ArrowDown className="h-3 w-3 mr-0.5" /> : <Minus className="h-3 w-3 mr-0.5" />}
                                {Math.abs(trend.value)}%
                            </span>
                        )}
                        <span className="opacity-80 font-medium">{description}</span>
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
