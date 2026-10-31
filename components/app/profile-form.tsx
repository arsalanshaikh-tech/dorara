"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { TextField } from "@/components/auth/text-field";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { useAuthStore } from "@/lib/store/auth-store";
import { updateProfile } from "@/lib/services/auth-service";
import { profileSchema } from "@/lib/validators/auth";

type FieldErrors = Partial<
  Record<"name" | "email" | "location" | "bio", string>
>;

export function ProfileForm() {
  const { user, setUser } = useAuthStore();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [location, setLocation] = useState(user?.location ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSuccess(false);

    const parsed = profileSchema.safeParse({ name, email, location, bio });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      await updateProfile(parsed.data);
      if (user) {
        setUser({ ...user, ...parsed.data });
      }
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {success && (
        <FormAlert variant="success">
          Your profile has been updated.
        </FormAlert>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          id="name"
          name="name"
          label="Full name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          id="email"
          name="email"
          type="email"
          inputMode="email"
          label="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
      </div>

      <TextField
        id="location"
        name="location"
        label="Location"
        placeholder="City, Country"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        error={errors.location}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="bio" className="text-sm font-medium text-foreground">
          About you
        </label>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={280}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short note about your goals and what you're exploring."
          className="rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0"
        />
        {errors.bio ? (
          <p className="text-xs font-medium text-destructive">{errors.bio}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {bio.length}/280 characters
          </p>
        )}
      </div>

      <SubmitButton
        loading={submitting}
        loadingText="Saving..."
        className="sm:w-auto sm:self-start sm:px-6"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        <span>Save changes</span>
      </SubmitButton>
    </form>
  );
}
