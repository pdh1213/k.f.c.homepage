import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

const button = cva('ui-button', {
  variants: {
    variant: { default: 'ui-primary', ghost: 'ui-ghost', outline: 'ui-outline', destructive: 'ui-danger' },
    size: { default: '', sm: 'ui-small', icon: 'ui-icon' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

type Props = ComponentPropsWithoutRef<'button'> & VariantProps<typeof button> & { asChild?: boolean };
export const Button = forwardRef<HTMLButtonElement, Props>(({ asChild, className, variant, size, type = 'button', ...props }, ref) => {
  const Element = asChild ? Slot : 'button';
  return <Element ref={ref} type={type} className={cn(button({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';
