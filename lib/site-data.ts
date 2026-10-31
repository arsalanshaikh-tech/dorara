import {
  Briefcase,
  GraduationCap,
  HeartPulse,
  Home,
  Plane,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'

export type Category = {
  key: string
  title: string
  description: string
  icon: LucideIcon
  accent: string // oklch color used for the icon tile
  href: string
}

export const categories: Category[] = [
  {
    key: 'travel',
    title: 'Travel',
    description: 'Find destinations that match your budget, pace, and sense of adventure.',
    icon: Plane,
    accent: 'oklch(0.7 0.15 55)',
    href: '/consult?vertical=travel',
  },
  {
    key: 'healthcare',
    title: 'Healthcare',
    description: 'Discover trusted hospitals and treatment destinations for your condition.',
    icon: HeartPulse,
    accent: 'oklch(0.68 0.13 165)',
    href: '/consult?vertical=healthcare',
  },
  {
    key: 'education',
    title: 'Education',
    description: 'Compare universities, courses, and scholarships built around your goals.',
    icon: GraduationCap,
    accent: 'oklch(0.62 0.14 250)',
    href: '/consult?vertical=education',
  },
  {
    key: 'work',
    title: 'Work',
    description: 'Explore where your skills are valued most, with real salary and visa data.',
    icon: Briefcase,
    accent: 'oklch(0.66 0.14 285)',
    href: '/consult?vertical=work',
  },
  {
    key: 'business',
    title: 'Business',
    description: 'Identify the best cities and markets to launch or expand your venture.',
    icon: TrendingUp,
    accent: 'oklch(0.68 0.13 200)',
    href: '/consult?vertical=business',
  },
  {
    key: 'relocation',
    title: 'Relocation',
    description: 'Decide which country or city truly fits the life you want to build.',
    icon: Home,
    accent: 'oklch(0.7 0.13 145)',
    href: '/consult?vertical=relocation',
  },
  {
    key: 'lifestyle',
    title: 'Lifestyle',
    description: 'Balance cost, climate, safety, and culture to live your best everyday.',
    icon: Sparkles,
    accent: 'oklch(0.72 0.13 178)',
    href: '/consult?vertical=lifestyle',
  },
]

export type Feature = {
  title: string
  description: string
}

export const features: Feature[] = [
  {
    title: 'Personalized recommendations',
    description:
      'Dorara understands your situation, goals, and limits before suggesting a single option.',
  },
  {
    title: 'Real-world data analysis',
    description:
      'Cost of living, safety, healthcare, visas, and economic data — analyzed together, instantly.',
  },
  {
    title: 'Side-by-side comparison',
    description:
      'Weigh two countries or cities across the factors that actually matter to you.',
  },
  {
    title: 'Emotional understanding',
    description:
      'Guidance that feels like a trusted advisor, explaining the "why" behind every suggestion.',
  },
  {
    title: 'Save and revisit results',
    description:
      'Keep your favourite places and recommendations to return to whenever you are ready.',
  },
  {
    title: 'Step-by-step guidance',
    description:
      'Clear action plans — from documents to timelines — so you always know the next move.',
  },
]

export type Step = {
  number: string
  title: string
  description: string
}

export const steps: Step[] = [
  {
    number: '01',
    title: 'Choose a category',
    description: 'Tell Dorara whether it is travel, health, study, work, business, or relocation.',
  },
  {
    number: '02',
    title: 'Answer a few questions',
    description: 'Share your budget, preferences, and goals in a short, friendly conversation.',
  },
  {
    number: '03',
    title: 'Get AI recommendations',
    description: 'Receive clear, reasoned options with advantages, trade-offs, and next steps.',
  },
  {
    number: '04',
    title: 'Save or compare results',
    description: 'Bookmark favourites, compare destinations, and act with confidence.',
  },
]

export type Stat = {
  value: string
  label: string
}

export const stats: Stat[] = [
  { value: '190+', label: 'Countries analyzed' },
  { value: '85K+', label: 'Users guided' },
  { value: '7', label: 'Life categories' },
  { value: '1.2M+', label: 'Recommendations generated' },
]

export type Testimonial = {
  name: string
  role: string
  quote: string
  initials: string
}

export const testimonials: Testimonial[] = [
  {
    name: 'Arsalan Khan',
    role: 'Moved to Berlin for work',
    initials: 'AK',
    quote:
      'Dorara compared salaries, visas, and cost of living for me in minutes. It felt like talking to an advisor who actually understood my career.',
  },
  {
    name: 'Priya Menon',
    role: 'Studying abroad',
    initials: 'PM',
    quote:
      'I was overwhelmed choosing a university. Dorara narrowed it down with scholarships and a clear timeline. The reasoning made the decision easy.',
  },
  {
    name: 'Daniel Osei',
    role: 'Planned a treatment journey',
    initials: 'DO',
    quote:
      'Finding the right hospital abroad was stressful until Dorara laid out options, costs, and the documents I needed — calmly and clearly.',
  },
]
