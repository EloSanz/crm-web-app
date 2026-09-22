'use client';

import React, { useState } from 'react';
import clsx from 'clsx';
import { EditorContent, Node, mergeAttributes, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Check, Italic, Link2, List, ListOrdered, Redo2, Underline, Undo2, Unlink, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ---------------------------------------------------------------------------
// Tabla con el detalle del presupuesto (bloque atómico, con estilos en línea aptos para correo)
// ---------------------------------------------------------------------------

export interface PresupuestoTablaData {
  title: string;
  reference: string;
  rows: { material: string; cantidad: string; precio: string; subtotal: string }[];
  /** Renglones previos al total: subtotal y descuento general, si hay. */
  extras: { label: string; value: string }[];
  total: string;
}

const CELL = 'padding:8px 10px;border-bottom:1px solid #dce1df;vertical-align:top;';
const NUM = 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;';
const HEAD = 'padding:8px 10px;background-color:#f4f6f5;border-bottom:2px solid #16212B;font-size:13px;font-weight:700;text-align:left;';
const STYLES = {
  table: 'width:100%;border-collapse:collapse;margin:4px 0 16px 0;font-size:14px;line-height:1.4;color:#16212B;',
  caption: 'caption-side:top;text-align:left;font-size:15px;font-weight:700;padding:0 0 8px 0;color:#16212B;',
  th: HEAD,
  thNum: HEAD + NUM,
  td: CELL,
  tdNum: CELL + NUM,
  extraLabel: 'padding:6px 10px;color:#5a666f;',
  extraValue: 'padding:6px 10px;color:#5a666f;' + NUM,
  totalLabel: 'padding:10px;border-top:2px solid #16212B;font-weight:800;',
  totalValue: 'padding:10px;border-top:2px solid #16212B;font-weight:800;font-size:16px;' + NUM,
};

export const PresupuestoTabla = Node.create({
  name: 'presupuestoTabla',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      data: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          try {
            return JSON.parse(el.getAttribute('data-presupuesto') || 'null');
          } catch {
            return null;
          }
        },
        renderHTML: (attrs: { data?: PresupuestoTablaData | null }) => ({ 'data-presupuesto': JSON.stringify(attrs.data ?? null) }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-presupuesto]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const d = node.attrs.data as PresupuestoTablaData | null;
    const wrapper = mergeAttributes(HTMLAttributes, { style: 'overflow-x:auto;' });
    if (!d) return ['div', wrapper];
    return [
      'div',
      wrapper,
      [
        'table',
        { style: STYLES.table, cellpadding: '0', cellspacing: '0' },
        ['caption', { style: STYLES.caption }, `${d.title} · ${d.reference}`],
        [
          'thead',
          {},
          ['tr', {}, ['th', { style: STYLES.th }, 'Material'], ['th', { style: STYLES.th }, 'Cantidad'], ['th', { style: STYLES.thNum }, 'Precio unit.'], ['th', { style: STYLES.thNum }, 'Subtotal']],
        ],
        [
          'tbody',
          {},
          ...d.rows.map((r) => [
            'tr',
            {},
            ['td', { style: STYLES.td }, r.material],
            ['td', { style: STYLES.td }, r.cantidad],
            ['td', { style: STYLES.tdNum }, r.precio],
            ['td', { style: STYLES.tdNum }, r.subtotal],
          ]),
        ],
        [
          'tfoot',
          {},
          ...d.extras.map((x) => ['tr', {}, ['td', { colspan: '3', style: STYLES.extraLabel }, x.label], ['td', { style: STYLES.extraValue }, x.value]]),
          ['tr', {}, ['td', { colspan: '3', style: STYLES.totalLabel }, 'Total'], ['td', { style: STYLES.totalValue }, d.total]],
        ],
      ],
    ];
  },
});

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

const EDITOR_CLASS = [
  'min-h-[240px] px-4 py-3.5 text-[15px] leading-relaxed text-tinta outline-none sm:min-h-[300px]',
  '[&_p]:my-0 [&_p+p]:mt-3 [&_strong]:font-bold',
  '[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1',
  '[&_a]:font-semibold [&_a]:underline [&_a]:decoration-tiza [&_a]:underline-offset-2',
  '[&_.ProseMirror-selectednode]:rounded-md [&_.ProseMirror-selectednode]:outline-2 [&_.ProseMirror-selectednode]:outline-offset-2 [&_.ProseMirror-selectednode]:outline-pavonado',
  // Placeholder de TipTap: se muestra con el atributo data-placeholder del primer párrafo vacío.
  '[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left',
  '[&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-[#7d8a92]',
  '[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
].join(' ');

const EXTENSIONS = [
  StarterKit.configure({
    heading: false,
    code: false,
    codeBlock: false,
    blockquote: false,
    horizontalRule: false,
    strike: false,
    link: {
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      protocols: ['http', 'https', 'mailto', 'tel'],
      HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
    },
  }),
  Placeholder.configure({ placeholder: 'Escribí el mensaje' }),
  PresupuestoTabla,
];

/** Editor del cuerpo del correo. `onChange` debe ser estable (se fija al crear el editor). */
export function useMailEditor(initialHtml: string, onChange: (html: string, isEmpty: boolean) => void): Editor | null {
  return useEditor({
    immediatelyRender: false,
    extensions: EXTENSIONS,
    content: initialHtml,
    editorProps: {
      attributes: { class: EDITOR_CLASS, role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Mensaje' },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML(), editor.isEmpty),
  });
}

export function insertPresupuestoTabla(editor: Editor, data: PresupuestoTablaData) {
  // Si todavía no se escribió nada con el cursor (selección al principio), va al final del mensaje.
  const atStart = editor.state.selection.from <= 1 && !editor.isEmpty;
  // Con un párrafo después, el cursor queda debajo de la tabla para seguir escribiendo.
  editor
    .chain()
    .focus(atStart ? 'end' : undefined)
    .insertContent([{ type: 'presupuestoTabla', attrs: { data } }, { type: 'paragraph' }])
    .run();
}

function normalizeHref(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  return `https://${v.replace(/^\/+/, '')}`;
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        'h-9 w-8 shrink-0 inline-flex items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer disabled:cursor-default disabled:opacity-35 sm:w-9',
        pressed ? 'bg-pavonado text-white' : 'text-tinta hover:bg-chapa-2'
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 hidden h-6 w-px shrink-0 bg-linea sm:block" aria-hidden />;

/** Barra de formato + área de escritura, con el mismo borde y foco que un campo. */
export function MailEditor({ editor, actions }: { editor: Editor | null; actions?: React.ReactNode }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const state = useEditorState({
    editor,
    selector: ({ editor: ed }) =>
      ed
        ? {
            bold: ed.isActive('bold'),
            italic: ed.isActive('italic'),
            underline: ed.isActive('underline'),
            bullet: ed.isActive('bulletList'),
            ordered: ed.isActive('orderedList'),
            link: ed.isActive('link'),
            canUndo: ed.can().undo(),
            canRedo: ed.can().redo(),
          }
        : null,
  });

  const run = (fn: (ed: Editor) => void) => () => {
    if (editor) fn(editor);
  };

  const openLink = () => {
    if (!editor) return;
    setLinkValue((editor.getAttributes('link').href as string | undefined) ?? '');
    setLinkOpen(true);
  };

  const applyLink = () => {
    if (!editor) return;
    const href = normalizeHref(linkValue);
    const chain = editor.chain().focus();
    if (!href) chain.extendMarkRange('link').unsetLink().run();
    else if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: linkValue.trim(), marks: [{ type: 'link', attrs: { href } }] }).run();
    } else chain.extendMarkRange('link').setLink({ href }).run();
    setLinkOpen(false);
  };

  const removeLink = () => {
    editor?.chain().focus().extendMarkRange('link').unsetLink().run();
    setLinkOpen(false);
  };

  return (
    <div className="min-w-0 overflow-hidden rounded-[10px] border border-linea-fuerte bg-chapa transition-[border-color,box-shadow] duration-150 focus-within:border-tinta focus-within:shadow-[0_0_0_3px_rgb(22_33_43/0.14)]">
      <div role="toolbar" aria-label="Formato del mensaje" className="flex flex-wrap items-center gap-0.5 border-b border-linea bg-chapa-2/60 px-1 py-1 sm:px-1.5">
        <ToolButton label="Negrita" pressed={state?.bold} disabled={!editor} onClick={run((ed) => ed.chain().focus().toggleBold().run())}>
          <Bold className="w-4 h-4" strokeWidth={2.5} />
        </ToolButton>
        <ToolButton label="Cursiva" pressed={state?.italic} disabled={!editor} onClick={run((ed) => ed.chain().focus().toggleItalic().run())}>
          <Italic className="w-4 h-4" />
        </ToolButton>
        <ToolButton label="Subrayado" pressed={state?.underline} disabled={!editor} onClick={run((ed) => ed.chain().focus().toggleUnderline().run())}>
          <Underline className="w-4 h-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Lista con viñetas" pressed={state?.bullet} disabled={!editor} onClick={run((ed) => ed.chain().focus().toggleBulletList().run())}>
          <List className="w-4 h-4" />
        </ToolButton>
        <ToolButton label="Lista numerada" pressed={state?.ordered} disabled={!editor} onClick={run((ed) => ed.chain().focus().toggleOrderedList().run())}>
          <ListOrdered className="w-4 h-4" />
        </ToolButton>
        <ToolButton label="Enlace" pressed={state?.link || linkOpen} disabled={!editor} onClick={() => (linkOpen ? setLinkOpen(false) : openLink())}>
          <Link2 className="w-4 h-4" />
        </ToolButton>
        <Divider />
        <ToolButton label="Deshacer" disabled={!state?.canUndo} onClick={run((ed) => ed.chain().focus().undo().run())}>
          <Undo2 className="w-4 h-4" />
        </ToolButton>
        <ToolButton label="Rehacer" disabled={!state?.canRedo} onClick={run((ed) => ed.chain().focus().redo().run())}>
          <Redo2 className="w-4 h-4" />
        </ToolButton>
        {actions && <div className="ml-auto flex min-w-0 items-center">{actions}</div>}
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-linea px-3 py-2">
          <label htmlFor="enlace-url" className="sr-only">
            Dirección del enlace
          </label>
          <input
            id="enlace-url"
            autoFocus
            type="text"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setLinkOpen(false);
                editor?.commands.focus();
              }
            }}
            placeholder="corralap.com.ar/obra"
            className="h-9 min-w-0 flex-1 basis-40 rounded-lg border border-linea-fuerte bg-chapa px-3 text-[15px] outline-none focus:border-tinta"
          />
          <div className="flex items-center gap-1">
            <Button size="sm" variant="secundario" onClick={applyLink}>
              <Check className="w-4 h-4" aria-hidden />
              Aplicar
            </Button>
            {state?.link && (
              <Button size="icono-sm" variant="fantasma" onClick={removeLink} aria-label="Quitar enlace" title="Quitar enlace">
                <Unlink className="w-4 h-4" />
              </Button>
            )}
            <Button size="icono-sm" variant="fantasma" onClick={() => setLinkOpen(false)} aria-label="Cerrar" title="Cerrar">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
