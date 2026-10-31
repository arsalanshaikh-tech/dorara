'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { apiRequest, USE_MOCKS } from '@/lib/api/client'

type Airport = { iata: string; name: string; city: string; country: string }

type Props = {
  value: string
  onChange: (value: string) => void
}

/**
 * Departure city input with airport suggestions from the bundled airport list
 * (`GET /trip-planner/airports`, no external quota). Free text is always accepted: if nothing
 * matches, flights simply fall back to labelled demo data — typing is never blocked.
 */
export function AirportAutocomplete({ value, onChange }: Props) {
  const listId = useId()
  const [options, setOptions] = useState<Airport[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const picked = useRef(false)

  useEffect(() => {
    if (USE_MOCKS || picked.current) {
      picked.current = false
      return
    }
    const q = value.trim()
    if (q.length < 2) {
      setOptions([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiRequest<Airport[]>('GET', `/trip-planner/airports?q=${encodeURIComponent(q)}&limit=6`, {
          signal: controller.signal,
          timeoutMs: 8000,
        })
        setOptions(Array.isArray(data) ? data : [])
        setActive(-1)
      } catch {
        setOptions([]) // suggestions are a convenience; typing still works
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  const choose = (a: Airport) => {
    picked.current = true
    onChange(`${a.city} (${a.iata})`)
    setOpen(false)
    setOptions([])
  }

  return (
    <div className="relative">
      <Input
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={100}
        placeholder="e.g. Nagpur, Delhi, London"
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!open || options.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, options.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault()
            choose(options[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {open && options.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
          {options.map((a, i) => (
            <li
              key={a.iata}
              role="option"
              aria-selected={i === active}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-accent' : 'hover:bg-accent/60'}`}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(a)
              }}
            >
              <span className="font-medium">{a.city}</span>{' '}
              <span className="text-muted-foreground">
                ({a.iata}) · {a.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
