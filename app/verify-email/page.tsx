import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailClient } from "@/components/auth/verify-email-client";

export const metadata: Metadata = {
  title: "Verify your email — Dorara",
  description: "Verify your email address to activate your Dorara account.",
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailClient />
    </Suspense>
  );
}
