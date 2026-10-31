"use client";

import { forwardRef, useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
> & {
  label: string;
  error?: string;
  /** Optional node rendered on the right side of the label row (e.g. a link). */
  labelAccessory?: ReactNode;
};

/**
 * Password input with a show/hide toggle, matching the Dorara auth input style.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(
    { label, error, labelAccessory, id, className, ...props },
    ref,
  ) {
    const [show, setShow] = useState(false);
    const errorId = error ? `${id}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor={id} className="text-sm font-medium text-foreground">
            {label}
          </label>
          {labelAccessory}
        </div>
        <div className="relative">
          <input
            ref={ref}
            id={id}
            type={show ? "text" : "password"}
            aria-invalid={Boolean(error)}
            aria-describedby={errorId}
            className={cn(
              "h-11 w-full rounded-lg border bg-card pl-3.5 pr-11 text-sm text-foreground shadow-sm outline-none transition",
              "placeholder:text-muted-foreground/60",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
              error ? "border-destructive" : "border-input",
              className,
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {show ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error && (
          <p id={errorId} className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  },
);
