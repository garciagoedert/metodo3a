'use client'

import { useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Loader2, Undo2, RotateCcw, UserCircle2, Upload, User, Check, X, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createUser, deleteUser, restoreUser, updateUser } from './actions'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Slider } from "@/components/ui/slider"
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/lib/canvasUtils'
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

interface User {
    id: string
    email: string | undefined
    full_name: string
    role: string
    created_at: string
    avatar_url: string | null
    deleted_at?: string | null
}

export function TeamManager({ users }: { users: User[] }) {
    const [isLoading, setIsLoading] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [restoreId, setRestoreId] = useState<string | null>(null)
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const router = useRouter()
    const supabase = createClient()

    // Search & Filter State
    const [searchTerm, setSearchTerm] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')

    // Avatar / Cropper State
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
    const [isCropperOpen, setIsCropperOpen] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [newAvatarUrl, setNewAvatarUrl] = useState<string | null>(null)

    // Derived State
    const filteredUsers = users.filter(user => {
        const normalize = (str: string) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        const search = normalize(searchTerm)
        const name = normalize(user.full_name)

        const matchesSearch = name.includes(search)
        const matchesRole = roleFilter === 'all' || user.role === roleFilter

        return matchesSearch && matchesRole
    })

    const handleCreate = async (formData: FormData) => {
        setIsLoading(true)
        if (newAvatarUrl) formData.append('avatar_url', newAvatarUrl)

        const res = await createUser(formData)
        setIsLoading(false)
        if (res?.error) {
            toast.error(res.error)
            return
        }
        setIsAddOpen(false)
        setNewAvatarUrl(null)
        router.refresh()
    }

    const handleUpdate = async (formData: FormData) => {
        setIsLoading(true)
        if (currentUser) formData.append('id', currentUser.id)
        if (newAvatarUrl) formData.append('avatar_url', newAvatarUrl)

        const res = await updateUser(formData)
        setIsLoading(false)
        if (res?.error) {
            toast.error(res.error)
            return
        }
        setIsEditOpen(false)
        setCurrentUser(null)
        setNewAvatarUrl(null)
        router.refresh()
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setIsLoading(true)
        const res = await deleteUser(deleteId)
        setIsLoading(false)
        setDeleteId(null)

        if (res?.error) {
            toast.error(res.error)
        }
        router.refresh()
    }

    const handleRestore = async () => {
        if (!restoreId) return
        setIsLoading(true)
        const res = await restoreUser(restoreId)
        setIsLoading(false)
        setRestoreId(null)

        if (res?.error) {
            toast.error(res.error)
        }
        router.refresh()
    }

    // Avatar Logic
    const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0]
            if (file.size > 5 * 1024 * 1024) {
                toast.error("A imagem deve ter no máximo 5MB.")
                return
            }

            const reader = new FileReader()
            reader.addEventListener('load', () => {
                setImageSrc(reader.result?.toString() || null)
                setIsCropperOpen(true)
            })
            reader.readAsDataURL(file)
        }
    }

    const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels)
    }, [])

    const handleSaveCroppedImage = async () => {
        try {
            setIsUploading(true)
            if (!imageSrc || !croppedAreaPixels) return

            const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
            if (!croppedImageBlob) throw new Error("Falha ao cortar imagem")

            const fileExt = "jpeg"
            const userId = currentUser ? currentUser.id : `new-${Date.now()}`
            const fileName = `team-avatar-${userId}-${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            // Attempt upload
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, {
                    contentType: 'image/jpeg'
                })

            if (uploadError) {
                console.error("Upload error:", uploadError)
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            setNewAvatarUrl(publicUrl)
            setIsCropperOpen(false)
            setImageSrc(null)
            setZoom(1)

        } catch (error: any) {
            console.error(error)
            toast.error("Erro ao salvar imagem: " + error.message)
        } finally {
            setIsUploading(false)
        }
    }

    return (
        <div className="space-y-8 pt-8 px-2 md:px-0">
            {/* Header Section */}
            <div className="flex flex-col gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Gerenciador de Equipe</h2>
                    <p className="text-muted-foreground mt-1">Gerencie quem tem acesso ao sistema e suas permissões.</p>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative w-full sm:w-auto sm:min-w-[320px] group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <Input
                            placeholder="Buscar membro..."
                            className="pl-10 h-10 bg-white/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 focus-visible:ring-blue-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-4 w-full sm:w-auto">
                        <Select value={roleFilter} onValueChange={setRoleFilter}>
                            <SelectTrigger className="w-full sm:w-[220px] h-10 bg-white/80 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800">
                                <SelectValue placeholder="Filtrar por cargo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Cargos</SelectItem>
                                <SelectItem value="admin">Administrador (Total)</SelectItem>
                                <SelectItem value="cs_manager">Gerente de CS</SelectItem>
                                <SelectItem value="traffic_manager">Gestor de Tráfego</SelectItem>
                                <SelectItem value="cs_agent">Agente de CS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {/* Add New Card (Always First) */}
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <button
                            onClick={() => { setNewAvatarUrl(null); }}
                            className="flex flex-col items-center justify-center gap-4 p-6 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all duration-300 min-h-[260px] cursor-pointer"
                        >
                            <div className="h-16 w-16 rounded-full bg-slate-50 dark:bg-slate-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <Plus className="h-8 w-8" />
                            </div>
                            <span className="font-semibold">Adicionar Membro</span>
                        </button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                            <DialogDescription>
                                Crie uma conta para um novo membro da equipe.
                            </DialogDescription>
                        </DialogHeader>

                        {/* Avatar Upload Section (Create) */}
                        <div className="flex flex-col items-center justify-center py-4">
                            <div className="relative group cursor-pointer">
                                <Avatar className="h-28 w-28 ring-4 ring-slate-50 dark:ring-slate-900 border border-slate-200 dark:border-slate-800">
                                    <AvatarImage src={newAvatarUrl || undefined} className="object-cover" />
                                    <AvatarFallback>
                                        <Plus className="h-8 w-8 text-muted-foreground" />
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Upload className="h-8 w-8 text-white" />
                                </div>
                                <Input
                                    type="file"
                                    accept="image/*"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    onChange={onFileChange}
                                    disabled={isUploading}
                                    value=""
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">Adicionar foto de perfil</p>
                        </div>

                        <form action={handleCreate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome Completo</Label>
                                <Input id="name" name="full_name" required placeholder="Ex: Maria Silva" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" name="email" type="email" required placeholder="maria@exemplo.com" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha Inicial</Label>
                                <Input id="password" name="password" type="password" required minLength={6} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="role">Cargo</Label>
                                <Select name="role" defaultValue="cs_agent">
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um cargo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Administrador (Total)</SelectItem>
                                        <SelectItem value="cs_manager">Gerente de CS</SelectItem>
                                        <SelectItem value="traffic_manager">Gestor de Tráfego</SelectItem>
                                        <SelectItem value="cs_agent">Agente de CS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isLoading || isUploading}>
                                    {(isLoading || isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Criar Conta
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {filteredUsers.map((user) => {
                    const isDeleted = !!user.deleted_at
                    return (
                        <Card key={user.id} className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isDeleted ? 'opacity-60 grayscale' : 'bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm'}`}>
                            <CardContent className="p-6 flex flex-col items-center gap-4">
                                <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    {!isDeleted && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => { setCurrentUser(user); setNewAvatarUrl(user.avatar_url || null); setIsEditOpen(true); }} title="Editar">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                    {isDeleted ? (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setRestoreId(user.id)} title="Restaurar Acesso">
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteId(user.id)} title="Desativar Acesso">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-slate-950 shadow-lg">
                                    <AvatarImage src={user.avatar_url || undefined} className="object-cover h-full w-full" />
                                    <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500 dark:from-indigo-900 dark:to-purple-900 dark:text-indigo-300">
                                        <UserCircle2 className="h-10 w-10" />
                                    </AvatarFallback>
                                </Avatar>

                                <div className="text-center space-y-1 w-full">
                                    <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate w-full" title={user.full_name}>
                                        {user.full_name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground truncate w-full" title={user.email}>
                                        {user.email}
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2 justify-center pt-2">
                                    <Badge variant={user.role === 'admin' ? 'default' : user.role === 'traffic_manager' ? 'secondary' : 'outline'} className="capitalize">
                                        {user.role.replace('_', ' ')}
                                    </Badge>
                                    {isDeleted && <Badge variant="destructive" className="uppercase text-[10px]">Inativo</Badge>}
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}

                {filteredUsers.length === 0 && (
                    <div className="col-span-full text-center p-8 text-muted-foreground">
                        Nenhum usuário encontrado com os filtros atuais.
                    </div>
                )}
            </div>

            {/* Edit User Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription>
                            Altere a foto, cargo ou senha deste usuário.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Avatar Upload Section */}
                    <div className="flex flex-col items-center justify-center py-4">
                        <div className="relative group cursor-pointer">
                            <Avatar className="h-28 w-28 ring-4 ring-slate-50 dark:ring-slate-900">
                                <AvatarImage src={newAvatarUrl || currentUser?.avatar_url || undefined} className="object-cover" />
                                <AvatarFallback>
                                    <User className="h-12 w-12 text-muted-foreground" />
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="h-8 w-8 text-white" />
                            </div>
                            <Input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                onChange={onFileChange}
                                disabled={isUploading}
                                value=""
                            />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Clique para alterar a foto</p>
                    </div>

                    <form action={handleUpdate} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name">Nome Completo (Apenas Visualização)</Label>
                            <Input id="edit-name" disabled value={currentUser?.full_name || ''} className="bg-muted/50" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Cargo</Label>
                            <Select name="role" defaultValue={currentUser?.role}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione um cargo" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Administrador (Total)</SelectItem>
                                    <SelectItem value="cs_manager">Gerente de CS</SelectItem>
                                    <SelectItem value="traffic_manager">Gestor de Tráfego</SelectItem>
                                    <SelectItem value="cs_agent">Agente de CS</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-password">Nova Senha (Opcional)</Label>
                            <Input id="edit-password" name="password" type="password" minLength={6} placeholder="Deixe em branco para manter" />
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={isLoading || isUploading}>
                                {(isLoading || isUploading) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Salvar Alterações
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Cropper Dialog */}
            <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
                <DialogContent className="sm:max-w-md z-50">
                    <DialogHeader>
                        <DialogTitle>Ajustar Foto</DialogTitle>
                        <DialogDescription>
                            Posicione a imagem no círculo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="relative w-full h-64 bg-black/5 rounded-md overflow-hidden mt-4">
                        {imageSrc && (
                            <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                showGrid={false}
                                cropShape="round"
                            />
                        )}
                    </div>
                    <div className="py-4 flex items-center gap-4">
                        <span className="text-sm font-medium">Zoom</span>
                        <Slider
                            value={[zoom]}
                            min={1}
                            max={3}
                            step={0.1}
                            onValueChange={(val: number[]) => setZoom(val[0])}
                            className="flex-1"
                        />
                    </div>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setIsCropperOpen(false)} disabled={isUploading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveCroppedImage} disabled={isUploading}>
                            {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Foto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete/Deactivate Confirmation */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desativar usuário?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O usuário perderá acesso ao sistema imediatamente, mas o histórico de dados será mantido.
                            Você poderá restaurar o acesso futuramente se necessário.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={isLoading} className="bg-red-600 focus:ring-red-600 hover:bg-red-700">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sim, desativar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Restore Confirmation */}
            <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restaurar acesso?</AlertDialogTitle>
                        <AlertDialogDescription>
                            O usuário voltará a ter acesso ao sistema com o mesmo email e senha anteriores.
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
        </div>
    )
}
