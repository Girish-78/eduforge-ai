"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: false,
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        class:
          "min-h-[240px] rounded-b-xl border border-slate-300 border-t-0 px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      onChange(activeEditor.getHTML());
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-xl">
      <div className="flex flex-wrap gap-2 rounded-t-xl border border-slate-300 bg-slate-50 p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          Bullet List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
        >
          Numbered List
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

