'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
}

const trustPoints = ['AI-Powered', 'Data-Driven', 'Trusted']

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-navy text-navy-foreground"
    >
      {/* Ambient glows */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-primary/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-chart-2/20 blur-[120px]" />

      {/* Globe image */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 lg:block">
        <img
          src="/hero-globe.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-left opacity-90 [mask-image:linear-gradient(to_right,transparent,black_35%)]"
        />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col px-4 pb-20 pt-28 sm:px-6 lg:pb-32 lg:pt-36">
        <div className="max-w-2xl">
          <motion.span
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="show"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm font-medium text-primary"
          >
            <Sparkles className="h-4 w-4" />
            Smart Decisions. Better Life.
          </motion.span>

          <motion.h1
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="show"
            className="mt-6 text-pretty font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
          >
            Find the best place for your life with{' '}
            <span className="text-primary">AI guidance</span>.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={2}
            initial="hidden"
            animate="show"
            className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-navy-foreground/70"
          >
            Dorara analyzes real-world data and understands your goals to guide
            major life decisions — where to travel, study, work, get treatment,
            or start again. Like a trusted advisor, not a search engine.
          </motion.p>

          {/* AI search entry point */}
          <motion.form
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate="show"
            onSubmit={(e) => e.preventDefault()}
            className="mt-8 flex w-full max-w-xl flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-2 backdrop-blur-sm sm:flex-row sm:items-center sm:rounded-full sm:pl-5"
          >
            <div className="flex flex-1 items-center gap-3">
              <Search className="h-5 w-5 shrink-0 text-primary" />
              <input
                type="text"
                aria-label="Ask Dorara what you are looking for"
                placeholder="What are you looking for? e.g. study in Canada on a budget"
                className="w-full bg-transparent py-2.5 text-base text-navy-foreground placeholder:text-navy-foreground/45 focus:outline-none"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Ask Dorara
              <ArrowRight className="h-4 w-4" />
            </Button>
          </motion.form>

          <motion.div
            variants={fadeUp}
            custom={4}
            initial="hidden"
            animate="show"
            className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3"
          >
            <Button
              variant="ghost"
              className="h-auto p-0 text-navy-foreground/80 hover:bg-transparent hover:text-navy-foreground"
            >
              Explore the global dashboard
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-navy-foreground/60">
              {trustPoints.map((point) => (
                <li key={point} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  {point}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
