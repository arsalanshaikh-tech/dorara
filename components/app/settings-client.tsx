"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Monitor, Moon, Save, Sun, Trash2, TriangleAlert } from "lucide-react";
import { SectionCard } from "@/components/app/section-card";
import { ChangePasswordForm } from "@/components/app/change-password-form";
import { Toggle } from "@/components/app/toggle";
import { TextField } from "@/components/auth/text-field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  deleteAccount,
  updateProfile,
} from "@/lib/services/auth-service";
import { cn } from "@/lib/utils";

const themeOptions = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const notificationKeys = [
  {
    key: "recommendations",
    title: "New recommendations",
    description: "Get notified when Dorara finds better options for you.",
  },
  {
    key: "product",
    title: "Product updates",
    description: "Occasional news about new features and improvements.",
  },
  {
    key: "tips",
    title: "Tips & guides",
    description: "Advice to help you get the most out of Dorara.",
  },
] as const;

export function SettingsClient() {
  const router = useRouter();
  const { user, setUser, logout } = useAuthStore();

  // Update email
  const [email, setEmail] = useState(user?.email ?? "");
  const [emailError, setEmailError] = useState<string | undefined>();
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);

  // Preferences (UI-only demo state)
  const [theme, setTheme] = useState<(typeof themeOptions)[number]["value"]>(
    "light",
  );
  const [notifications, setNotifications] = useState({
    recommendations: true,
    product: false,
    tips: true,
  });

  // Delete account
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleEmailSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailSaved(false);
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setEmailError(undefined);
    setEmailSaving(true);
    try {
      await updateProfile({ email: trimmed });
      if (user) setUser({ ...user, email: trimmed });
      setEmailSaved(true);
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
      router.push("/");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Settings
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account, security, and preferences.
        </p>
      </header>

      <SectionCard
        title="Email address"
        description="This is where Dorara sends account and recommendation emails."
      >
        <form onSubmit={handleEmailSubmit} noValidate className="flex flex-col gap-5">
          {emailSaved && (
            <FormAlert variant="success">Your email has been updated.</FormAlert>
          )}
          <TextField
            id="settings-email"
            name="email"
            type="email"
            inputMode="email"
            label="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
          />
          <SubmitButton
            loading={emailSaving}
            loadingText="Saving..."
            className="sm:w-auto sm:self-start sm:px-6"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Update email</span>
          </SubmitButton>
        </form>
      </SectionCard>

      <SectionCard
        title="Password"
        description="Update the password you use to sign in."
      >
        <ChangePasswordForm />
      </SectionCard>

      <SectionCard
        title="Notifications"
        description="Choose what Dorara can email you about."
      >
        <ul className="flex flex-col divide-y divide-border">
          {notificationKeys.map((item) => (
            <li
              key={item.key}
              className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
            >
              <div>
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
              <Toggle
                label={item.title}
                checked={notifications[item.key]}
                onChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, [item.key]: checked }))
                }
              />
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard
        title="Appearance"
        description="Choose how Dorara looks to you."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const selected = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                aria-pressed={selected}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium transition",
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <option.icon
                  className={cn(
                    "h-4 w-4",
                    selected ? "text-primary" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                {option.label}
              </button>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        danger
        title="Danger zone"
        description="Permanently delete your account and all associated data."
      >
        {!confirming ? (
          <Button
            variant="destructive"
            onClick={() => setConfirming(true)}
            className="h-11 px-5"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete account
          </Button>
        ) : (
          <div className="flex flex-col gap-4">
            <FormAlert variant="error">
              <span className="flex items-center gap-1.5">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                This action cannot be undone.
              </span>
            </FormAlert>
            <TextField
              id="confirm-delete"
              label='Type "DELETE" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
            <div className="flex flex-wrap gap-3">
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || deleting}
                onClick={handleDelete}
                className="h-11 px-5"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {deleting ? "Deleting..." : "Permanently delete"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                className="h-11 px-5"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
