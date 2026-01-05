'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { login } from './actions'
import { Loader2, UserCircle2, ArrowLeft } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface User {
    id: string
    email?: string
    full_name: string
    avatar_url?: string
}

export default function LoginForm({ users = [] }: { users?: User[] }) {
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState<string | null>(null)
    const [mounted, setMounted] = useState(false)
    const [selectedUser, setSelectedUser] = useState<User | null>(null)

    useEffect(() => {
        setMounted(true)
    }, [])

    const handleAction = async (formData: FormData, action: typeof login) => {
        setLoading(true)
        setMessage(null)
        const result = await action(formData)
        setLoading(false)
        if (result?.error) {
            setMessage(result.error)
        }
    }

    if (!mounted) {
        return <div className="opacity-0" />
    }

    return (
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
            <div className="relative h-12 w-48">
                <Image
                    src="/logo.svg"
                    alt="Método 3A"
                    fill
                    className="object-contain"
                    priority
                />
            </div>

            <Card className="w-fit mx-auto min-w-[500px] max-w-[900px] shadow-2xl border-0 bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl ring-1 ring-slate-200 dark:ring-slate-800 transition-all duration-500">
                <CardHeader className="text-center pb-2 pt-8">
                    <CardTitle className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                        {selectedUser ? (
                            <span className="animate-in fade-in slide-in-from-bottom-2">
                                Olá, {selectedUser.full_name.split(' ')[0]} <span className="inline-block animate-wave">👋</span>
                            </span>
                        ) : (
                            'Quem é você?'
                        )}
                    </CardTitle>
                    <CardDescription className="text-base text-slate-500 dark:text-slate-400">
                        {selectedUser ? 'Confirme sua senha para continuar.' : 'Selecione seu perfil para acessar o painel.'}
                    </CardDescription>
                </CardHeader>

                <CardContent className="p-8 pt-6">
                    {!selectedUser ? (
                        <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden p-2">
                            <div className="flex flex-wrap justify-center gap-4">
                                {users.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => setSelectedUser(user)}
                                        className="relative flex flex-col items-center gap-4 p-4 rounded-2xl border border-transparent hover:border-slate-100 hover:bg-white/50 hover:shadow-xl dark:hover:bg-slate-900/50 dark:hover:border-slate-800 transition-all duration-300 group hover:-translate-y-1 w-44 shrink-0"
                                    >
                                        <div className="relative">
                                            <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-slate-950 shadow-md group-hover:scale-110 group-hover:ring-blue-100 dark:group-hover:ring-blue-900 transition-all duration-300">
                                                <AvatarImage src={user.avatar_url} className="object-cover h-full w-full" />
                                                <AvatarFallback className="bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-500 dark:from-indigo-900 dark:to-purple-900 dark:text-indigo-300">
                                                    <UserCircle2 className="h-12 w-12" />
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors text-center line-clamp-2">
                                            {user.full_name}
                                        </span>
                                    </button>
                                ))}
                                {users.length === 0 && (
                                    <div className="col-span-full flex flex-col items-center justify-center text-muted-foreground py-10 gap-2">
                                        <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
                                            <UserCircle2 className="h-6 w-6 text-slate-400" />
                                        </div>
                                        <p className="text-sm">Nenhum usuário encontrado.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="w-full max-w-[400px] mx-auto">
                            <form action={(fd) => handleAction(fd, login)} className="animate-in fade-in zoom-in-95 duration-300 space-y-6">
                                <input type="hidden" name="email" value={selectedUser.email || ''} />

                                <div className="flex justify-center -mt-2 mb-6">
                                    <Avatar className="h-28 w-28 ring-8 ring-white dark:ring-slate-950 shadow-2xl">
                                        <AvatarImage src={selectedUser.avatar_url} className="object-cover h-full w-full" />
                                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800">
                                            <UserCircle2 className="h-12 w-12 text-slate-400" />
                                        </AvatarFallback>
                                    </Avatar>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-2 text-center">
                                        <Label htmlFor="password" className="sr-only">Senha</Label>
                                        <Input
                                            id="password"
                                            name="password"
                                            type="password"
                                            required
                                            autoFocus
                                            className="h-14 text-center text-3xl font-bold tracking-[0.5em] placeholder:tracking-normal placeholder:text-lg placeholder:font-normal rounded-xl border-slate-200 bg-slate-50/50 backdrop-blur focus:bg-white focus:ring-4 focus:ring-blue-500/10 transition-all dark:bg-slate-900/50 dark:border-slate-800"
                                            placeholder="Senha"
                                        />
                                        <p className="text-xs text-muted-foreground">Digite sua senha para acessar</p>
                                    </div>

                                    {message && (
                                        <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium text-center animate-in shake border border-red-100">
                                            {message}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3 pt-2">
                                        <Button className="w-full h-12 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5" disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : 'Entrar na Conta'}
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            className="w-full text-slate-500 hover:text-slate-800 hover:bg-slate-100/80 rounded-xl"
                                            onClick={() => {
                                                setMessage(null)
                                                setSelectedUser(null)
                                            }}
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Escolher outro perfil
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
