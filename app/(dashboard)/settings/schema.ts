import { z } from 'zod'

export const ProfileSchema = z.object({
    full_name: z.string().min(2, {
        message: "O nome deve ter pelo menos 2 caracteres.",
    }),
    email: z.string().email(),
    avatar_url: z.string().optional(),
})

export const PasswordSchema = z.object({
    password: z.string().min(6, {
        message: "A senha deve ter pelo menos 6 caracteres.",
    }),
    confirm: z.string().min(6),
}).refine((data) => data.password === data.confirm, {
    message: "As senhas não coincidem",
    path: ["confirm"],
})
