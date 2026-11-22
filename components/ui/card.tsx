import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return <section className={cn('ui-card', className)} {...props} />;
}
export function CardHeader({ className, ...props }: ComponentPropsWithoutRef<'header'>) {
  return <header className={cn('ui-card-header', className)} {...props} />;
}
export function CardContent({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('ui-card-content', className)} {...props} />;
}
