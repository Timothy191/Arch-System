import * as SelectPrimitive from '@radix-ui/react-select';
import { cn } from '@repo/ui/lib/utils';
import * as React from 'react';

interface SelectProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root> {
  className?: string;
  children?: React.ReactNode;
}

const SELECT_TRIGGER_STYLES = cn(
  'gold-steel-border gold-steel-border-slim flex h-10 w-full items-center justify-between',
  'rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const SELECT_CONTENT_STYLES = cn(
  'select-content gold-steel-border gold-steel-border-slim z-50 min-w-[8rem] overflow-hidden',
  'rounded-md border bg-popover p-1 text-sm shadow-lg',
  'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=open]:animate-in',
  'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
  'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
  'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
);

const SELECT_ITEM_STYLES = cn(
  'relative flex w-full cursor-pointer select-none items-center rounded-md px-2.5 py-1.5',
  'font-medium text-[var(--text-heading)] text-xs outline-none hover:bg-black/[0.04] focus:bg-black/[0.04]',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
  'data-[state=checked]:font-semibold data-[state=checked]:text-[var(--accent-blue)]'
);

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('select w-full', className)}>
      <SelectPrimitive.Root {...props}>
        <SelectPrimitive.Trigger className={SELECT_TRIGGER_STYLES}>
          <SelectPrimitive.Value placeholder="Select..." className="w-full" />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Content className={SELECT_CONTENT_STYLES}>
          <SelectPrimitive.Group>{children}</SelectPrimitive.Group>
        </SelectPrimitive.Content>
      </SelectPrimitive.Root>
    </div>
  )
);
Select.displayName = SelectPrimitive.Root.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item ref={ref} className={cn(SELECT_ITEM_STYLES, className)} {...props}>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export { Select, SelectItem };
export const SelectTrigger = SelectPrimitive.Trigger;
export const SelectContent = SelectPrimitive.Content;
export const SelectGroup = SelectPrimitive.Group;
export const SelectLabel = SelectPrimitive.Label;
export const SelectSeparator = SelectPrimitive.Separator;
export const SelectValue = SelectPrimitive.Value;
