'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { common, createLowlight } from 'lowlight';
import { useCallback } from 'react';

import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  Image as ImageIcon,
  Link as LinkIcon,
  Table as TableIcon,
  Undo,
  Redo,
} from 'lucide-react';

const lowlight = createLowlight(common);

interface ArticleEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function ArticleEditor({ content, onChange, placeholder }: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ 
        codeBlock: false,
        heading: {
          levels: [2, 3],
        },
      }),
      Image.configure({ 
        allowBase64: true, 
        inline: true,
      }),
      Link.configure({ 
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      CodeBlockLowlight.configure({ 
        lowlight,
        HTMLAttributes: {
          class: 'bg-gray-100 p-2 rounded text-sm font-mono',
        },
      }),
      Table.configure({ 
        resizable: true,
        HTMLAttributes: {
          class: 'border-collapse w-full',
        },
      }),
      TableRow,
      TableCell.configure({
        HTMLAttributes: {
          class: 'border p-2',
        },
      }),
      TableHeader.configure({
        HTMLAttributes: {
          class: 'border p-2 bg-gray-50 font-semibold',
        },
      }),
      Placeholder.configure({ 
        placeholder: placeholder || 'Start writing your article...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const addImage = useCallback(() => {
    const url = window.prompt('Image URL');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const addLink = useCallback(() => {
    const url = window.prompt('Link URL');
    if (url && editor) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  const insertTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    }
  }, [editor]);

  if (!editor) return null;

  const ToolbarButton = ({ 
    onClick, 
    active, 
    icon: Icon, 
    title 
  }: { 
    onClick: () => void; 
    active?: boolean; 
    icon: typeof Bold;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded transition-colors ${
        active 
          ? 'bg-gray-200 text-gray-900' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            icon={Bold}
            title="Bold"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            icon={Italic}
            title="Italic"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            icon={Strikethrough}
            title="Strikethrough"
          />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-gray-300">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive('heading', { level: 2 })}
            icon={Heading2}
            title="Heading 2"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive('heading', { level: 3 })}
            icon={Heading3}
            title="Heading 3"
          />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-gray-300">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            icon={List}
            title="Bullet List"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            icon={ListOrdered}
            title="Numbered List"
          />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-gray-300">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            icon={Code}
            title="Code Block"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            icon={Quote}
            title="Quote"
          />
        </div>

        <div className="flex items-center gap-1 px-2 border-r border-gray-300">
          <ToolbarButton
            onClick={addImage}
            icon={ImageIcon}
            title="Insert Image"
          />
          <ToolbarButton
            onClick={addLink}
            active={editor.isActive('link')}
            icon={LinkIcon}
            title="Insert Link"
          />
          <ToolbarButton
            onClick={insertTable}
            icon={TableIcon}
            title="Insert Table"
          />
        </div>

        <div className="flex items-center gap-1 pl-2">
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            icon={Undo}
            title="Undo"
          />
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            icon={Redo}
            title="Redo"
          />
        </div>
      </div>

      {/* Editor */}
      <EditorContent 
        editor={editor} 
        className="prose prose-sm max-w-none p-4 min-h-[300px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[300px] [&_.ProseMirror-focused]:outline-none [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_p.is-editor-empty:first-child::before]:text-gray-400 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:pointer-events-none"
      />
    </div>
  );
}
