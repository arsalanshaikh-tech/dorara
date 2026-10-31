import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifiedClient } from "@/components/auth/verified-client";

export const metadata: Metadata = {
  title: "Email verified — Dorara",
  description: "Your Dorara account email has been verified.",
};

export default function VerifiedPage() {
  return (
    <Suspense fallback={null}>
      <VerifiedClient />
    </Suspense>
  );
}
