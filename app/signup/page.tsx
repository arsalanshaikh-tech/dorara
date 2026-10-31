import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create account — Dorara",
  description:
    "Create your free Dorara account to get AI-powered recommendations for travel, healthcare, education, work, business, and relocation.",
};

export default function SignupPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Join Dorara and start making smarter life decisions today."
    >
      <SignupForm />
    </AuthShell>
  );
}
