import { Navbar } from '@/components/navbar'
import { Hero } from '@/components/hero'
import { AiIntro } from '@/components/ai-intro'
import { CategoryCards } from '@/components/category-cards'
import { FeaturesSection } from '@/components/features-section'
import { HowItWorks } from '@/components/how-it-works'
import { StatsSection } from '@/components/stats-section'
import { TestimonialsSection } from '@/components/testimonials-section'
import { CtaBanner } from '@/components/cta-banner'
import { SiteFooter } from '@/components/site-footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <AiIntro />
        <CategoryCards />
        <FeaturesSection />
        <HowItWorks />
        <StatsSection />
        <TestimonialsSection />
        <CtaBanner />
      </main>
      <SiteFooter />
    </div>
  )
}
