import * as Menu from '@radix-ui/react-dropdown-menu';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;
export function DropdownMenuContent({ className, ...props }: ComponentProps<typeof Menu.Content>) {
  return <Menu.Portal><Menu.Content align="end" sideOffset={7} className={cn('ui-menu', className)} {...props} /></Menu.Portal>;
}
export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Menu.Item>) {
  return <Menu.Item className={cn('ui-menu-item', className)} {...props} />;
}
export const DropdownMenuSeparator = Menu.Separator;
