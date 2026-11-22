import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return <AvatarPrimitive.Root className={cn('relative flex size-10 shrink-0 overflow-hidden rounded-full', className)} {...props} />;
}
export const AvatarImage = AvatarPrimitive.Image;
export function AvatarFallback(props: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return <AvatarPrimitive.Fallback className="flex size-full items-center justify-center" {...props} />;
}
