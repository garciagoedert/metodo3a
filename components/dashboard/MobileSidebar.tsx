'use client'

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Menu } from "lucide-react"
import { Sidebar } from "./Sidebar"
import { useState } from "react"
import { Button } from "@/components/ui/button"

export function MobileSidebar({ role }: { role: string }) {
    const [open, setOpen] = useState(false)

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                    <Menu className="h-6 w-6" />
                </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 bg-card w-72">
                <Sidebar role={role} onLinkClick={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    )
}
