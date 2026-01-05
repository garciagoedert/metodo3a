"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { Toggle } from "@/components/ui/toggle"
import { Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Heading2, Quote, Link as LinkIcon, Heading3 } from 'lucide-react'
import { useEffect } from 'react'

interface TiptapEditorProps {
    value: string
    onChange: (html: string) => void
    editable?: boolean
}

export function TiptapEditor({ value, onChange, editable = true }: TiptapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-500 hover:text-blue-700 underline',
                },
            })
        ],
        content: value,
        editable: editable,
        immediatelyRender: false, // Fix SSR hydration mismatch
        editorProps: {
            attributes: {
                class: 'min-h-[200px] w-full bg-transparent px-3 py-2 text-sm outline-none prose prose-slate max-w-none prose-p:my-1 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0',
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })

    // Update content if value changes externally (and editor exists)
    // Be careful with cursor jumping if we do this naively.
    // Usually for "Initial Value" it's fine. For controlled input, Tiptap is tricky.
    // We'll rely on initial content mostly or check equality.
    useEffect(() => {
        if (editor && value !== editor.getHTML()) {
            // Only update if significantly different to avoid cursor jumps on every keystroke loop
            // For this use case (new comment), value starts empty.
            if (editor.getText() === "" && value === "") return
            // We might skip this effect for now to avoid loops, as we only set NEW comment.
        }
    }, [value, editor])

    if (!editor) return null

    if (!editable) {
        return <EditorContent editor={editor} className="w-full" />
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href
        const url = window.prompt('URL', previousUrl)

        if (url === null) return

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
            return
        }

        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
    }

    return (
        <div className="border rounded-md border-slate-200 bg-white shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="border-b border-slate-100 bg-slate-50/50 p-1 flex gap-1 flex-wrap">
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 2 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                    aria-label="Heading 2"
                >
                    <Heading2 className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('heading', { level: 3 })}
                    onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                    aria-label="Heading 3"
                >
                    <Heading3 className="h-4 w-4" />
                </Toggle>

                <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

                <Toggle
                    size="sm"
                    pressed={editor.isActive('bold')}
                    onPressedChange={() => editor.chain().focus().toggleBold().run()}
                    aria-label="Bold"
                >
                    <Bold className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('italic')}
                    onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                    aria-label="Italic"
                >
                    <Italic className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('underline')}
                    onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                    aria-label="Underline"
                >
                    <UnderlineIcon className="h-4 w-4" />
                </Toggle>

                <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

                <Toggle
                    size="sm"
                    pressed={editor.isActive('bulletList')}
                    onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                    aria-label="Bullet List"
                >
                    <List className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('orderedList')}
                    onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                    aria-label="Ordered List"
                >
                    <ListOrdered className="h-4 w-4" />
                </Toggle>

                <div className="w-px h-6 bg-slate-200 mx-1 self-center" />

                <Toggle
                    size="sm"
                    pressed={editor.isActive('blockquote')}
                    onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                    aria-label="Blockquote"
                >
                    <Quote className="h-4 w-4" />
                </Toggle>
                <Toggle
                    size="sm"
                    pressed={editor.isActive('link')}
                    onPressedChange={setLink}
                    aria-label="Link"
                >
                    <LinkIcon className="h-4 w-4" />
                </Toggle>
            </div>
            <EditorContent editor={editor} />
        </div>
    )
}
