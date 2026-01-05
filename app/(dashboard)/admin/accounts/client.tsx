'use client'

import { useState } from 'react'
import { Plus, Trash2, CheckCircle2, AlertCircle, Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import { AdAccount, connectMetaAccount, disconnectAccount, updateMetaAccount } from './actions'
import { useRouter } from 'next/navigation'

export function AccountsManager({ accounts }: { accounts: AdAccount[] }) {
    const [isLoading, setIsLoading] = useState(false)
    const [isAddOpen, setIsAddOpen] = useState(false)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [editingAccount, setEditingAccount] = useState<AdAccount | null>(null)
    const router = useRouter()

    const handleConnect = async (formData: FormData) => {
        setIsLoading(true)
        const res = await connectMetaAccount(formData)
        setIsLoading(false)
        if (res?.error) {
            alert(res.error)
            return
        }
        setIsAddOpen(false)
        router.refresh()
    }

    const handleUpdate = async (formData: FormData) => {
        if (!editingAccount) return
        setIsLoading(true)
        const res = await updateMetaAccount(editingAccount.id, formData)
        setIsLoading(false)
        if (res?.error) {
            alert(res.error)
            return
        }
        setEditingAccount(null)
        router.refresh()
    }

    const handleDisconnect = async () => {
        if (!deleteId) return
        setIsLoading(true)
        const res = await disconnectAccount(deleteId)
        setIsLoading(false)
        setDeleteId(null)

        if (res?.error) {
            alert(res.error)
        }
        router.refresh()
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Plataformas Conectadas</CardTitle>
                        <CardDescription>Gerencie as conexões com plataformas de anúncios.</CardDescription>
                    </div>
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#0668E1] hover:bg-[#0556B9]">
                                <Plus className="mr-2 h-4 w-4" />
                                Conectar Meta Ads
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Conectar Meta Ads</DialogTitle>
                                <DialogDescription>
                                    Insira o Token de Acesso e o ID da Conta de Anúncios.
                                    <br />
                                    <span className="text-xs text-muted-foreground">Você pode gerar um Token de Longa Duração no portal de Desenvolvedores do Facebook.</span>
                                </DialogDescription>
                            </DialogHeader>
                            <form action={handleConnect} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome de Identificação</Label>
                                    <Input id="name" name="name" required placeholder="Ex: Conta Principal - M3" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="account_id">ID da Conta de Anúncios (act_...)</Label>
                                    <Input id="account_id" name="account_id" required placeholder="act_1234567890" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="access_token">Token de Acesso (Long-Lived)</Label>
                                    <Input id="access_token" name="access_token" type="password" required placeholder="EAA..." />
                                </div>
                                <DialogFooter>
                                    <Button type="submit" disabled={isLoading} className="bg-[#0668E1] hover:bg-[#0556B9]">
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                                            <MetaIcon className="mr-2 h-4 w-4" />
                                        )}
                                        Conectar
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {accounts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
                            <AlertCircle className="h-10 w-10 mb-4 opacity-20" />
                            <p>Nenhuma conta conectada.</p>
                        </div>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                            {accounts.map((account) => (
                                <Card key={account.id} className="relative overflow-hidden border-l-4 border-l-[#0668E1]">
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                                <MetaIcon className="w-6 h-6" />
                                                {account.name}
                                            </CardTitle>
                                            <Badge variant={account.status === 'active' ? 'default' : 'destructive'} className={account.status === 'active' ? "bg-green-600" : ""}>
                                                {account.status === 'active' ? 'Ativo' : 'Erro'}
                                            </Badge>
                                        </div>
                                        <CardDescription className="text-xs truncate" title={account.provider_account_id}>
                                            ID: {account.provider_account_id}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="pb-2">
                                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-green-600" />
                                            Sincronizado: {account.last_synced_at ? new Date(account.last_synced_at).toLocaleDateString() : 'Ainda não'}
                                        </div>
                                    </CardContent>
                                    <CardFooter className="pt-2 justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => setEditingAccount(account)}
                                        >
                                            <Pencil className="h-4 w-4 mr-2" />
                                            Editar
                                        </Button>
                                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2" onClick={() => setDeleteId(account.id)}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Desconectar
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* EDIT DIALOG */}
            <Dialog open={!!editingAccount} onOpenChange={(open) => !open && setEditingAccount(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Conta</DialogTitle>
                        <DialogDescription>
                            Atualize o token de acesso ou o nome da conta identificada.
                        </DialogDescription>
                    </DialogHeader>
                    {editingAccount && (
                        <form action={handleUpdate} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Nome de Identificação</Label>
                                <Input
                                    id="edit-name"
                                    name="name"
                                    required
                                    defaultValue={editingAccount.name}
                                    placeholder="Ex: Conta Principal - M3"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-account_id">ID da Conta (Leitura)</Label>
                                <Input
                                    id="edit-account_id"
                                    value={editingAccount.provider_account_id}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-access_token">Novo Token de Acesso</Label>
                                <Input
                                    id="edit-access_token"
                                    name="access_token"
                                    type="password"
                                    required
                                    placeholder="Cole o novo token aqui..."
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={isLoading} className="bg-[#0668E1] hover:bg-[#0556B9]">
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Desconectar conta?</AlertDialogTitle>
                        <AlertDialogDescription>
                            A importação de dados será interrompida. Os dados já importados serão mantidos.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDisconnect(); }} disabled={isLoading} className="bg-red-600 focus:ring-red-600 hover:bg-red-700">
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Sim, desconectar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

function MetaIcon({ className }: { className?: string }) {
    return (
        <svg height="1em" style={{ flex: 'none', lineHeight: 1 }} viewBox="0 0 24 24" width="1em" className={className} xmlns="http://www.w3.org/2000/svg"><title>Meta</title><path d="M6.897 4h-.024l-.031 2.615h.022c1.715 0 3.046 1.357 5.94 6.246l.175.297.012.02 1.62-2.438-.012-.019a48.763 48.763 0 00-1.098-1.716 28.01 28.01 0 00-1.175-1.629C10.413 4.932 8.812 4 6.896 4z" fill="url(#lobe-icons-meta-fill-0)"></path><path d="M6.873 4C4.95 4.01 3.247 5.258 2.02 7.17a4.352 4.352 0 00-.01.017l2.254 1.231.011-.017c.718-1.083 1.61-1.774 2.568-1.785h.021L6.896 4h-.023z" fill="url(#lobe-icons-meta-fill-1)"></path><path d="M2.019 7.17l-.011.017C1.2 8.447.598 9.995.274 11.664l-.005.022 2.534.6.004-.022c.27-1.467.786-2.828 1.456-3.845l.011-.017L2.02 7.17z" fill="url(#lobe-icons-meta-fill-2)"></path><path d="M2.807 12.264l-2.533-.6-.005.022c-.177.918-.267 1.851-.269 2.786v.023l2.598.233v-.023a12.591 12.591 0 01.21-2.44z" fill="url(#lobe-icons-meta-fill-3)"></path><path d="M2.677 15.537a5.462 5.462 0 01-.079-.813v-.022L0 14.468v.024a8.89 8.89 0 00.146 1.652l2.535-.585a4.106 4.106 0 01-.004-.022z" fill="url(#lobe-icons-meta-fill-4)"></path><path d="M3.27 16.89c-.284-.31-.484-.756-.589-1.328l-.004-.021-2.535.585.004.021c.192 1.01.568 1.85 1.106 2.487l.014.017 2.018-1.745a2.106 2.106 0 01-.015-.016z" fill="url(#lobe-icons-meta-fill-5)"></path><path d="M10.78 9.654c-1.528 2.35-2.454 3.825-2.454 3.825-2.035 3.2-2.739 3.917-3.871 3.917a1.545 1.545 0 01-1.186-.508l-2.017 1.744.014.017C2.01 19.518 3.058 20 4.356 20c1.963 0 3.374-.928 5.884-5.33l1.766-3.13a41.283 41.283 0 00-1.227-1.886z" fill="#0082FB"></path><path d="M13.502 5.946l-.016.016c-.4.43-.786.908-1.16 1.416.378.483.768 1.024 1.175 1.63.48-.743.928-1.345 1.367-1.807l.016-.016-1.382-1.24z" fill="url(#lobe-icons-meta-fill-6)"></path><path d="M20.918 5.713C19.853 4.633 18.583 4 17.225 4c-1.432 0-2.637.787-3.723 1.944l-.016.016 1.382 1.24.016-.017c.715-.747 1.408-1.12 2.176-1.12.826 0 1.6.39 2.27 1.075l.015.016 1.589-1.425-.016-.016z" fill="#0082FB"></path><path d="M23.998 14.125c-.06-3.467-1.27-6.566-3.064-8.396l-.016-.016-1.588 1.424.015.016c1.35 1.392 2.277 3.98 2.361 6.971v.023h2.292v-.022z" fill="url(#lobe-icons-meta-fill-7)"></path><path d="M23.998 14.15v-.023h-2.292v.022c.004.14.006.282.006.424 0 .815-.121 1.474-.368 1.95l-.011.022 1.708 1.782.013-.02c.62-.96.946-2.293.946-3.91 0-.083 0-.165-.002-.247z" fill="url(#lobe-icons-meta-fill-8)"></path><path d="M21.344 16.52l-.011.02c-.214.402-.519.67-.917.787l.778 2.462a3.493 3.493 0 00.438-.182 3.558 3.558 0 001.366-1.218l.044-.065.012-.02-1.71-1.784z" fill="url(#lobe-icons-meta-fill-9)"></path><path d="M19.92 17.393c-.262 0-.492-.039-.718-.14l-.798 2.522c.449.153.927.222 1.46.222.492 0 .943-.073 1.352-.215l-.78-2.462c-.167.05-.341.075-.517.073z" fill="url(#lobe-icons-meta-fill-10)"></path><path d="M18.323 16.534l-.014-.017-1.836 1.914.016.017c.637.682 1.246 1.105 1.937 1.337l.797-2.52c-.291-.125-.573-.353-.9-.731z" fill="url(#lobe-icons-meta-fill-11)"></path><path d="M18.309 16.515c-.55-.642-1.232-1.712-2.303-3.44l-1.396-2.336-.011-.02-1.62 2.438.012.02.989 1.668c.959 1.61 1.74 2.774 2.493 3.585l.016.016 1.834-1.914a2.353 2.353 0 01-.014-.017z" fill="url(#lobe-icons-meta-fill-12)"></path><defs><linearGradient id="lobe-icons-meta-fill-0" x1="75.897%" x2="26.312%" y1="89.199%" y2="12.194%"><stop offset=".06%" stopColor="#0867DF"></stop><stop offset="45.39%" stopColor="#0668E1"></stop><stop offset="85.91%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-1" x1="21.67%" x2="97.068%" y1="75.874%" y2="23.985%"><stop offset="13.23%" stopColor="#0064DF"></stop><stop offset="99.88%" stopColor="#0064E0"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-2" x1="38.263%" x2="60.895%" y1="89.127%" y2="16.131%"><stop offset="1.47%" stopColor="#0072EC"></stop><stop offset="68.81%" stopColor="#0064DF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-3" x1="47.032%" x2="52.15%" y1="90.19%" y2="15.745%"><stop offset="7.31%" stopColor="#007CF6"></stop><stop offset="99.43%" stopColor="#0072EC"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-4" x1="52.155%" x2="47.591%" y1="58.301%" y2="37.004%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#007CF6"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-5" x1="37.689%" x2="61.961%" y1="12.502%" y2="63.624%"><stop offset="7.31%" stopColor="#007FF9"></stop><stop offset="100%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-6" x1="34.808%" x2="62.313%" y1="68.859%" y2="23.174%"><stop offset="27.99%" stopColor="#007FF8"></stop><stop offset="91.41%" stopColor="#0082FB"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-7" x1="43.762%" x2="57.602%" y1="6.235%" y2="98.514%"><stop offset="0%" stopColor="#0082FB"></stop><stop offset="99.95%" stopColor="#0081FA"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-8" x1="60.055%" x2="39.88%" y1="4.661%" y2="69.077%"><stop offset="6.19%" stopColor="#0081FA"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-9" x1="30.282%" x2="61.081%" y1="59.32%" y2="33.244%"><stop offset="0%" stopColor="#027AF3"></stop><stop offset="100%" stopColor="#0080F9"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-10" x1="20.433%" x2="82.112%" y1="50.001%" y2="50.001%"><stop offset="0%" stopColor="#0377EF"></stop><stop offset="99.94%" stopColor="#0279F1"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-11" x1="40.303%" x2="72.394%" y1="35.298%" y2="57.811%"><stop offset=".19%" stopColor="#0471E9"></stop><stop offset="100%" stopColor="#0377EF"></stop></linearGradient><linearGradient id="lobe-icons-meta-fill-12" x1="32.254%" x2="68.003%" y1="19.719%" y2="84.908%"><stop offset="27.65%" stopColor="#0867DF"></stop><stop offset="100%" stopColor="#0471E9"></stop></linearGradient></defs></svg>
    )
}
