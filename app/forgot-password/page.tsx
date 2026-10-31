import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password — Dorara",
  description: "Reset your Dorara account password.",
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to reset it."
      backHref="/login"
      backLabel="Back to sign in"
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
