import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = "text", ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "w-full rounded-lg border border-white/10 bg-slate-900/70 px-4 py-3 text-sm font-medium text-white shadow-inner shadow-violet-500/20 outline-none transition focus:border-violet-300/70 focus:shadow-violet-500/30 disabled:cursor-not-allowed disabled:opacity-60",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = "Input"

export { Input }
