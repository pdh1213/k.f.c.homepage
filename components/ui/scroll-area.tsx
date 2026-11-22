import * as Scroll from '@radix-ui/react-scroll-area';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export const ScrollArea = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof Scroll.Viewport>>(
  ({ className, children, ...props }, ref) => <Scroll.Root className={cn('relative overflow-hidden', className)}>
    <Scroll.Viewport ref={ref} className="size-full" {...props}>{children}</Scroll.Viewport>
    <Scroll.Scrollbar className="scrollbar" orientation="vertical"><Scroll.Thumb className="scroll-thumb" /></Scroll.Scrollbar>
  </Scroll.Root>,
);
ScrollArea.displayName = 'ScrollArea';
