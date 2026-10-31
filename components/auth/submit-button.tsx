import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SubmitButtonProps = {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
};

/**
 * Full-width primary button with a built-in loading spinner, matching the
 * Dorara auth button style.
 */
export function SubmitButton({
  loading = false,
  loadingText = "Please wait...",
  children,
  className,
  disabled,
  type = "submit",
  onClick,
}: SubmitButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={loading || disabled}
      className={cn(
        "h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span>{loadingText}</span>
          <span className="sr-only">Please wait</span>
        </>
      ) : (
        children
      )}
    </Button>
  );
}
