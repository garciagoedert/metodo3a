"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import { Underline } from '@tiptap/extension-underline'
import { Link } from '@tiptap/extension-link'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import ImageResize from 'tiptap-extension-resize-image'

const CustomImage = ImageResize.extend({
    name: 'image',
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: 400,
                renderHTML: attributes => {
                    return {
                        width: attributes.width,
                    }
                }
            },
            class: {
                default: 'max-w-[80%] rounded-lg shadow-sm border my-2 inline-block', // Default style, inline-like
                renderHTML: attributes => {
                    return {
                        class: attributes.class,
                    }
                }
            }
        }
    }
})
import { TextAlign } from '@tiptap/extension-text-align'
import { FontSize } from './tiptap-font-size'
import { cn } from "@/lib/utils"

import { Toggle } from "@/components/ui/toggle"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
    Heading2, Quote, Link as LinkIcon, Heading3,
    AlignLeft, AlignCenter, AlignRight, ImageIcon, Highlighter, Palette, Type, Baseline, Unlink, AlignJustify
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const PRESET_COLORS = ['#000000', '#475569', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']
const PRESET_HIGHLIGHTS = ['transparent', '#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa', '#e5e7eb']
const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '30px', '36px']

interface TiptapEditorProps {
    value: string
    onChange: (html: string) => void
    editable?: boolean
    className?: string
}

export function TiptapEditor({ value, onChange, editable = true, className }: TiptapEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [2, 3] },
                link: false,
                underline: false,
            }),
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
                defaultProtocol: 'https',
                HTMLAttributes: {
                    class: 'text-blue-500 hover:text-blue-700 underline cursor-pointer',
                },
            }),
            TextStyle,
            Color,
            FontSize,
            Highlight.configure({
                multicolor: true,
            }),
            CustomImage.configure({
                inline: true,
            }),
            TextAlign.configure({
                types: ['heading', 'paragraph'],
            }),
        ],
        content: value,
        editable: editable,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'min-h-[300px] w-full max-w-full bg-white px-6 py-4 text-base outline-none prose prose-slate focus:ring-0 leading-snug prose-p:my-0 pb-12 prose-headings:my-1 prose-ul:my-0 prose-ol:my-0 break-words [word-break:break-word] whitespace-pre-wrap',
            },
            handlePaste: (view, event, slice) => {
                const items = event.clipboardData?.items;
                if (!items) return false;

                // Check if clipboard contains text or html
                let hasText = false;
                for (let i = 0; i < items.length; i++) {
                    if (items[i].type.indexOf('text') !== -1) {
                        hasText = true;
                    }
                }

                for (let i = 0; i < items.length; i++) {
                    const item = items[i];
                    if (item.type.indexOf('image') !== -1) {
                        // If there is Text/HTML, Tiptap's native paste handler is better equipped 
                        // to handle the structured formatting. We only manually force-insert pure image files.
                        if (!hasText) {
                            const file = item.getAsFile();
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (e) => {
                                    const result = e.target?.result as string;
                                    if (result) {
                                        const { schema } = view.state;
                                        const node = schema.nodes.image.create({ src: result, width: 400 });
                                        const transaction = view.state.tr.replaceSelectionWith(node);
                                        view.dispatch(transaction);
                                    }
                                };
                                reader.readAsDataURL(file);
                            }
                            return true; // Stop Tiptap native handling since we handled the raw image
                        }
                    }
                }
                return false; // Let Tiptap handle text and HTML natively
            }
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML())
        },
    })

    const [showLinkInput, setShowLinkInput] = useState(false)
    const [linkUrl, setLinkUrl] = useState('')

    const [showImageInput, setShowImageInput] = useState(false)
    const [imageUrl, setImageUrl] = useState('')

    const linkInputRef = useRef<HTMLInputElement>(null)
    const imageInputRef = useRef<HTMLInputElement>(null)

    // Intentionally empty or remove the dead useEffect
    useEffect(() => {
        // Tiptap controls its own internal state, parent syncs via onUpdate
    }, [value, editor])

    if (!editor) return null

    if (!editable) {
        return <EditorContent editor={editor} className="w-full prose prose-slate max-w-none leading-snug prose-p:my-0 prose-headings:my-1 prose-ul:my-0 prose-ol:my-0 pb-4" />
    }

    const handleSetLink = () => {
        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run()
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
        }
        setShowLinkInput(false)
        setLinkUrl('')
    }

    const handleUnlink = () => {
        editor.chain().focus().extendMarkRange('link').unsetLink().run()
        setShowLinkInput(false)
        setLinkUrl('')
    }

    const handleSetImage = () => {
        if (imageUrl !== '') {
            editor.chain().focus().insertContent({ type: 'image', attrs: { src: imageUrl, width: 400 } }).run()
        }
        setShowImageInput(false)
        setImageUrl('')
    }

    return (
        <div className={cn("border rounded-xl border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden transition-all focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100", className)}>
            {/* Toolbar Top Row */}
            <div className="border-b border-slate-100 bg-slate-50/80 p-2 flex gap-1 flex-wrap items-center relative z-10 w-full">

                {/* Font Size Selector */}
                <div className="px-2 border-r border-slate-200 flex items-center">
                    <Select
                        value={editor.getAttributes('textStyle').fontSize || '16px'}
                        onValueChange={(val) => editor.chain().focus().setMark('textStyle', { fontSize: val }).run()}
                    >
                        <SelectTrigger className="h-8 text-xs w-[80px] bg-white">
                            <SelectValue placeholder="Tamanho" />
                        </SelectTrigger>
                        <SelectContent>
                            {FONT_SIZES.map(size => (
                                <SelectItem key={size} value={size}>
                                    {size.replace('px', '')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Headings */}
                <div className="flex gap-1 px-2 border-r border-slate-200">
                    <Toggle size="sm" pressed={editor.isActive('heading', { level: 2 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                        <Heading2 className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('heading', { level: 3 })} onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
                        <Heading3 className="h-4 w-4" />
                    </Toggle>
                </div>

                {/* Styling */}
                <div className="flex gap-1 px-2 border-r border-slate-200">
                    <Toggle size="sm" pressed={editor.isActive('bold')} onPressedChange={() => editor.chain().focus().toggleBold().run()}>
                        <Bold className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('italic')} onPressedChange={() => editor.chain().focus().toggleItalic().run()}>
                        <Italic className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('underline')} onPressedChange={() => editor.chain().focus().toggleUnderline().run()}>
                        <UnderlineIcon className="h-4 w-4" />
                    </Toggle>
                </div>

                {/* Colors and Highlights */}
                <div className="flex items-center gap-1 px-2 border-r border-slate-200">
                    {/* Text Color Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Cor do Texto">
                                <Palette className="h-4 w-4 text-slate-700" style={{ color: editor.getAttributes('textStyle').color }} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="start">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Cor do Texto</p>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color}
                                        className="w-6 h-6 rounded-md border border-slate-200 shadow-sm transition hover:scale-110"
                                        style={{ backgroundColor: color }}
                                        onClick={() => editor.chain().focus().setColor(color).run()}
                                    />
                                ))}
                            </div>
                            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                                <span className="text-xs text-slate-500">Personalizada:</span>
                                <input
                                    type="color"
                                    className="w-full h-8 cursor-pointer rounded-md border"
                                    value={editor.getAttributes('textStyle').color || '#000000'}
                                    onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Highlight Popover */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" title="Marca-texto">
                                <Highlighter className="h-4 w-4 text-slate-700" style={{ color: editor.getAttributes('highlight').color === 'transparent' ? 'inherit' : editor.getAttributes('highlight').color }} />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-3" align="start">
                            <p className="text-xs font-semibold text-slate-500 mb-2">Cor de Fundo</p>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_HIGHLIGHTS.map(color => (
                                    <button
                                        key={color}
                                        className="w-6 h-6 rounded-md border border-slate-200 shadow-sm transition hover:scale-110 flex items-center justify-center"
                                        style={{ backgroundColor: color === 'transparent' ? '#ffffff' : color }}
                                        onClick={() => color === 'transparent' ? editor.chain().focus().unsetHighlight().run() : editor.chain().focus().setHighlight({ color }).run()}
                                    >
                                        {color === 'transparent' && <span className="text-[10px] text-slate-400">X</span>}
                                    </button>
                                ))}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Alignments */}
                <div className="flex gap-1 px-2 border-r border-slate-200">
                    <Toggle size="sm" pressed={editor.isActive({ textAlign: 'left' })} onPressedChange={() => editor.chain().focus().setTextAlign('left').run()}>
                        <AlignLeft className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive({ textAlign: 'center' })} onPressedChange={() => editor.chain().focus().setTextAlign('center').run()}>
                        <AlignCenter className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive({ textAlign: 'right' })} onPressedChange={() => editor.chain().focus().setTextAlign('right').run()}>
                        <AlignRight className="h-4 w-4" />
                    </Toggle>
                </div>

                {/* Lists & Quotes */}
                <div className="flex gap-1 px-2 border-r border-slate-200">
                    <Toggle size="sm" pressed={editor.isActive('bulletList')} onPressedChange={() => editor.chain().focus().toggleBulletList().run()}>
                        <List className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('orderedList')} onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}>
                        <ListOrdered className="h-4 w-4" />
                    </Toggle>
                    <Toggle size="sm" pressed={editor.isActive('blockquote')} onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}>
                        <Quote className="h-4 w-4" />
                    </Toggle>
                </div>

                {/* Rich Media */}
                <div className="flex gap-1 px-2 relative">
                    {/* LINK BUTTON & POPOVER */}
                    <div className="relative">
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('link')}
                            onPressedChange={() => {
                                setShowImageInput(false)
                                if (showLinkInput) {
                                    setShowLinkInput(false)
                                } else {
                                    setLinkUrl(editor.getAttributes('link').href || '')
                                    setShowLinkInput(true)
                                    setTimeout(() => linkInputRef.current?.focus(), 50)
                                }
                            }}
                        >
                            <LinkIcon className="h-4 w-4" />
                        </Toggle>

                        {showLinkInput && (
                            <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border p-3 flex gap-2 z-50">
                                <Input
                                    ref={linkInputRef}
                                    placeholder="Cole a URL ou link aqui..."
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSetLink()}
                                    className="h-8 text-xs"
                                />
                                <Button size="sm" onClick={handleSetLink} className="h-8 px-3">OK</Button>
                                {editor.isActive('link') && (
                                    <Button size="sm" variant="destructive" onClick={handleUnlink} className="h-8 px-2" title="Remover Link">
                                        <Unlink className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* IMAGE BUTTON & POPOVER */}
                    <div className="relative">
                        <Toggle
                            size="sm"
                            pressed={editor.isActive('image')}
                            onPressedChange={() => {
                                setShowLinkInput(false)
                                if (showImageInput) {
                                    setShowImageInput(false)
                                } else {
                                    setImageUrl('')
                                    setShowImageInput(true)
                                    setTimeout(() => imageInputRef.current?.focus(), 50)
                                }
                            }}
                            title="Inserir Imagem por Link (Use Ctrl+C / Ctrl+V para colar imagens direto no texto)"
                        >
                            <ImageIcon className="h-4 w-4" />
                        </Toggle>

                        {showImageInput && (
                            <div className="absolute top-full right-0 md:left-0 mt-2 w-80 bg-white rounded-lg shadow-xl border p-3 z-50">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Inserir Imagem (URL)</p>
                                <p className="text-[10px] text-slate-400 mb-3 block">Dica: Você também pode colar (Ctrl+V) imagens diretamente no texto.</p>
                                <div className="flex gap-2">
                                    <Input
                                        ref={imageInputRef}
                                        placeholder="Ex: https://dominio.com/img.png"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSetImage()}
                                        className="h-8 text-xs"
                                    />
                                    <Button size="sm" onClick={handleSetImage} className="h-8 px-3">Ok</Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Editor Area */}
            <div 
                className="flex-1 w-full bg-white cursor-text overflow-y-auto overflow-x-hidden" 
                onClick={(e) => {
                    // Only force focus if the user clicked the empty wrapper 
                    // (not the text content itself) to preserve text selections
                    if (e.target === e.currentTarget && editor) {
                        editor.commands.focus('end')
                    }
                }}
            >
                {editor && (
                    <BubbleMenu
                        editor={editor}
                        shouldShow={({ editor, state }) => {
                            // Only show if image is selected
                            return editor.isActive('image')
                        }}
                    >
                        <div className="bg-white border rounded-lg shadow-xl p-1 flex items-center gap-1 z-50">
                            <Button
                                size="sm"
                                variant={editor.getAttributes('image').class?.includes('float-left') ? 'secondary' : 'ghost'}
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                    const currentClass = editor.getAttributes('image').class || 'max-w-[80%]';
                                    const widthClass = currentClass.match(/max-w-\[.*?\]/) ? currentClass.match(/max-w-\[.*?\]/)[0] : 'max-w-[80%]';
                                    editor.chain().focus().updateAttributes('image', { class: `${widthClass} rounded-lg shadow-sm border mb-2 float-left mr-4 inline-block` }).run()
                                }}
                                title="Alinhar à Esquerda (Texto ao Lado)"
                            >
                                <AlignLeft className="w-4 h-4 mr-1" /> Esq
                            </Button>
                            <Button
                                size="sm"
                                variant={editor.getAttributes('image').class?.includes('float-right') ? 'secondary' : 'ghost'}
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                    const currentClass = editor.getAttributes('image').class || 'max-w-[80%]';
                                    const widthClass = currentClass.match(/max-w-\[.*?\]/) ? currentClass.match(/max-w-\[.*?\]/)[0] : 'max-w-[80%]';
                                    editor.chain().focus().updateAttributes('image', { class: `${widthClass} rounded-lg shadow-sm border mb-2 float-right ml-4 inline-block` }).run()
                                }}
                                title="Alinhar à Direita (Texto ao Lado)"
                            >
                                <AlignRight className="w-4 h-4 mr-1" /> Dir
                            </Button>
                            <Button
                                size="sm"
                                variant={editor.getAttributes('image').class?.includes('mx-auto') ? 'secondary' : 'ghost'}
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                    const currentClass = editor.getAttributes('image').class || 'max-w-[80%]';
                                    const widthClass = currentClass.match(/max-w-\[.*?\]/) ? currentClass.match(/max-w-\[.*?\]/)[0] : 'max-w-[80%]';
                                    editor.chain().focus().updateAttributes('image', { class: `${widthClass} rounded-lg shadow-sm border my-4 mx-auto block` }).run()
                                }}
                                title="Centralizar (Bloco Separado)"
                            >
                                <AlignCenter className="w-4 h-4 mr-1" /> Centro
                            </Button>
                            <Button
                                size="sm"
                                variant={(!editor.getAttributes('image').class?.includes('float-') && !editor.getAttributes('image').class?.includes('mx-auto')) ? 'secondary' : 'ghost'}
                                className="h-8 px-2 text-xs"
                                onClick={() => {
                                    const currentClass = editor.getAttributes('image').class || 'max-w-[80%]';
                                    const widthClass = currentClass.match(/max-w-\[.*?\]/) ? currentClass.match(/max-w-\[.*?\]/)[0] : 'max-w-[80%]';
                                    editor.chain().focus().updateAttributes('image', { class: `${widthClass} rounded-lg shadow-sm border my-2 inline-block` }).run()
                                }}
                                title="Em Linha (Padrão)"
                            >
                                <AlignJustify className="w-4 h-4 mr-1" /> Em Linha
                            </Button>
                        </div>
                    </BubbleMenu>
                )}
                <div className="min-h-[300px]">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    )
}
