import type { ReactNode } from 'react';
import { SiteNav } from '@/components/layout/site-nav';
import { cn } from '@/lib/utils';

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('min-h-screen overflow-x-hidden bg-[#05070A] font-sans text-white', className)}>
      <SiteNav />
      <main className="px-5 pb-20 pt-28">{children}</main>
    </div>
  );
}

export function PageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto max-w-[1120px]', className)}>{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  return (
    <header className={cn('border-b border-[#F9F7F7]/10 pb-8', align === 'center' && 'text-center')}>
      <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#3F72AF]">{eyebrow}</p>
      <h1 className={cn(
        'mt-4 text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-white sm:text-6xl',
        align === 'center' && 'mx-auto max-w-4xl',
      )}>
        {title}
      </h1>
      {description && (
        <p className={cn(
          'mt-5 max-w-2xl text-lg leading-8 text-[#F9F7F7]/62',
          align === 'center' && 'mx-auto',
        )}>
          {description}
        </p>
      )}
    </header>
  );
}

export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-[#F9F7F7]/12 bg-[#0A111A]', className)}>
      {children}
    </div>
  );
}
