import React from 'react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'flat' | 'bordered';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const base = 'rounded-xl bg-white transition-all';
    const variants = {
      default: 'border border-slate-200/80 shadow-sm hover:shadow',
      flat: 'bg-slate-50 border border-slate-100',
      bordered: 'border-2 border-slate-200',
    };

    return (
      <div ref={ref} className={twMerge(clsx(base, variants[variant], className))} {...props}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
