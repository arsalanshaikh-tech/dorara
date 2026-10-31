import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  /** Applies danger-zone styling for destructive sections. */
  danger?: boolean;
};

/**
 * Titled card container used across the profile and settings pages to keep
 * spacing, radius, borders, and shadows consistent with the Dorara design.
 */
export function SectionCard({
  title,
  description,
  children,
  className,
  danger = false,
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-6 shadow-sm sm:p-7",
        danger ? "border-destructive/30" : "border-border",
        className,
      )}
    >
      <div className="mb-5">
        <h2
          className={cn(
            "font-display text-lg font-semibold",
            danger ? "text-destructive" : "text-foreground",
          )}
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}
