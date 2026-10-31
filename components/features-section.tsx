import {
  BarChart3,
  Bookmark,
  Heart,
  ListChecks,
  MessageCircle,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { features } from '@/lib/site-data'
import { Reveal } from '@/components/reveal'

const icons: LucideIcon[] = [
  Sparkles,
  BarChart3,
  ListChecks,
  Heart,
  Bookmark,
  MessageCircle,
]

export function FeaturesSection() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <Reveal>
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">
            Why people trust Dorara
          </span>
          <h2 className="mt-4 text-balance font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to decide with confidence
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed text-muted-foreground">
            Thoughtful features that turn scattered research into a clear,
            personal recommendation.
          </p>
        </div>
      </Reveal>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, i) => {
          const Icon = icons[i % icons.length]
          return (
            <Reveal key={feature.title} delay={(i % 3) * 0.08}>
              <div className="flex h-full gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Reveal>
          )
        })}
      </div>
    </section>
  )
}
