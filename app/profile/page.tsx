"use client";

import { CalendarDays, MapPin, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { SectionCard } from "@/components/app/section-card";
import { ProfileForm } from "@/components/app/profile-form";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { useAuthStore } from "@/lib/store/auth-store";

function initials(name?: string) {
  if (!name) return "D";
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  const summary = [
    { icon: ShieldCheck, label: "Account status", value: "Verified" },
    {
      icon: MapPin,
      label: "Location",
      value: user?.location || "Not set",
    },
    { icon: CalendarDays, label: "Member since", value: "2025" },
  ];

  return (
    <AppShell active="/profile">
      <div className="flex flex-col gap-8">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            {initials(user?.name)}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
              {user?.name ?? "Your profile"}
            </h1>
            <p className="mt-1 text-muted-foreground">{user?.email}</p>
          </div>
        </header>

        {/* Account summary */}
        <div className="grid gap-4 sm:grid-cols-3">
          {summary.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="font-medium text-foreground">{item.value}</p>
              </div>
            </div>
          ))}
        </div>

        <SectionCard
          title="Personal information"
          description="Update your details so recommendations stay relevant to you."
        >
          <ProfileForm />
        </SectionCard>

        <SectionCard
          title="Change password"
          description="Choose a strong password you don't use elsewhere."
        >
          <ChangePasswordForm />
        </SectionCard>
      </div>
    </AppShell>
  );
}
