"use client";

import { useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CircleCheck, KeyRound, LogIn } from "lucide-react";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { ButtonLink } from "@/components/auth/button-link";
import {
  resetPassword,
  messageForCode,
  type ApiError,
} from "@/lib/services/auth-service";
import { resetPasswordSchema } from "@/lib/validators/auth";

type FieldErrors = Partial<Record<"password" | "confirmPassword", string>>;

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const parsed = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      if (next.password) passwordRef.current?.focus();
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await resetPassword({ token, password: parsed.data.password });
      setDone(true);
    } catch (err) {
      const code = (err as ApiError)?.code ?? "UNKNOWN";
      setFormError(messageForCode(code));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <FormAlert variant="success">
          Your password has been reset successfully.
        </FormAlert>
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground">
          <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span>You can now sign in with your new password.</span>
        </div>
        <ButtonLink href="/login">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          <span>Continue to sign in</span>
        </ButtonLink>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {formError && <FormAlert variant="error">{formError}</FormAlert>}

      <div className="flex flex-col gap-1.5">
        <PasswordField
          ref={passwordRef}
          id="password"
          name="password"
          label="New password"
          autoComplete="new-password"
          placeholder="Create a new password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <PasswordStrength password={password} />
      </div>

      <PasswordField
        id="confirmPassword"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        placeholder="Re-enter your new password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={errors.confirmPassword}
      />

      <SubmitButton loading={submitting} loadingText="Resetting...">
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        <span>Reset password</span>
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
