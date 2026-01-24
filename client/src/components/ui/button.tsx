import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-150" +
  " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-primary via-primary to-primary/85 text-primary-foreground border border-primary-border shadow-md shadow-primary/25 active:shadow-sm active:translate-y-px",
        destructive:
          "bg-gradient-to-b from-destructive via-destructive to-destructive/85 text-destructive-foreground border border-destructive-border shadow-md shadow-destructive/25 active:shadow-sm active:translate-y-px",
        outline:
          "border [border-color:var(--button-outline)] shadow-sm bg-gradient-to-b from-background to-secondary/30 active:shadow-none active:translate-y-px",
        secondary: "bg-gradient-to-b from-secondary via-secondary to-secondary/85 text-secondary-foreground border border-secondary-border shadow-sm active:shadow-none active:translate-y-px",
        ghost: "border border-transparent active:translate-y-px",
      },
      // Heights are set as "min" heights, because sometimes Ai will place large amount of content
      // inside buttons. With a min-height they will look appropriate with small amounts of content,
      // but will expand to fit large amounts of content.
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-md px-3 text-xs",
        lg: "min-h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
