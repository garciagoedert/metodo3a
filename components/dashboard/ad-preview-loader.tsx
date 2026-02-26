'use client'

import { useState, useEffect } from "react"
import { ImageOff, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getAdPreviewAction } from "@/app/(dashboard)/actions"

export function AdPreviewLoader({ accountId, adId, fallbackImage }: { accountId: string, adId: string, fallbackImage: string | null }) {
    const [html, setHtml] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        async function fetchPreview() {
            setLoading(true)
            const res = await getAdPreviewAction(accountId, adId)
            if (mounted) {
                if (res?.html) setHtml(res.html)
                setLoading(false)
            }
        }
        fetchPreview()
        return () => { mounted = false }
    }, [accountId, adId])

    if (loading) {
        return <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-900 rounded-xl min-w-[320px] min-h-[500px] gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-blue-500"></div>
            <p className="text-slate-500 font-medium text-sm animate-pulse">Carregando formato original do Facebook...</p>
        </div>
    }

    if (html) {
        let cleanHtml = html.replace(/scrolling="yes"/gi, 'scrolling="no"')
        cleanHtml = cleanHtml.replace(/sandbox="[^"]*"/g, '')
        cleanHtml = cleanHtml.replace(/allow="[^"]*"/g, '')
        cleanHtml = cleanHtml.replace(/allowfullscreen(="")?/gi, '')
        cleanHtml = cleanHtml.replace('<iframe', '<iframe allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share; fullscreen" allowFullScreen="true" style="overflow:hidden; border:none;" ')
        cleanHtml += `<style> iframe { overflow: hidden !important; } iframe::-webkit-scrollbar { display: none !important; } </style>`

        return (
            <div className="flex flex-col items-center justify-center p-0 w-full mb-4">
                <div
                    className="relative overflow-hidden rounded-[2rem] shadow-2xl bg-[#000000] mx-auto flex-shrink-0"
                    style={{ width: '448px', height: '735px' }}
                >
                    <div
                        dangerouslySetInnerHTML={{ __html: cleanHtml }}
                        className="absolute top-0 left-0 origin-top-left [&>iframe]:!overflow-hidden [&>iframe::-webkit-scrollbar]:!hidden [&>iframe]:![scrollbar-width:none]"
                        style={{ transform: 'scale(1.4)' }}
                    />
                </div>
            </div>
        )
    }

    return fallbackImage ? <img src={fallbackImage} className="max-h-[85vh] w-auto max-w-full rounded-xl object-contain drop-shadow-2xl bg-white dark:bg-slate-950" /> : <div className="h-64 w-64 flex items-center justify-center bg-slate-100 rounded-xl"><ImageOff className="h-8 w-8 text-slate-400" /></div>
}
