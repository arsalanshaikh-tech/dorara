import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in — Dorara",
  description:
    "Sign in to Dorara to access AI-powered recommendations for education, jobs, health, travel, and more.",
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue making smarter decisions with Dorara."
    >
      <LoginForm />
    </AuthShell>
  );
}
