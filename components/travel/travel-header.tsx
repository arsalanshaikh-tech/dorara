import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { DoraraLogo } from '@/components/dorara-logo'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function TravelHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Dorara home" className="flex items-center">
          <DoraraLogo wordClassName="text-foreground" />
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline">
            Travel
          </span>
          <Link
            href="/trips"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-muted-foreground',
            )}
          >
            My trips
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'ghost', size: 'sm' }),
              'text-muted-foreground',
            )}
          >
            <ArrowLeft data-icon="inline-start" />
            Home
          </Link>
        </div>
      </div>
    </header>
  )
}
