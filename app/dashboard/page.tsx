"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bookmark,
  Clock,
  GitCompareArrows,
  MessageSquareText,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { useAuthStore } from "@/lib/store/auth-store";
import { categories } from "@/lib/site-data";

const quickActions = [
  {
    title: "Start a consultation",
    description: "Answer a few questions and get tailored recommendations.",
    icon: MessageSquareText,
    href: "/welcome",
  },
  {
    title: "Compare destinations",
    description: "Weigh two countries or cities side by side.",
    icon: GitCompareArrows,
    href: "/welcome",
  },
  {
    title: "View saved places",
    description: "Revisit the options you've bookmarked.",
    icon: Bookmark,
    href: "/welcome",
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <AppShell active="/dashboard">
      <div className="flex flex-col gap-10">
        <section>
          <h1 className="text-balance font-display text-2xl font-bold text-foreground sm:text-3xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
            Pick a category to begin, or jump back into a recent decision. Your
            personalized recommendations will appear here.
          </p>
        </section>

        {/* Quick actions */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {quickActions.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <action.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-foreground">{action.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open
                  <ArrowRight
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Explore categories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((category) => (
              <Link
                key={category.key}
                href={category.href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
              >
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${category.accent} 14%, transparent)`,
                    color: category.accent,
                  }}
                >
                  <category.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-medium text-foreground">
                    {category.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Recent activity placeholder */}
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Recent activity
          </h2>
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Clock className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="font-medium text-foreground">No activity yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your recent searches, comparisons, and saved recommendations will
              show up here once you get started.
            </p>
            <Link
              href="/welcome"
              className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Start your first consultation
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
