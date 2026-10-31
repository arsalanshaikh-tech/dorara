"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { DoraraLogo } from "@/components/dorara-logo";
import { ButtonLink } from "@/components/auth/button-link";
import { useAuthStore } from "@/lib/store/auth-store";
import { categories } from "@/lib/site-data";

export default function WelcomePage() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(" ")[0];

  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden bg-navy text-navy-foreground">
      {/* Ambient brand glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-chart-2/20 blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Link href="/" aria-label="Dorara home">
          <DoraraLogo wordClassName="text-navy-foreground" />
        </Link>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-navy-foreground/70 transition-colors hover:text-navy-foreground"
        >
          Skip for now
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-12 text-center sm:px-6">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-navy-foreground/80"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          Welcome to Dorara
        </motion.span>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-balance font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl"
        >
          {firstName ? `Hi ${firstName}, ` : "Hello, "}
          your smarter decisions start here.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 max-w-xl text-pretty leading-relaxed text-navy-foreground/70"
        >
          Dorara analyzes real-world data and understands your goals to guide
          major life decisions — where to travel, study, work, get treatment,
          build a business, or relocate. Let&apos;s find what fits you.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 flex flex-wrap items-center justify-center gap-2.5"
        >
          {categories.map((category) => (
            <span
              key={category.key}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-2 text-sm text-navy-foreground/85"
            >
              <category.icon
                className="h-4 w-4 text-primary"
                aria-hidden="true"
              />
              {category.title}
            </span>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex w-full max-w-xs flex-col gap-3"
        >
          <ButtonLink href="/dashboard">
            <span>Get started</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </ButtonLink>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-navy-foreground/60 transition-colors hover:text-navy-foreground"
          >
            Maybe later
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
