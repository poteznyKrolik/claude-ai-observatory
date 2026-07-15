import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const selectVariants = cva(
  'flex w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      size: {
        default: 'h-10 py-2',
        sm: 'h-8 py-1',
        lg: 'h-12 py-3',
      },
    },
    defaultVariants: {
      size: 'default',
    },
  }
)

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    VariantProps<typeof selectVariants> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, size, children, ...props }, ref) => {
    return (
      <select
        className={cn(selectVariants({ size, className }))}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = 'Select'

export { Select, selectVariants }
