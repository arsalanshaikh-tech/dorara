"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MailCheck, Send } from "lucide-react";
import { TextField } from "@/components/auth/text-field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { requestPasswordReset } from "@/lib/services/auth-service";
import { forgotPasswordSchema } from "@/lib/validators/auth";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      emailRef.current?.focus();
      return;
    }
    setError(undefined);
    setSubmitting(true);
    try {
      await requestPasswordReset(parsed.data.email);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert variant="success">
          If an account exists for{" "}
          <span className="font-medium text-foreground">{email}</span>, a reset
          link is on its way.
        </FormAlert>
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>
            Check your inbox and follow the link to set a new password. The link
            expires in 30 minutes.
          </span>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-sm font-medium text-primary hover:underline"
        >
          Use a different email
        </button>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        ref={emailRef}
        id="email"
        name="email"
        type="email"
        inputMode="email"
        label="Email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
        hint="We'll email you a secure link to reset your password."
      />

      <SubmitButton loading={submitting} loadingText="Sending link...">
        <Send className="h-4 w-4" aria-hidden="true" />
        <span>Send reset link</span>
      </SubmitButton>

      <Link
        href="/login"
        className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </form>
  );
}
