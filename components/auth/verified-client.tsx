"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CircleCheck, Loader2, LogIn, TriangleAlert } from "lucide-react";
import { StatusScreen } from "@/components/auth/status-screen";
import { ButtonLink } from "@/components/auth/button-link";

import { verifyEmail } from "@/lib/services/auth-service";

type Phase = "loading" | "success" | "error";

export function VerifiedClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? undefined;
  const [phase, setPhase] = useState<Phase>("loading");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    verifyEmail(token)
      .then(() => setPhase("success"))
      .catch(() => setPhase("error"));
  }, [token]);

  if (phase === "loading") {
    return (
      <StatusScreen
        icon={Loader2}
        tone="muted"
        title="Verifying your email"
        description="Hang tight while we confirm your verification link."
      >
        <div className="flex items-center justify-center">
          <Loader2
            className="h-5 w-5 animate-spin text-primary"
            aria-hidden="true"
          />
          <span className="sr-only">Verifying</span>
        </div>
      </StatusScreen>
    );
  }

  if (phase === "error") {
    return (
      <StatusScreen
        icon={TriangleAlert}
        tone="danger"
        title="Verification failed"
        description="This verification link is invalid or has expired. Request a new link and try again."
        footer={
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Back to sign in
          </Link>
        }
      >
        <ButtonLink href="/verify-email">Request a new link</ButtonLink>
      </StatusScreen>
    );
  }

  return (
    <StatusScreen
      icon={CircleCheck}
      tone="success"
      title="Email verified"
      description="Your email address has been confirmed. Your Dorara account is ready — sign in to get started."
    >
      <ButtonLink href="/login">
        <LogIn className="h-4 w-4" aria-hidden="true" />
        <span>Continue to sign in</span>
      </ButtonLink>
    </StatusScreen>
  );
}
