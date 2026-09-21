import React from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito' | 'claro';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icono' | 'icono-sm';

const base =
  'relative inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] font-semibold whitespace-nowrap select-none ' +
  'transition-[background-color,color,border-color,box-shadow,transform] duration-150 ' +
  'active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none cursor-pointer';

const variants: Record<ButtonVariant, string> = {
  primario: 'bg-amarillo text-pavonado font-bold shadow-[0_1px_2px_rgb(22_33_43/0.18)] hover:bg-amarillo-2',
  secundario: 'border border-linea-fuerte bg-chapa text-tinta hover:border-tiza hover:bg-chapa-2',
  fantasma: 'text-tiza hover:text-tinta hover:bg-chapa-2',
  peligro: 'bg-rojo text-white hover:bg-rojo-tinta',
  exito: 'bg-verde text-white shadow-[0_1px_2px_rgb(20_99_55/0.3)] hover:bg-verde-tinta',
  claro: 'bg-white/10 text-white border border-white/15 hover:bg-white/15',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4 text-[15px]',
  lg: 'h-12 px-5 text-[15px]',
  icono: 'h-11 w-11',
  'icono-sm': 'h-9 w-9',
};

export function buttonClasses(variant: ButtonVariant = 'primario', size: ButtonSize = 'md', className?: string) {
  return twMerge(clsx(base, variants[variant], sizes[size], className));
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primario', size = 'md', isLoading = false, children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

interface ButtonLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ href, variant = 'primario', size = 'md', className, children, ...props }: ButtonLinkProps) {
  if (href.startsWith('tel:') || href.startsWith('mailto:')) {
    return (
      <a href={href} className={buttonClasses(variant, size, className)} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}
