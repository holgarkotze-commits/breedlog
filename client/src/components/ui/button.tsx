import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-all duration-200 hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "border bg-[linear-gradient(165deg,#233956_0%,#2f4668_55%,#1f304d_100%)] text-white shadow-[0_10px_24px_rgba(15,23,42,0.32)] [border-color:var(--primary-border)] hover:brightness-110",
        destructive:
          "border border-destructive/70 bg-destructive text-destructive-foreground shadow-md hover:brightness-110",
        outline:
          "border [border-color:var(--button-outline)] bg-[linear-gradient(165deg,hsl(var(--card))_0%,hsl(var(--secondary))_100%)] text-foreground shadow-sm",
        secondary:
          "border border-secondary-border bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/90",
        ghost: "border border-transparent hover:bg-secondary/70",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-11 rounded-xl px-8",
        icon: "h-10 w-10",
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
