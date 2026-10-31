import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
};

/**
 * A Next.js Link styled as a Dorara button. Used for navigation actions
 * (continue, get started, etc.) so we avoid nesting a link inside a <button>.
 */
export function ButtonLink({
  href,
  children,
  variant = "default",
  className,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant }),
        "h-11 w-full",
        variant === "default" &&
          "bg-primary text-primary-foreground hover:bg-primary/90",
        className,
      )}
    >
      {children}
    </Link>
  );
}
