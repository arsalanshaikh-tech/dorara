import { BrainCircuit, Database, Route, UserCheck } from 'lucide-react'
import { Reveal } from '@/components/reveal'

const pillars = [
  {
    icon: BrainCircuit,
    title: 'AI reasoning',
    text: 'Weighs your priorities and trade-offs the way a thoughtful advisor would.',
  },
  {
    icon: Database,
    title: 'Real-world data',
    text: 'Cost, safety, healthcare, visas, and economics — always factored in.',
  },
  {
    icon: UserCheck,
    title: 'Personalized to you',
    text: 'Understands your budget, goals, and situation before recommending.',
  },
  {
    icon: Route,
    title: 'Step-by-step guidance',
    text: 'Turns a big decision into a clear, achievable action plan.',
  },
]

export function AiIntro() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <div>
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              Your AI life advisor
            </span>
            <h2 className="mt-4 text-balance font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Big decisions deserve more than a search bar.
            </h2>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Dorara combines AI reasoning with trusted global data to help you
              choose with clarity and confidence. It listens first, explains its
              thinking, and gives realistic suggestions — the way a good
              consultant would.
            </p>

            <blockquote className="mt-8 rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm">
              <p className="text-pretty leading-relaxed">
                <span className="font-semibold text-primary">Dorara:</span>{' '}
                “Arsalan, based on your budget, career goal, and preference for
                technology opportunities, these locations may suit you better…”
              </p>
            </blockquote>
          </div>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar, i) => (
            <Reveal key={pillar.title} delay={i * 0.08}>
              <div className="h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <pillar.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                  {pillar.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pillar.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
