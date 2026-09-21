import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/LoginForm";
import { Logo } from "@/components/brand/Logo";
import { BrandArt } from "@/components/brand/BrandArt";

export const metadata: Metadata = {
  title: "Ingresar",
};

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh bg-suelo lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="sobre-pavonado grano-pavonado relative flex flex-col overflow-hidden px-6 pb-8 pt-[max(1.75rem,env(safe-area-inset-top))] text-white lg:p-14">
        <Logo tone="oscuro" size="md" className="lg:hidden" />
        <Logo tone="oscuro" size="lg" className="hidden lg:inline-flex" />
        <BrandArt className="pointer-events-none absolute -right-[12%] top-[16%] hidden aspect-square w-[62%] max-w-[560px] lg:block" />
        <p className="titular relative z-[1] mt-8 max-w-[14ch] text-[34px] leading-[1.05] lg:mt-auto lg:text-[56px]">Cada presupuesto, al día.</p>
      </section>
      <section className="flex items-start justify-center px-6 py-10 lg:items-center lg:p-14">
        <LoginForm />
      </section>
    </main>
  );
}
