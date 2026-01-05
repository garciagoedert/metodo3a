'use client'

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { useState, useTransition, useCallback } from "react"
import { Loader2, Upload, User, Mail, Shield, UserCog, X, Check } from "lucide-react"
import Cropper from 'react-easy-crop'
import getCroppedImg from '@/lib/canvasUtils'

import { Button } from "@/components/ui/button"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { updateProfile, updatePassword } from "./actions"
import { ProfileSchema, PasswordSchema } from "./schema"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface ProfileFormProps {
    user: {
        id: string
        email?: string
        full_name?: string
        avatar_url?: string
    }
}

export function ProfileForm({ user }: ProfileFormProps) {
    const [isPendingProfile, startTransitionProfile] = useTransition()
    const [isPendingPassword, startTransitionPassword] = useTransition()
    const [isUploading, setIsUploading] = useState(false)
    const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || "")
    const supabase = createClient()

    // Cropper State
    const [imageSrc, setImageSrc] = useState<string | null>(null)
    const [crop, setCrop] = useState({ x: 0, y: 0 })
    const [zoom, setZoom] = useState(1)
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
    const [isCropperOpen, setIsCropperOpen] = useState(false)
    const [uploadingFile, setUploadingFile] = useState<File | null>(null) // Hold original filename ref

    // Profile Form
    const profileForm = useForm<z.infer<typeof ProfileSchema>>({
        resolver: zodResolver(ProfileSchema),
        defaultValues: {
            full_name: user?.full_name || "",
            email: user?.email || "",
        },
    })

    const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const file = event.target.files[0]

            // Limit file size to 5MB (larger allowed initially for cropping)
            if (file.size > 5 * 1024 * 1024) {
                toast.error("A imagem deve ter no máximo 5MB.")
                return
            }

            setUploadingFile(file)

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

            const fileExt = "jpeg" // getCroppedImg converts to jpeg
            const fileName = `${user.id}-${Math.random()}.${fileExt}`
            const filePath = `${fileName}`

            // Convert Blob to File for compatible upload if needed by some APIs, 
            // but Supabase accepts Blob.

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, croppedImageBlob, {
                    contentType: 'image/jpeg'
                })

            if (uploadError) {
                throw uploadError
            }

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath)

            setAvatarUrl(publicUrl)
            profileForm.setValue('avatar_url', publicUrl, { shouldDirty: true })
            toast.success("Foto atualizada com sucesso!")

            // Close modal and reset
            setIsCropperOpen(false)
            setImageSrc(null)
            setZoom(1)

        } catch (error) {
            console.error(error)
            toast.error("Erro ao salvar imagem.")
        } finally {
            setIsUploading(false)
        }
    }

    function onProfileSubmit(data: z.infer<typeof ProfileSchema>) {
        startTransitionProfile(async () => {
            const result = await updateProfile({ ...data, avatar_url: avatarUrl })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Perfil atualizado!")
                profileForm.reset({ ...data, avatar_url: avatarUrl })
            }
        })
    }

    // Password Form
    const passwordForm = useForm<z.infer<typeof PasswordSchema>>({
        resolver: zodResolver(PasswordSchema),
        defaultValues: {
            password: "",
            confirm: "",
        },
    })

    function onPasswordSubmit(data: z.infer<typeof PasswordSchema>) {
        startTransitionPassword(async () => {
            const result = await updatePassword(data)
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success("Senha atualizada!")
                passwordForm.reset()
            }
        })
    }

    return (
        <div className="flex flex-col md:flex-row gap-6">
            <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mover e Redimensionar</DialogTitle>
                        <DialogDescription>
                            Ajuste a imagem para o seu círculo de perfil.
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
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="outline" onClick={() => setIsCropperOpen(false)} disabled={isUploading}>
                                Cancelar
                            </Button>
                            <Button onClick={handleSaveCroppedImage} disabled={isUploading}>
                                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar Foto
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Sidebar / Profile Card Summary */}
            <div className="w-full md:w-1/3 lg:w-1/4 space-y-6">
                <Card className="text-center h-full">
                    <CardContent className="pt-6">
                        <div className="relative group cursor-pointer inline-block mx-auto mb-4">
                            <Avatar className="h-32 w-32 border-4 border-muted">
                                <AvatarImage src={avatarUrl} className="object-cover" />
                                <AvatarFallback className="text-4xl">
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
                                onChange={onFileChange} // Changed handler
                                disabled={isUploading}
                                value="" // allow selecting same file again
                            />
                        </div>
                        {isUploading && <span className="block text-sm text-muted-foreground animate-pulse mb-2">Processando...</span>}

                        <h3 className="text-xl font-bold truncate">{profileForm.watch('full_name') || "Usuário"}</h3>
                        <p className="text-sm text-muted-foreground truncate flex items-center justify-center gap-1 mt-1">
                            <Mail className="h-3 w-3" />
                            {user.email}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Settings Area */}
            <div className="flex-1">
                <Tabs defaultValue="general" className="w-full h-full">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="border-b pb-4">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="space-y-1">
                                    <CardTitle>Configurações</CardTitle>
                                    <CardDescription>Gerencie seus dados e preferências.</CardDescription>
                                </div>
                                <TabsList className="bg-muted/50">
                                    <TabsTrigger value="general">
                                        <UserCog className="h-4 w-4 mr-2" />
                                        Geral
                                    </TabsTrigger>
                                    <TabsTrigger value="security">
                                        <Shield className="h-4 w-4 mr-2" />
                                        Segurança
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6 flex-1">
                            <TabsContent value="general" className="mt-0 space-y-4">
                                <Form {...profileForm}>
                                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-6">
                                        <div className="space-y-4">
                                            <FormField
                                                control={profileForm.control}
                                                name="full_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Nome Completo</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Seu nome" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={profileForm.control}
                                                name="email"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Email</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="seu@email.com" {...field} disabled />
                                                        </FormControl>
                                                        <FormDescription>
                                                            O email não pode ser alterado.
                                                        </FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button type="submit" disabled={isPendingProfile || isUploading}>
                                                {isPendingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Salvar Alterações
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </TabsContent>

                            <TabsContent value="security" className="mt-0 space-y-4">
                                <Form {...passwordForm}>
                                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
                                        <div className="space-y-4">
                                            <FormField
                                                control={passwordForm.control}
                                                name="password"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Nova Senha</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="******" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={passwordForm.control}
                                                name="confirm"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Confirmar Senha</FormLabel>
                                                        <FormControl>
                                                            <Input type="password" placeholder="******" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <div className="flex justify-end">
                                            <Button type="submit" variant="destructive" disabled={isPendingPassword}>
                                                {isPendingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                                Alterar Senha
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            </TabsContent>
                        </CardContent>
                    </Card>
                </Tabs>
            </div>
        </div>
    )
}
