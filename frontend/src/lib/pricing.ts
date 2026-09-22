import type { Product } from '@/types/crm';

/** Lista de precios del catálogo que corresponde a una cantidad. */
export type CatalogPriceTier = 'minorista' | 'mayorista';

export interface TierPrice {
  tier: CatalogPriceTier;
  /** Precio unitario que corresponde a la cantidad pedida. */
  unitPrice: number;
  /** Precio minorista de lista, para mostrar el ahorro. */
  listPrice: number;
}

type PricedProduct = Pick<Product, 'unit_price' | 'wholesale_price' | 'wholesale_min_qty'>;

/** La API manda los montos como texto decimal ("9800.00"). */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** true si el material tiene precio mayorista cargado. */
export function hasWholesale(product: PricedProduct): boolean {
  return toNumber(product.wholesale_price) !== null && toNumber(product.wholesale_min_qty) !== null;
}

/** Precio por unidad según la cantidad: mayorista desde `wholesale_min_qty`, minorista por debajo. */
export function priceFor(product: PricedProduct, qty: number): TierPrice {
  const listPrice = toNumber(product.unit_price) ?? 0;
  const wholesale = toNumber(product.wholesale_price);
  const minQty = toNumber(product.wholesale_min_qty);
  if (wholesale !== null && minQty !== null && qty >= minQty && wholesale <= listPrice) {
    return { tier: 'mayorista', unitPrice: wholesale, listPrice };
  }
  return { tier: 'minorista', unitPrice: listPrice, listPrice };
}

/** Monto con un descuento porcentual (0–100), redondeado a centavos. */
export function applyDiscount(amount: number, pct: number): number {
  const safePct = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  return round2(amount * (1 - safePct / 100));
}

/** Subtotal de un renglón: cantidad × precio unitario, menos el descuento del renglón. */
export function lineSubtotal(qty: number, unitPrice: number, discountPct = 0): number {
  return applyDiscount(round2(qty * unitPrice), discountPct);
}

/** Cuánto más barato es `price` respecto de `listPrice`, en % entero (0 si no hay rebaja). */
export function percentOff(listPrice: number, price: number): number {
  if (!(listPrice > 0) || !(price < listPrice)) return 0;
  return Math.round((1 - price / listPrice) * 100);
}

const ABBREVIATED_UNIT = /^(kg|g|t|tn|m|ml|l|lt|lts|cm|mm|m2|m²|m3|m³)$/i;

function unitWord(unit: string | null | undefined): string {
  const word = (unit || '').trim().split(/[\s(]/)[0] ?? '';
  if (/^m3$/i.test(word)) return 'm³';
  if (/^m2$/i.test(word)) return 'm²';
  return word;
}

function pluralize(word: string): string {
  if (ABBREVIATED_UNIT.test(word)) return word;
  return /[aeiouáéíóú]$/i.test(word) ? `${word}s` : `${word}es`;
}

/** Cantidad con la unidad corta del material: "50 bolsas", "20 barras", "6 m³", "1.000 unidades". */
export function formatUnitQty(qty: number | string, unit: string | null | undefined): string {
  const n = Number(qty);
  const text = n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
  const word = unitWord(unit);
  if (!word) return text;
  return `${text} ${n === 1 ? word : pluralize(word)}`;
}

/** Sufijo corto de la unidad para un campo de cantidad (entra en ~7 caracteres). */
export function unitSuffix(unit: string | null | undefined): string {
  const word = unitWord(unit);
  if (!word) return '';
  if (/^unidad$/i.test(word)) return 'unid.';
  const plural = pluralize(word);
  if (plural.length <= 7) return plural;
  return word.length <= 7 ? word : `${word.slice(0, 5)}.`;
}
