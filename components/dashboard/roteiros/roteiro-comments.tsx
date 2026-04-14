"use client"

import { useState, useEffect } from "react"
import { getRoteiroComments, addRoteiroComment, deleteRoteiroComment, type RoteiroComment } from "@/app/(dashboard)/actions/roteiros"
import { getPublicRoteiroComments, addPublicRoteiroComment } from "@/components/dashboard/share-actions"
import { getTeamMembers } from "@/components/dashboard/comments-actions"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Trash2, MessageSquare, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export function RoteiroCommentsArea({ roteiroId, isPublic = false, token = "" }: { roteiroId: string, isPublic?: boolean, token?: string }) {
    const [comments, setComments] = useState<RoteiroComment[]>([])
    const [members, setMembers] = useState<any[]>([])
    const [newComment, setNewComment] = useState("")
    const [selectedAuthor, setSelectedAuthor] = useState<string>("")
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [commentToDelete, setCommentToDelete] = useState<string | null>(null)

    useEffect(() => {
        const fetchUserAndTeam = async () => {
            const supabase = createClient()
            const [{ data }, team] = await Promise.all([
                supabase.auth.getUser(),
                getTeamMembers()
            ])
            setCurrentUserId(data.user?.id || null)
            setMembers(team || [])
            if (data.user?.id && !selectedAuthor) {
                setSelectedAuthor(data.user.id)
            }
        }
        fetchUserAndTeam()
    }, [])

    const loadComments = async () => {
        setIsLoading(true)
        let data: any[] | null = null
        if (isPublic && token) {
            data = await getPublicRoteiroComments(token, roteiroId)
        } else {
            data = await getRoteiroComments(roteiroId)
        }
        setComments(data || [])
        setIsLoading(false)
    }

    useEffect(() => {
        if (roteiroId) {
            loadComments()
        }
    }, [roteiroId])

    const handleSubmit = async () => {
        if (!newComment.trim()) return

        setIsSubmitting(true)

        let res: any;
        if (isPublic && token) {
            res = await addPublicRoteiroComment(token, roteiroId, newComment.trim())
        } else {
            res = await addRoteiroComment(roteiroId, newComment.trim(), selectedAuthor || undefined)
        }

        setIsSubmitting(false)

        if (res.error) {
            toast.error("Erro ao enviar comentário.")
        } else {
            setNewComment("")
            loadComments()
        }
    }

    const handleDeleteClick = (commentId: string) => {
        setCommentToDelete(commentId)
    }

    const confirmDelete = async () => {
        if (!commentToDelete) return

        const currentId = commentToDelete
        setCommentToDelete(null)

        const toastId = toast.loading("Apagando nota...")
        const res = await deleteRoteiroComment(currentId)

        if (res.error) {
            toast.error("Erro ao apagar.", { id: toastId })
        } else {
            toast.success("Nota apagada.", { id: toastId })
            loadComments()
        }
    }

    return (
        <div className="bg-white dark:bg-slate-950 p-5 rounded-xl border shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">Comentários do Post</h3>
            </div>

            <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2">
                {isLoading ? (
                    <div className="text-center text-xs text-slate-400 py-4">Carregando...</div>
                ) : comments.length === 0 ? (
                    <div className="text-center text-xs text-slate-400 py-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                        Nenhum comentário ainda.
                    </div>
                ) : (
                    comments.map((comment: RoteiroComment) => (
                        <div key={comment.id} className="flex gap-3 items-start group">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={comment.user?.avatar_url} />
                                <AvatarFallback className="text-[10px]">{comment.user?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm border">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">{comment.user?.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] text-slate-400">
                                            {format(new Date(comment.created_at), "dd MMM HH:mm", { locale: ptBR })}
                                        </span>
                                        {(!isPublic && currentUserId) && (
                                            <button
                                                onClick={() => handleDeleteClick(comment.id)}
                                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-0.5"
                                                title="Apagar Nota"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap text-[13px]">{comment.content}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {!isPublic && (
                <div className="flex flex-col gap-2 mt-2 pt-4 border-t">
                    {!isAdding && comments.length > 0 ? (
                        <Button
                            variant="outline"
                            onClick={() => setIsAdding(true)}
                            className="w-full border-dashed text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                        >
                            Criar novo comentário
                        </Button>
                    ) : (
                        <>
                            {(!isPublic && members.length > 0) && (
                                <div className="flex items-center gap-2 mb-2">
                                    <User className="h-4 w-4 text-slate-400" />
                                    <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                                        <SelectTrigger className="h-8 text-xs bg-slate-50 w-[200px]">
                                            <SelectValue placeholder="Publicar como..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {members.map((member: any) => (
                                                <SelectItem key={member.id} value={member.id}>
                                                    {member.full_name || member.email?.split('@')[0]}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <Textarea
                                placeholder="Escreva uma observação..."
                                className="min-h-[80px] max-h-[300px] overflow-y-auto text-sm resize-none"
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                            />
                            <div className="flex justify-end gap-2 mt-1">
                                {comments.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setIsAdding(false)
                                            setNewComment("")
                                        }}
                                    >
                                        Cancelar
                                    </Button>
                                )}
                                <Button
                                    size="sm"
                                    disabled={!newComment.trim() || isSubmitting}
                                    onClick={async () => {
                                        await handleSubmit()
                                        setIsAdding(false)
                                    }}
                                >
                                    {isSubmitting ? "Enviando..." : "Comentar"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            )}

            <AlertDialog open={!!commentToDelete} onOpenChange={(open) => !open && setCommentToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Apagar Nota?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A nota será apagada permanentemente.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Sim, apagar nota
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
