/**
 * Número internacional sólo con dígitos, como lo usa WhatsApp (ej. 5491122334455).
 * Mismo criterio que el backend: los celulares argentinos pasan a 549 + característica + número,
 * sin el 0 de larga distancia ni el 15.
 */
export function whatsappNumber(raw: string | null | undefined, defaultCountry = '54'): string | null {
  if (!raw) return null;
  const text = raw.trim();
  let digits = text.replace(/\D/g, '');
  if (!digits) return null;
  let international = text.startsWith('+');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }

  const stripArMobile = (national: string) => {
    const n = national.replace(/^0+/, '');
    if (n.length === 12) {
      for (const areaLen of [2, 3, 4]) {
        if (n.slice(areaLen, areaLen + 2) === '15') return n.slice(0, areaLen) + n.slice(areaLen + 2);
      }
    }
    return n;
  };

  if (!international && !(digits.startsWith(defaultCountry) && digits.length > 10)) {
    if (defaultCountry === '54') {
      const national = stripArMobile(digits);
      return national.length === 10 ? `549${national}` : null;
    }
    const national = digits.replace(/^0+/, '');
    return national.length >= 6 ? `${defaultCountry}${national}` : null;
  }
  if (digits.startsWith('54')) {
    let national = digits.slice(2);
    if (national.startsWith('9')) national = national.slice(1);
    national = stripArMobile(national);
    return national.length === 10 ? `549${national}` : digits;
  }
  return digits.length >= 8 ? digits : null;
}

/** Enlace a WhatsApp (app o web) con el mensaje precargado. */
export function waLink(raw: string | null | undefined, text?: string): string | null {
  const number = whatsappNumber(raw);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

/** "+54 9 11 2233-4455" a partir de 5491122334455 (para mostrar). */
export function formatWhatsApp(number: string | null | undefined): string {
  if (!number) return '';
  const m = number.match(/^549(\d{2})(\d{4})(\d{4})$/);
  if (m) return `+54 9 ${m[1]} ${m[2]}-${m[3]}`;
  return `+${number}`;
}
