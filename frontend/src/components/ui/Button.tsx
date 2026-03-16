"use client";

import { type ButtonHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:pointer-events-none";

    const variants: Record<Variant, string> = {
      primary:
        "bg-white text-black hover:bg-white/90 active:bg-white/80",
      secondary:
        "bg-white/10 text-white hover:bg-white/15 active:bg-white/20 border border-white/10",
      ghost:
        "bg-transparent text-white hover:bg-white/10 active:bg-white/15",
    };

    return (
      <button
        ref={ref}
        className={clsx(base, variants[variant], className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";
