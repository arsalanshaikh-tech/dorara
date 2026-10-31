import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, BarChart3, Globe, ShieldCheck } from "lucide-react";
import { DoraraLogo } from "@/components/dorara-logo";

const marketingPoints = [
  {
    icon: Globe,
    title: "Global coverage",
    text: "Compare the best options across countries in one place.",
  },
  {
    icon: BarChart3,
    title: "Data-driven",
    text: "Decisions backed by real data, not guesswork.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted & secure",
    text: "Your data stays private and protected.",
  },
];

type AuthShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Where the "Back" link points. Defaults to the marketing home page. */
  backHref?: string;
  backLabel?: string;
};

/**
 * Shared split layout for every authentication page: a navy brand/marketing
 * panel on the left (desktop) and the form content on the right. This is the
 * single source of truth for the auth visual language so every page — login,
 * signup, password reset, verification — feels like one product.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  backHref = "/",
  backLabel = "Back to home",
}: AuthShellProps) {
  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      {/* Left: brand / marketing panel */}
      <section className="relative hidden overflow-hidden bg-navy px-10 py-12 text-navy-foreground lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-chart-2/20 blur-3xl"
        />

        <Link
          href="/"
          className="relative flex items-center"
          aria-label="Dorara home"
        >
          <DoraraLogo wordClassName="text-navy-foreground" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-balance font-display text-3xl font-bold leading-tight">
            Smart Decisions. Better Life.
          </h2>
          <p className="mt-3 text-pretty text-navy-foreground/70">
            Your AI-powered platform to analyze, compare, and find the best
            options globally.
          </p>

          <ul className="mt-8 flex flex-col gap-5">
            {marketingPoints.map((point) => (
              <li key={point.title} className="flex items-start gap-3.5">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary">
                  <point.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-navy-foreground">
                    {point.title}
                  </p>
                  <p className="text-sm text-navy-foreground/65">
                    {point.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-navy-foreground/50">
          © {new Date().getFullYear()} Dorara. All rights reserved.
        </p>
      </section>

      {/* Right: form content */}
      <section className="flex flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Link href="/" aria-label="Dorara home">
              <DoraraLogo wordClassName="text-foreground" />
            </Link>
          </div>

          {backHref && (
            <Link
              href={backHref}
              className="mb-6 hidden items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </Link>
          )}

          <div className="mb-7">
            <h1 className="text-balance font-display text-2xl font-bold text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {children}
        </div>
      </section>
    </main>
  );
}
