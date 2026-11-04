import type { JSONContent } from '@tiptap/react';
import type { PresupuestoTablaData } from '@/components/contact/MailEditor';

/** Párrafo que el asistente usa para decir «acá va la tabla con el detalle del presupuesto». */
export const DETAIL_MARKER = '[[DETALLE_DEL_PRESUPUESTO]]';

// ---------------------------------------------------------------------------
// Editor → texto para el asistente (**negrita**, renglones «- » y la marca de la tabla)
// ---------------------------------------------------------------------------

function inline(nodes: JSONContent[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === 'hardBreak') return '\n';
      if (n.type !== 'text') return inline(n.content);
      const text = n.text ?? '';
      return n.marks?.some((m) => m.type === 'bold') ? `**${text}**` : text;
    })
    .join('');
}

function listItems(node: JSONContent, ordered: boolean): string {
  return (node.content ?? [])
    .map((li, i) => `${ordered ? `${i + 1}.` : '-'} ${(li.content ?? []).map((c) => inline(c.content)).join(' ').trim()}`)
    .join('\n');
}

/** Texto plano del editor, con la misma convención que devuelve el asistente. */
export function serializeDoc(doc: JSONContent | null | undefined): string {
  const blocks: string[] = [];
  for (const node of doc?.content ?? []) {
    let text = '';
    if (node.type === 'presupuestoTabla') text = DETAIL_MARKER;
    else if (node.type === 'bulletList') text = listItems(node, false);
    else if (node.type === 'orderedList') text = listItems(node, true);
    else if (node.type === 'blockquote') text = serializeDoc(node);
    else text = inline(node.content);
    if (text.trim()) blocks.push(text.trim());
  }
  return blocks.join('\n\n');
}

// ---------------------------------------------------------------------------
// Párrafos del asistente → contenido del editor
// ---------------------------------------------------------------------------

function inlineNodes(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  text.split('\n').forEach((line, i) => {
    if (i > 0) out.push({ type: 'hardBreak' });
    line.split(/(\*\*[^*]+\*\*)/g).forEach((part) => {
      if (!part) return;
      const bold = /^\*\*[^*]+\*\*$/.test(part);
      const value = bold ? part.slice(2, -2) : part;
      if (value) out.push(bold ? { type: 'text', text: value, marks: [{ type: 'bold' }] } : { type: 'text', text: value });
    });
  });
  return out;
}

/** Arma el documento del editor. La marca se reemplaza por la tabla del presupuesto (si hay datos). */
export function buildDoc(paragraphs: string[], detail: PresupuestoTablaData | null): JSONContent {
  const content: JSONContent[] = [];
  for (const p of paragraphs) {
    if (p.trim() === DETAIL_MARKER) {
      if (detail) content.push({ type: 'presupuestoTabla', attrs: { data: detail } }, { type: 'paragraph' });
      continue;
    }
    const lines = p.split('\n');
    if (lines.length && lines.every((l) => /^\s*-\s+/.test(l))) {
      content.push({
        type: 'bulletList',
        content: lines.map((l) => ({ type: 'listItem', content: [{ type: 'paragraph', content: inlineNodes(l.replace(/^\s*-\s+/, '')) }] })),
      });
      continue;
    }
    content.push({ type: 'paragraph', content: inlineNodes(p) });
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}
