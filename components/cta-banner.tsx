import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/reveal'

export function CtaBanner() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-navy px-6 py-14 text-center text-navy-foreground sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64 rounded-full bg-chart-2/25 blur-[100px]" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Your next big decision, made with clarity.
            </h2>
            <p className="mt-4 text-pretty text-lg leading-relaxed text-navy-foreground/70">
              Start a free consultation and let Dorara guide you toward smarter
              choices and a better life.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="gap-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Start free consultation
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full border-white/20 bg-transparent text-navy-foreground hover:bg-white/10 hover:text-navy-foreground"
              >
                View global dashboard
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
