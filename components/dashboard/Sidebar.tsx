'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { LayoutDashboard, Link as LinkIcon, FileText, Users, Settings, LogOut, ChevronLeft, ChevronRight, User, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface SidebarProps {
    role: string | null
    user?: {
        name?: string
        email?: string
        avatar_url?: string
    }
    onLinkClick?: () => void
}

export function Sidebar({ role, user, onLinkClick }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const links = [
        { name: 'Métricas', href: '/', icon: LayoutDashboard, roles: ['admin', 'cs_manager', 'traffic_manager', 'cs_agent'] },
        { name: 'Monitoramento', href: '/monitor', icon: Activity, roles: ['admin', 'cs_manager', 'traffic_manager', 'cs_agent'] },
        { name: 'Conexões', href: '/admin/accounts', icon: LinkIcon, roles: ['admin', 'cs_manager', 'traffic_manager'] },
        { name: 'Histórico', href: '/admin/logs', icon: FileText, roles: ['admin', 'cs_manager', 'traffic_manager', 'cs_agent'] },
        { name: 'Gerenciador', href: '/admin/team', icon: Settings, roles: ['admin'] },
    ]

    const filteredLinks = links.filter(link => !link.roles || (role && link.roles.includes(role)))

    return (
        <aside className={cn(
            "flex h-full flex-col bg-card transition-all duration-300 border-r relative",
            isCollapsed ? "w-[70px]" : "w-64"
        )}>
            <div className={cn(
                "flex h-16 items-center border-b overflow-hidden transition-all duration-300",
                isCollapsed ? "justify-center px-0" : "px-6"
            )}>
                {isCollapsed ? (
                    <div className="relative h-8 w-8">
                        <Image
                            src="/symbol.svg"
                            alt="M"
                            fill
                            className="object-contain"
                            priority
                        />
                    </div>
                ) : (
                    <div className="relative h-8 w-40">
                        <Image
                            src="/logo.svg"
                            alt="Método 3A"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                )}
            </div>

            <nav className="flex-1 space-y-1 p-2 overflow-y-auto overflow-x-hidden">
                {filteredLinks.map((link) => {
                    const Icon = link.icon
                    const isActive = link.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(link.href)

                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            onClick={onLinkClick}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px]",
                                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                isCollapsed ? "justify-center" : ""
                            )}
                            title={isCollapsed ? link.name : undefined}
                        >
                            <Icon className="h-5 w-5 shrink-0" />
                            {!isCollapsed && <span className="truncate">{link.name}</span>}
                        </Link>
                    )
                })}
            </nav>

            <div className="p-2 border-t space-y-2">
                <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                        "w-full flex items-center mb-2 h-10 transition-colors text-muted-foreground hover:text-foreground",
                        isCollapsed ? "justify-center p-0" : "justify-start px-3 gap-3"
                    )}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight className="h-5 w-5 shrink-0" /> : <ChevronLeft className="h-5 w-5 shrink-0" />}
                    {!isCollapsed && <span className="font-medium">Recolher</span>}
                </Button>

                <Link
                    href="/settings"
                    onClick={onLinkClick}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors min-h-[40px]",
                        pathname === '/settings' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        isCollapsed ? "justify-center px-0" : ""
                    )}
                    title={isCollapsed ? "Perfil" : undefined}
                >
                    <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={user?.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-[10px] bg-transparent border-none">
                            <User className="h-5 w-5" />
                        </AvatarFallback>
                    </Avatar>
                    {!isCollapsed && <span className="truncate">Perfil</span>}
                </Link>
                <button
                    onClick={handleLogout}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 w-full transition-colors min-h-[40px]",
                        isCollapsed ? "justify-center" : ""
                    )}
                    title={isCollapsed ? "Sair" : undefined}
                >
                    <LogOut className="h-5 w-5 shrink-0" />
                    {!isCollapsed && <span className="truncate">Sair</span>}
                </button>
            </div>
        </aside>
    )
}
