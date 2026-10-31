import { cn } from '@/lib/utils'

type DoraraLogoProps = {
  className?: string
  markClassName?: string
  wordClassName?: string
  showWordmark?: boolean
  showTagline?: boolean
}

/**
 * Dorara brand lockup: gradient "D" monogram with an upward "growth" figure,
 * paired with the wordmark. Colors adapt via the `wordClassName` prop so the
 * logo works on both light and dark (navy) backgrounds.
 */
export function DoraraLogo({
  className,
  markClassName,
  wordClassName,
  showWordmark = true,
  showTagline = false,
}: DoraraLogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <DoraraMark className={markClassName} />
      {showWordmark && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-display text-xl font-bold tracking-tight',
              wordClassName,
            )}
          >
            Dorara
          </span>
          {showTagline && (
            <span className="mt-1 text-[10px] font-medium tracking-wide text-muted-foreground">
              Smart Decisions. Better Life.
            </span>
          )}
        </span>
      )}
    </span>
  )
}

export function DoraraMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn('h-9 w-9', className)}
      role="img"
      aria-label="Dorara logo"
    >
      <defs>
        <linearGradient id="dorara-grad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="oklch(0.72 0.13 178)" />
          <stop offset="100%" stopColor="oklch(0.6 0.14 240)" />
        </linearGradient>
      </defs>
      {/* Navy D body */}
      <path
        d="M9 6h15c11 0 18 7.6 18 18s-7 18-18 18H9V6Zm8 8v20h6.5c6.4 0 10.5-4.1 10.5-10S29.9 14 23.5 14H17Z"
        fill="oklch(0.2 0.035 255)"
      />
      {/* Growth figure: head + upward swoosh */}
      <circle cx="22.5" cy="20" r="3.4" fill="url(#dorara-grad)" />
      <path
        d="M13 31c4-1 6.5-4 9.5-8.5 2.6-3.9 6-6.7 11.5-7.2"
        fill="none"
        stroke="url(#dorara-grad)"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  )
}
