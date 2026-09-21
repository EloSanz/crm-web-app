import React from 'react';

/**
 * Ilustraciones de estados vacíos, dibujadas con la paleta de Corralap:
 * pavonado para la estructura, niebla y línea para el volumen, amarillo vial para máquinas y cascos.
 * Formas macizas, sin degradés.
 */

const P = '#16212b';
const P3 = '#2c3f51';
const N = '#a9b8c2';
const L = '#dce1df';
const S = '#f4f6f5';
const V = '#1b8049';
const VC = '#3dbe74';
const A = '#e8830c';
const AC = '#f7b25e';
/** Amarillo vial de marca: cascos, máquinas, señalización. */
const Y = '#ffc20e';

function Punta({ x, y, r = 6, c = V, core = VC }: { x: number; y: number; r?: number; c?: string; core?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={c} />
      <circle cx={x} cy={y} r={r * 0.4} fill={core} />
    </g>
  );
}

/** Obra en construcción: estructura de hormigón, andamio, grúa y un atado de hierros al pie. */
export function ObraIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden>
      <ellipse cx="120" cy="146" rx="104" ry="8" fill={L} />
      {/* Grúa */}
      <rect x="175" y="22" width="8" height="122" fill={Y} />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="175" y={32 + i * 14} width="8" height="3" fill={P} opacity="0.18" />
      ))}
      <rect x="112" y="16" width="96" height="8" rx="1" fill={Y} />
      <rect x="196" y="24" width="12" height="10" rx="1.5" fill={P} />
      <rect x="129" y="24" width="2" height="34" fill={P} />
      <rect x="120" y="58" width="20" height="9" rx="1" fill={P3} />
      <path d="M179 10 L179 18" stroke={P} strokeWidth="2" />
      {/* Estructura */}
      <rect x="40" y="62" width="112" height="82" fill={S} />
      {[62, 88, 114].map((y) => (
        <rect key={y} x="36" y={y} width="120" height="7" rx="1" fill={P3} />
      ))}
      {[44, 76, 108, 140].map((x) => (
        <rect key={x} x={x} y="62" width="8" height="82" fill={P} />
      ))}
      {/* Mampostería a medio levantar */}
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`} x={54 + col * 7 + (row % 2) * 3} y={128 - row * 5} width="6" height="4" rx="0.6" fill={N} />
        ))
      )}
      <rect x="86" y="96" width="20" height="16" rx="1" fill={L} />
      {/* Andamio */}
      <path d="M160 70 L160 144 M170 70 L170 144 M158 96 L172 96 M158 120 L172 120 M160 96 L170 120 M170 96 L160 120" stroke={N} strokeWidth="1.6" />
      {/* Atado de hierros */}
      <g>
        <rect x="14" y="132" width="36" height="12" rx="2" fill={P3} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={20 + i * 6} cy={138} r="2.4" fill={N} />
        ))}
        <Punta x={44} y={138} r={3.2} />
      </g>
      {/* Bolsas */}
      <rect x="196" y="126" width="20" height="18" rx="3" fill={N} />
      <rect x="204" y="118" width="20" height="16" rx="3" fill={L} stroke={N} />
    </svg>
  );
}

/** Clientes: tarjeta de contacto de un maestro mayor de obra, con casco y teléfono. */
export function ClientesIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden>
      <ellipse cx="120" cy="146" rx="96" ry="8" fill={L} />
      <rect x="62" y="44" width="136" height="88" rx="12" fill={S} stroke={L} strokeWidth="2" transform="rotate(6 130 88)" />
      <rect x="42" y="36" width="136" height="88" rx="12" fill="#fff" stroke={L} strokeWidth="2" />
      {/* Avatar con casco */}
      <circle cx="80" cy="80" r="22" fill={L} />
      <circle cx="80" cy="86" r="10" fill={N} />
      <path d="M62 78 a18 18 0 0 1 36 0 z" fill={Y} />
      <rect x="58" y="76" width="44" height="5" rx="2.5" fill={P} />
      <rect x="77" y="60" width="6" height="18" rx="2" fill={P} opacity="0.25" />
      {/* Datos */}
      <rect x="114" y="62" width="48" height="7" rx="3.5" fill={P} />
      <rect x="114" y="76" width="36" height="6" rx="3" fill={N} />
      <rect x="114" y="92" width="30" height="16" rx="8" fill={P} />
      <path d="M124 100 l3 3 m-3-3 c1-4 5-4 6 0" stroke="#fff" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <Punta x={166} y={100} r={6} />
    </svg>
  );
}

/** Presupuestos: la hoja del presupuesto con renglones, total y su punta de seguimiento. */
export function PresupuestoIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden>
      <ellipse cx="120" cy="148" rx="80" ry="7" fill={L} />
      <rect x="78" y="18" width="92" height="124" rx="10" fill="#fff" stroke={L} strokeWidth="2" transform="rotate(-4 124 80)" />
      <rect x="70" y="14" width="92" height="124" rx="10" fill="#fff" stroke={L} strokeWidth="2" />
      <rect x="70" y="14" width="92" height="26" rx="10" fill={P} />
      <rect x="70" y="30" width="92" height="10" fill={P} />
      <rect x="79" y="20" width="12" height="12" rx="2.5" fill={Y} />
      <rect x="96" y="22" width="40" height="6" rx="3" fill="#ebedec" opacity="0.9" />
      {[52, 66, 80, 94].map((y, i) => (
        <g key={y}>
          <rect x="82" y={y} width={i % 2 ? 34 : 44} height="6" rx="3" fill={L} />
          <rect x="134" y={y} width="16" height="6" rx="3" fill={N} />
        </g>
      ))}
      <path d="M82 110 H150" stroke={L} strokeWidth="2" strokeDasharray="4 3" />
      <rect x="82" y="118" width="24" height="7" rx="3.5" fill={N} />
      <rect x="118" y="116" width="32" height="10" rx="5" fill={P} />
      <Punta x={170} y={36} r={11} c={A} core={AC} />
    </svg>
  );
}

/** Catálogo: bolsas de cemento sobre un pallet y un atado de hierros. */
export function CatalogoIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden>
      <ellipse cx="120" cy="146" rx="100" ry="8" fill={L} />
      {/* Pallet */}
      <rect x="52" y="128" width="100" height="6" rx="1" fill={P3} />
      {[56, 98, 140].map((x) => (
        <rect key={x} x={x} y="134" width="8" height="8" fill={P} />
      ))}
      {/* Bolsas */}
      {[
        [56, 104],
        [88, 104],
        [120, 104],
        [72, 80],
        [104, 80],
        [88, 56],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y} width="30" height="24" rx="5" fill={i === 5 ? '#fff' : S} stroke={N} strokeWidth="1.5" />
          <rect x={x + 6} y={y + 9} width="18" height="6" rx="3" fill={i === 5 ? V : L} />
        </g>
      ))}
      {/* Hierros */}
      <g transform="rotate(-8 186 120)">
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="164" y={96 + i * 7} width="54" height="4" rx="2" fill={P3} />
        ))}
        <rect x="214" y="95" width="6" height="6" rx="1" fill={Y} />
      </g>
    </svg>
  );
}

/** Sin resultados: una lupa sobre un paño de pared. */
export function BusquedaIllustration({ className }: { className?: string }) {
  const courses = [0, 1, 2, 3];
  return (
    <svg viewBox="0 0 240 160" className={className} aria-hidden>
      <ellipse cx="120" cy="146" rx="70" ry="7" fill={L} />
      {courses.map((row) =>
        [0, 1, 2, 3].map((col) => {
          const offset = row % 2 ? 14 : 0;
          const x = 62 + offset + col * 29;
          const w = row % 2 && col === 3 ? 13 : 27;
          return <rect key={`${row}-${col}`} x={x} y={122 - row * 17} width={w} height="15" rx="2" fill={row === 3 && col === 1 ? Y : S} stroke={N} strokeWidth="2" />;
        })
      )}
      <circle cx="146" cy="84" r="26" fill="#fff" fillOpacity="0.6" stroke={P} strokeWidth="7" />
      <rect x="162" y="104" width="34" height="11" rx="5.5" fill={P} transform="rotate(42 166 106)" />
    </svg>
  );
}

export const ILLUSTRATIONS = {
  obra: ObraIllustration,
  clientes: ClientesIllustration,
  presupuestos: PresupuestoIllustration,
  catalogo: CatalogoIllustration,
  busqueda: BusquedaIllustration,
};

export type IllustrationName = keyof typeof ILLUSTRATIONS;
