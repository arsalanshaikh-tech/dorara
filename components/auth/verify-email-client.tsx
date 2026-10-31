"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { MailCheck, RefreshCw } from "lucide-react";
import { StatusScreen } from "@/components/auth/status-screen";
import { SubmitButton } from "@/components/auth/submit-button";
import { FormAlert } from "@/components/auth/form-alert";
import { resendVerification } from "@/lib/services/auth-service";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleResend() {
    setSent(false);
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
    } finally {
      setSending(false);
    }
  }

  return (
    <StatusScreen
      icon={MailCheck}
      tone="brand"
      title="Check your inbox"
      description={
        <>
          {"We've sent a verification link to "}
          <span className="font-medium text-foreground">
            {email ?? "your email address"}
          </span>
          . Click the link in that email to activate your Dorara account.
        </>
      }
      footer={
        <>
          Entered the wrong address?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Change email
          </Link>
        </>
      }
    >
      {sent && (
        <FormAlert variant="success">
          Verification email sent. Please check your inbox.
        </FormAlert>
      )}

      <SubmitButton
        type="button"
        loading={sending}
        loadingText="Sending..."
        onClick={handleResend}
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        <span>Resend verification email</span>
      </SubmitButton>

      <Link
        href="/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Back to sign in
      </Link>
    </StatusScreen>
  );
}
