"use client"

import { useState, useEffect } from "react"
import { getMonthlyReport, upsertMonthlyReport } from "./analysis-actions"
import { getMonthlyComments } from "./comments-actions"
import { AnalysisFeed } from "./analysis-feed"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Edit2, Save, Loader2, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
// Avatar imports
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { syncAvatars } from "./sync-avatars"
import ReactMarkdown from 'react-markdown'

interface MonthlyAnalysisProps {
    accountId: string
    month: string // YYYY-MM-01
    isLoggedIn: boolean
}

function RenderContent({ content }: { content: string }) {
    const isHtml = /<[a-z][\s\S]*>/i.test(content)
    if (isHtml) {
        return <div dangerouslySetInnerHTML={{ __html: content }} className="line-clamp-3 text-sm text-blue-50/90 leading-relaxed" />
    }
    return <p className="line-clamp-3 text-sm text-blue-50/90 leading-relaxed">{content}</p>
}

const formatRole = (role?: string) => {
    switch (role) {
        case 'admin':
        case 'cs_manager':
            return 'Líder de Customer Success'
        case 'traffic_manager':
            return 'Gestor de Tráfego'
        case 'cs_agent':
            return 'Agente de Customer Success'
        default:
            return role || 'Membro da Equipe'
    }
}

export function MonthlyAnalysisSection({ accountId, month, isLoggedIn }: MonthlyAnalysisProps) {
    const [clientName, setClientName] = useState("")
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [latestComment, setLatestComment] = useState<any>(null)
    const [detailOpen, setDetailOpen] = useState(false)

    // Fetch Data (Client Name + Latest Comment)
    useEffect(() => {
        let mounted = true
        async function loadData() {
            setLoading(true)

            // Sync Avatars (Temp Fix)
            await syncAvatars()

            const [reportRes, commentsRes] = await Promise.all([
                getMonthlyReport(accountId, month),
                getMonthlyComments(accountId, month)
            ])

            if (mounted) {
                if (reportRes && !('error' in reportRes)) {
                    // @ts-ignore
                    setClientName(reportRes.client_name || "")
                } else {
                    setClientName("")
                }

                // Get latest comment
                if (commentsRes && commentsRes.length > 0) {
                    setLatestComment(commentsRes[0]) // Assumes ordered desc
                } else {
                    setLatestComment(null)
                }

                setLoading(false)
            }
        }
        loadData()
        return () => { mounted = false }
    }, [accountId, month])

    const handleSave = async () => {
        setSaving(true)
        const res = await upsertMonthlyReport(accountId, month, { client_name: clientName, analysis_text: "" })
        if (res.error) {
            toast.error(`Erro: ${res.error}`)
        } else {
            toast.success("Nome salvo com sucesso!")
            setEditing(false)
        }
        setSaving(false)
    }

    if (loading) return <div className="h-20 animate-pulse bg-slate-100 rounded-lg"></div>

    // Formatting Month Name
    const [y, m] = month.split('-').map(Number)
    const dateObj = new Date(y, m - 1, 15)
    const monthName = format(dateObj, "MMMM", { locale: ptBR })

    return (
        <div className="mb-6 space-y-6">
            {/* Header / Welcome Card */}
            {/* Header / Welcome Card */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 shadow-xl shadow-blue-200/50 p-6 md:p-8 text-white group">
                {/* Background Effects */}
                <div className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
                <div className="absolute right-20 bottom-0 h-40 w-40 rounded-full bg-white/5 blur-2xl"></div>

                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    {/* Left: Welcome Message */}
                    <div>
                        <div className="flex justify-between items-start mb-2">
                            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                                Olá, <span className="text-blue-200">{clientName || "Cliente"}</span>! 👋
                            </h2>
                            {isLoggedIn && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-white/50 hover:text-white hover:bg-white/10"
                                    onClick={() => setEditing(true)}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-blue-100 text-lg font-medium leading-relaxed max-w-lg mb-6">
                            Confira a análise completa dos resultados de <span className="bg-white/20 px-2 py-0.5 rounded-md text-white shadow-sm inline-block capitalize">{monthName}</span>.
                        </p>
                    </div>

                    {/* Right: Highlight Card or Placeholder */}
                    {latestComment ? (
                        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-colors">
                            <div className="flex items-start gap-4">
                                {/* Big Avatar */}
                                <Avatar className="h-16 w-16 border-2 border-white/30 shadow-md">
                                    <AvatarImage src={latestComment.author?.avatar_url} className="object-cover w-full h-full" />
                                    <AvatarFallback className="bg-blue-800 text-blue-200 text-xl font-bold">
                                        {latestComment.author?.full_name?.substring(0, 2).toUpperCase() || "??"}
                                    </AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col mb-2">
                                        <span className="font-bold text-lg truncate text-white">{latestComment.author?.full_name}</span>
                                        <span className="text-xs text-blue-200 uppercase tracking-widest font-medium">{formatRole(latestComment.author?.role)}</span>
                                    </div>

                                    <div className="mb-3">
                                        {latestComment.headline && (
                                            <h4 className="font-bold text-white text-lg mb-1 leading-tight line-clamp-2">
                                                {latestComment.headline}
                                            </h4>
                                        )}
                                        <RenderContent content={latestComment.content} />
                                    </div>

                                    <Button
                                        size="sm"
                                        className="bg-white text-blue-600 hover:bg-blue-50 border-0 font-semibold h-8"
                                        onClick={() => setDetailOpen(true)}
                                    >
                                        Saiba Mais
                                        <ArrowRight className="ml-2 h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        isLoggedIn && (
                            <div
                                onClick={() => setDetailOpen(true)}
                                className="h-full min-h-[180px] rounded-xl border-2 border-dashed border-white/30 bg-white/5 hover:bg-white/10 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-3 group"
                            >
                                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <Edit2 className="h-6 w-6 text-white" />
                                </div>
                                <span className="text-white font-medium text-lg">Começar Análise</span>
                                <p className="text-blue-200 text-sm max-w-[200px]">Clique para adicionar os destaques do mês.</p>
                            </div>
                        )
                    )}
                </div>
            </div>

            {/* Edit Client Name Dialog */}
            <Dialog open={editing} onOpenChange={setEditing}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Nome do Cliente</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                Nome de Exibição (Global)
                            </label>
                            <Input
                                value={clientName}
                                onChange={(e) => setClientName(e.target.value)}
                                placeholder="Ex: João Silva"
                            />
                            <p className="text-sm text-slate-500">
                                Este nome aparecerá na saudação "Olá, [Nome]!" para todos os usuários.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar Alterações
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Side Sheet Detail View - Document Style */}
            <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
                <SheetContent side="right" className="w-[90vw] sm:max-w-[800px] overflow-y-auto sm:w-[800px] p-0">
                    {/* Header */}
                    <SheetHeader className="p-8 pb-4 border-b bg-slate-50/50">
                        <SheetTitle className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                            <Edit2 className="h-6 w-6 text-blue-600" />
                            Análise de Resultados
                        </SheetTitle>
                        <SheetDescription className="text-base text-slate-600">
                            Relatório detalhado referente ao mês de <span className="capitalize font-medium text-slate-900">{monthName}</span>.
                        </SheetDescription>
                    </SheetHeader>

                    {/* Content Body */}
                    <div className="p-8">
                        <AnalysisFeed
                            accountId={accountId}
                            month={month}
                            isLoggedIn={isLoggedIn}
                        />
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    )
}
