import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-[#354A5F] text-white hover:bg-[#2D3E4F] active:bg-[#1F2937]",
        destructive: "bg-[#BB0000] text-white hover:bg-[#A30000] active:bg-[#8B0000]",
        outline: "border border-[#354A5F] text-[#354A5F] bg-transparent hover:bg-[#354A5F]/10 active:bg-[#354A5F]/20",
        secondary: "bg-[#6B7A99] text-white hover:bg-[#5A6A89] active:bg-[#495979]",
        ghost: "text-[#354A5F] hover:bg-[#354A5F]/10 active:bg-[#354A5F]/20",
        link: "text-[#354A5F] underline-offset-4 hover:underline",
        success: "bg-[#107E3E] text-white hover:bg-[#0D6A34] active:bg-[#0A562A]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
