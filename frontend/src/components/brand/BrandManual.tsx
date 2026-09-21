import React from 'react';
import clsx from 'clsx';
import { X } from 'lucide-react';
import { BRAND, Logo, LogoMark, MARK_PATH, PLATE_RADIUS } from './Logo';

/** Manual de marca: versiones, monocromos, área de protección, tamaño mínimo, paleta y usos incorrectos. */
export function BrandManual() {
  return (
    <div className="space-y-8">
      <Block title="Versiones">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Tile label="Horizontal" dark>
            <Logo tone="oscuro" size="lg" />
          </Tile>
          <Tile label="Horizontal">
            <Logo tone="claro" size="lg" />
          </Tile>
          <Tile label="Vertical" dark>
            <Logo tone="oscuro" size="lg" layout="vertical" />
          </Tile>
          <Tile label="Isotipo">
            <LogoMark className="h-20 w-20" />
          </Tile>
        </div>
      </Block>

      <Block title="Monocromo">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Tile label="Negro sólido" surface="bg-white">
            <Logo tone="negro" size="lg" />
            <LogoMark tone="negro" className="h-12 w-12" />
          </Tile>
          <Tile label="Blanco puro" surface="bg-[#111111]" dark>
            <Logo tone="blanco" size="lg" />
            <LogoMark tone="blanco" className="h-12 w-12" />
          </Tile>
        </div>
      </Block>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Block title="Área de protección">
          <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-linea bg-chapa p-6">
            <ProtectionArea />
          </div>
        </Block>

        <Block title="Tamaño mínimo">
          <div className="flex min-h-[220px] flex-wrap items-center justify-center gap-x-10 gap-y-6 rounded-2xl border border-linea bg-chapa p-6">
            <MinSize caption="16 px · 6 mm">
              <LogoMark className="h-4 w-4" />
            </MinSize>
            <MinSize caption="32 px · 10 mm">
              <LogoMark className="h-8 w-8" />
            </MinSize>
            <MinSize caption="120 px · 35 mm">
              <Logo tone="claro" size="sm" className="w-[120px] justify-between text-[14px] [&>svg]:h-6 [&>svg]:w-6" />
            </MinSize>
          </div>
        </Block>
      </div>

      <Block title="Paleta de marca">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Swatch name="Amarillo vial" hex={BRAND.amarillo} />
          <Swatch name="Pavonado" hex={BRAND.pavonado} />
          <Swatch name="Negro" hex={BRAND.negro} />
          <Swatch name="Blanco" hex={BRAND.blanco} bordered />
        </div>
      </Block>

      <Block title="Usos incorrectos">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <Wrong label="Deformar">
            <LogoMark className="h-14 w-14 scale-x-[1.45]" />
          </Wrong>
          <Wrong label="Rotar">
            <LogoMark className="h-14 w-14 -rotate-12" />
          </Wrong>
          <Wrong label="Cambiar colores">
            <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
              <rect width="64" height="64" rx={PLATE_RADIUS} fill="#2563eb" />
              <path d={MARK_PATH} fill="#ffffff" />
            </svg>
          </Wrong>
          <Wrong label="Degradés">
            <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden>
              <defs>
                <linearGradient id="mal-degrade" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffe27a" />
                  <stop offset="1" stopColor="#e8830c" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx={PLATE_RADIUS} fill="url(#mal-degrade)" />
              <path d={MARK_PATH} fill={BRAND.pavonado} />
            </svg>
          </Wrong>
          <Wrong label="Sombras o 3D">
            <LogoMark className="h-14 w-14 drop-shadow-[5px_6px_0_#7a5500]" />
          </Wrong>
          <Wrong label="Ladrillos sin placa sobre claro">
            <svg viewBox="10 10 44 44" className="h-12 w-12" aria-hidden>
              <path d={MARK_PATH} fill={BRAND.amarillo} />
            </svg>
          </Wrong>
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[15px] font-bold">{title}</h3>
      {children}
    </div>
  );
}

function Tile({ label, dark = false, surface, children }: { label: string; dark?: boolean; surface?: string; children: React.ReactNode }) {
  return (
    <figure
      className={clsx(
        'relative flex min-h-[180px] flex-wrap items-center justify-center gap-8 rounded-2xl p-6 pb-10',
        surface ?? (dark ? 'sobre-pavonado bg-pavonado' : 'border border-linea bg-chapa')
      )}
    >
      {children}
      <figcaption className={clsx('absolute bottom-3 left-4 text-[13px] font-semibold', dark ? 'text-niebla' : 'text-tiza')}>{label}</figcaption>
    </figure>
  );
}

/** El margen libre alrededor del logo es "x": el alto de una hilada de ladrillos. */
function ProtectionArea() {
  return (
    <div className="relative">
      <div className="rounded-lg border-2 border-dashed border-ambar/70 bg-amarillo-velo/60 p-[26px]">
        <Logo tone="claro" size="lg" className="bg-chapa" />
      </div>
      {[
        'left-0 top-1/2 -translate-y-1/2',
        'right-0 top-1/2 -translate-y-1/2',
        'left-1/2 top-0 -translate-x-1/2',
        'left-1/2 bottom-0 -translate-x-1/2',
      ].map((pos) => (
        <span key={pos} className={clsx('absolute flex h-[26px] w-[26px] items-center justify-center text-[13px] font-extrabold text-ambar-tinta', pos)}>
          x
        </span>
      ))}
    </div>
  );
}

function MinSize({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-10 items-end">{children}</div>
      <p className="cifra text-[13px] font-semibold text-tiza">{caption}</p>
    </div>
  );
}

function Swatch({ name, hex, bordered = false }: { name: string; hex: string; bordered?: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-linea bg-chapa">
      <div className={clsx('h-20', bordered && 'border-b border-linea')} style={{ background: hex }} />
      <div className="px-3 py-2">
        <p className="truncate text-sm font-bold">{name}</p>
        <p className="cifra text-[13px] text-tiza">{hex}</p>
      </div>
    </div>
  );
}

function Wrong({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col overflow-hidden rounded-xl border border-linea bg-chapa">
      <div className="flex h-28 items-center justify-center overflow-hidden">{children}</div>
      <figcaption className="flex items-start gap-2 border-t border-linea px-3 py-2.5 text-[13px] font-semibold leading-snug">
        <span className="mt-px inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rojo text-white">
          <X className="h-3 w-3" strokeWidth={3} aria-hidden />
        </span>
        <span className="min-w-0">{label}</span>
      </figcaption>
    </figure>
  );
}
