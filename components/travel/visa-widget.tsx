'use client'

import { ExternalLink, Stamp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import type { VisaSummaryItem } from '@/lib/travel/types'

export function VisaWidget({ items }: { items: VisaSummaryItem[] }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-lg">
          <Stamp className="size-5 text-primary" />
          Visa summary
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {items.map((item, i) => (
          <div key={item.country} className="flex flex-col gap-2">
            {i > 0 ? <Separator /> : null}
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-foreground">{item.country}</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                {item.visaRequired}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="text-right text-foreground">{item.visaType}</dd>
              <dt className="text-muted-foreground">Processing</dt>
              <dd className="text-right text-foreground">
                {item.processingTime}
              </dd>
            </dl>
            <a
              href={item.officialLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Official resource
              <ExternalLink className="size-3.5" />
            </a>
          </div>
        ))}
        <p className="text-xs leading-relaxed text-muted-foreground">
          Visa rules depend on your nationality. Always confirm with the
          official source before booking.
        </p>
      </CardContent>
    </Card>
  )
}
