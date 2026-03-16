"use client";

import { type InputHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
};

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <label className="block">
        {label ? (
          <div className="mb-2 text-sm font-medium text-white/80">{label}</div>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30",
            "outline-none focus:ring-2 focus:ring-white/15 focus:border-white/20",
            error ? "border-red-500/50 focus:ring-red-500/20" : "",
            className,
          )}
          {...props}
        />
        {error ? (
          <div className="mt-2 text-xs text-red-200/90">{error}</div>
        ) : null}
      </label>
    );
  },
);
Input.displayName = "Input";
