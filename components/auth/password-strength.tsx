import { cn } from "@/lib/utils";

export function scorePassword(password: string): number {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const labels = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const barColors = [
  "bg-destructive",
  "bg-destructive",
  "bg-chart-1",
  "bg-primary",
  "bg-primary",
];

/**
 * Lightweight password strength hint. Shows four segments and a text label
 * that reflects the estimated strength of the entered password.
 */
export function PasswordStrength({ password }: { password: string }) {
  const score = scorePassword(password);

  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors",
              i < score ? barColors[score] : "bg-muted",
            )}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Password strength:{" "}
          <span className="font-medium text-foreground">{labels[score]}</span>
        </p>
      )}
    </div>
  );
}
