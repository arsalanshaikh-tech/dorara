import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { DoraraLogo } from "@/components/dorara-logo";
import { cn } from "@/lib/utils";

type Tone = "brand" | "success" | "danger" | "muted";

const toneStyles: Record<Tone, string> = {
  brand: "bg-primary/10 text-primary",
  success: "bg-primary/10 text-primary",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

type StatusScreenProps = {
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
};

/**
 * Centered, single-column screen for confirmation and status pages
 * (verify email, verified, etc.). Uses the same Dorara card, radius, and
 * color language as the split auth pages for a seamless experience.
 */
export function StatusScreen({
  icon: Icon,
  tone = "brand",
  title,
  description,
  children,
  footer,
}: StatusScreenProps) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-background px-5 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-1/4 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-chart-2/10 blur-3xl"
      />

      <Link
        href="/"
        className="relative mb-8"
        aria-label="Dorara home"
      >
        <DoraraLogo wordClassName="text-foreground" />
      </Link>

      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <span
          className={cn(
            "mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl",
            toneStyles[tone],
          )}
        >
          <Icon className="h-7 w-7" />
        </span>

        <h1 className="text-balance font-display text-2xl font-bold text-foreground">
          {title}
        </h1>
        <div className="mt-2.5 text-pretty text-sm leading-relaxed text-muted-foreground">
          {description}
        </div>

        {children && <div className="mt-7 flex flex-col gap-3">{children}</div>}
      </div>

      {footer && (
        <div className="relative mt-6 text-sm text-muted-foreground">
          {footer}
        </div>
      )}
    </main>
  );
}
