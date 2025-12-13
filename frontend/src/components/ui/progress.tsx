"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  max?: number;
  indicatorClassName?: string;
}

const Progress = React.forwardRef<
  HTMLDivElement,
  ProgressProps
>(({ className, value, indicatorClassName, ...props }, ref) => {
  const Root: any = ProgressPrimitive.Root;
  const Indicator: any = ProgressPrimitive.Indicator;

  return (
    <Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      value={value}
      {...props}
    >
      <Indicator
        className={cn("h-full w-full flex-1 bg-primary transition-all", indicatorClassName)}
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    </Root>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
