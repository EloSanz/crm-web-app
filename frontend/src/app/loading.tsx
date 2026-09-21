import { LogoMark } from '@/components/brand/Logo';

export default function Loading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-suelo" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <LogoMark className="w-14 h-14 animate-pulse" />
        <p className="text-[15px] font-semibold text-tiza">Cargando Corralap…</p>
      </div>
    </div>
  );
}
