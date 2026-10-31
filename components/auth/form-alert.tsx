import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type FormAlertProps = {
  variant?: "error" | "success" | "info";
  children: React.ReactNode;
  className?: string;
};

const styles = {
  error: {
    wrap: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: AlertCircle,
  },
  success: {
    wrap: "border-primary/30 bg-primary/10 text-foreground",
    Icon: CheckCircle2,
  },
  info: {
    wrap: "border-border bg-muted/60 text-muted-foreground",
    Icon: Info,
  },
} as const;

/**
 * Inline alert used for form-level errors, success confirmations, and info
 * notices across the auth pages.
 */
export function FormAlert({
  variant = "error",
  children,
  className,
}: FormAlertProps) {
  const { wrap, Icon } = styles[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        wrap,
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0",
          variant === "success" && "text-primary",
        )}
        aria-hidden="true"
      />
      <span>{children}</span>
    </div>
  );
}
