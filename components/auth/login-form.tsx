'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth-store'
import {
  getMe,
  login,
  messageForCode,
  type ApiError,
} from '@/lib/services/auth-service'
import { loginSchema } from '@/lib/validators/auth'
import { cn } from '@/lib/utils'

type FieldErrors = Partial<Record<'email' | 'password', string>>

export function LoginForm() {
  const router = useRouter()
  const setUser = useAuthStore((s) => s.setUser)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    const parsed = loginSchema.safeParse({ email, password, remember })

    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'email' && !next.email) next.email = issue.message
        if (key === 'password' && !next.password) next.password = issue.message
      }
      setErrors(next)
      // Focus the first invalid field
      if (next.email) emailRef.current?.focus()
      else if (next.password) passwordRef.current?.focus()
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      await login({ email: parsed.data.email, password: parsed.data.password })
      const user = await getMe()
      setUser(user)
      router.push('/welcome')
    } catch (err) {
      const code = (err as ApiError)?.code ?? 'UNKNOWN'
      setFormError(messageForCode(code))
      passwordRef.current?.focus()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? 'email-error' : undefined}
          placeholder="you@example.com"
          className={cn(
            'h-11 rounded-lg border bg-card px-3.5 text-sm text-foreground shadow-sm outline-none transition',
            'placeholder:text-muted-foreground/60',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
            errors.email ? 'border-destructive' : 'border-input',
          )}
        />
        {errors.email && (
          <p id="email-error" className="text-xs font-medium text-destructive">
            {errors.email}
          </p>
        )}
      </div>

      {/* Password */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-primary hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <div className="relative">
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : undefined}
            placeholder="Enter your password"
            className={cn(
              'h-11 w-full rounded-lg border bg-card pl-3.5 pr-11 text-sm text-foreground shadow-sm outline-none transition',
              'placeholder:text-muted-foreground/60',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0',
              errors.password ? 'border-destructive' : 'border-input',
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {errors.password && (
          <p
            id="password-error"
            className="text-xs font-medium text-destructive"
          >
            {errors.password}
          </p>
        )}
      </div>

      {/* Remember me */}
      <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          name="remember"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="h-4 w-4 rounded border-input text-primary accent-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        Remember me for 30 days
      </label>

      <Button
        type="submit"
        disabled={submitting}
        className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Signing in...</span>
            <span className="sr-only">Please wait</span>
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span>Sign in</span>
          </>
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {"Don't have an account? "}
        <Link
          href="/signup"
          className="font-semibold text-primary hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  )
}
