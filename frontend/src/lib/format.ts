const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const arsCentsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 1,
});

/** Monto en pesos sin centavos: el vendedor lee "$ 1.250.000", no "$ 1.250.000,00". */
export function formatARS(amount: number | string | null | undefined): string {
  return arsFormatter.format(Number(amount || 0));
}

/** Monto con centavos, para precios unitarios del catálogo. */
export function formatARSCents(amount: number | string | null | undefined): string {
  return arsCentsFormatter.format(Number(amount || 0));
}

/** Monto abreviado para espacios chicos: "$ 1,3 M", "$ 850 mil". */
export function formatARSCompact(amount: number | string | null | undefined): string {
  const value = Number(amount || 0);
  if (Math.abs(value) >= 1_000_000) return `$\u00a0${compactFormatter.format(value / 1_000_000)}\u00a0M`;
  if (Math.abs(value) >= 10_000) return `$\u00a0${compactFormatter.format(value / 1_000)}\u00a0mil`;
  return formatARS(value);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "hoy", "ayer", "hace 9 días". */
export function formatDaysAgo(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'sin contacto';
  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/** Referencia corta y estable para leer un presupuesto en voz alta ("P-3F2A"). */
export function shortRef(id: string): string {
  return `P-${id.replace(/-/g, '').slice(0, 4).toUpperCase()}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '·';
  return name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  return digits ? `tel:${digits}` : null;
}

/** "Presupuesto en Preparación" → "Presupuesto en preparación". */
export function sentenceCase(text: string | null | undefined): string {
  if (!text) return '';
  const lower = text.toLocaleLowerCase('es-AR');
  return lower.charAt(0).toLocaleUpperCase('es-AR') + lower.slice(1);
}

/** "260 bolsas de 25 kg", "12 barras de 12 m", "18 m³", "1 viaje". */
export function formatQty(quantity: number | string, unit: string | null | undefined): string {
  const n = Number(quantity);
  const qty = n.toLocaleString('es-AR');
  const u = (unit || '').trim();
  if (!u) return qty;
  if (/^m3$|^m³$/i.test(u)) return `${qty} m³`;
  const m = u.match(/^([a-záéíóúñ]+)\s*(.*)$/i);
  if (!m) return `${qty} ${u}`;
  let word = m[1];
  const rest = m[2].replace(/(\d)([a-z]+)/i, '$1 $2').trim();
  if (n !== 1) word = /[aeiouáéíóú]$/i.test(word) ? `${word}s` : `${word}es`;
  return `${qty} ${word}${rest ? ` de ${rest}` : ''}`;
}

/** CUIT mientras se escribe: sólo dígitos (hasta 11) con los guiones en su lugar → 30-71234567-8. */
export function formatCuit(value: string): string {
  const d = value.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Dígito verificador del CUIT (módulo 11 de AFIP). */
export function isValidCuit(value: string): boolean {
  const d = value.replace(/\D/g, '');
  if (d.length !== 11) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((acc, w, i) => acc + w * Number(d[i]), 0);
  const check = 11 - (sum % 11);
  const expected = check === 11 ? 0 : check;
  return expected !== 10 && expected === Number(d[10]);
}

/**
 * Teléfono mientras se escribe: sólo dígitos, máximo 10 (formato local, sin código de país).
 * Si viene con código de país, 0 o 15 (un número pegado o uno ya cargado como +54 9 11 4843-9238),
 * se pasa a formato local en vez de cortarlo: así no se pierden los últimos dígitos.
 */
export function formatPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 10) {
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('54') && digits.length > 10) {
      digits = digits.slice(2);
      if (digits.startsWith('9') && digits.length === 11) digits = digits.slice(1);
    }
    digits = digits.replace(/^0+/, '');
    if (digits.length === 12) {
      for (const area of [2, 3, 4]) {
        if (digits.slice(area, area + 2) === '15') {
          digits = digits.slice(0, area) + digits.slice(area + 2);
          break;
        }
      }
    }
  }
  return digits.slice(0, 10);
}

/** DNI mientras se escribe: sólo dígitos, máximo 8 (los más viejos tienen 7). */
export function formatDni(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

/** DNI válido: 7 u 8 dígitos. */
export function isValidDni(value: string): boolean {
  const n = value.replace(/\D/g, '').length;
  return n === 7 || n === 8;
}
