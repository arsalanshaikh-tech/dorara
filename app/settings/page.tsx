import type { Metadata } from "next";
import { AppShell } from "@/components/app/app-shell";
import { SettingsClient } from "@/components/app/settings-client";

export const metadata: Metadata = {
  title: "Settings · Dorara",
  description: "Manage your Dorara account, security, and preferences.",
};

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl">
        <SettingsClient />
      </div>
    </AppShell>
  );
}
