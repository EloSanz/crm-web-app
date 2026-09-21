import { LogoLoader } from '@/components/brand/LogoLoader';

export default function Loading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-suelo">
      <LogoLoader className="h-20 w-20" label="Cargando Corralap…" showLabel />
    </div>
  );
}
