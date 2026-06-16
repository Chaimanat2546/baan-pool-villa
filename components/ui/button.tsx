import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "default"
  | "destructive"
  | "ghost"
  | "link"
  | "outline"
  | "secondary";

type ButtonSize =
  | "default"
  | "icon"
  | "icon-lg"
  | "icon-sm"
  | "icon-xs"
  | "lg"
  | "sm"
  | "xs";

const variantClassMap: Record<ButtonVariant, string> = {
  default: "bg-[var(--site-primary)] text-[var(--site-on-primary)] hover:bg-[var(--site-primary-hover)]",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  ghost: "hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)]",
  link: "text-[var(--site-primary)] underline-offset-4 hover:underline",
  outline: "border border-[var(--site-border)] bg-[var(--site-surface)] hover:bg-[var(--site-primary-soft)] hover:text-[var(--site-primary)]",
  secondary: "bg-[var(--site-primary-soft)] text-[var(--site-primary)] hover:bg-[var(--site-surface-tint)]",
};

const sizeClassMap: Record<ButtonSize, string> = {
  default: "h-9 px-4 py-2",
  icon: "size-9",
  "icon-lg": "size-10",
  "icon-sm": "size-8",
  "icon-xs": "size-6 rounded-md",
  lg: "h-10 px-6",
  sm: "h-8 px-3",
  xs: "h-6 px-2 text-xs",
};

function buttonVariants({
  className,
  size = "default",
  variant = "default",
}: {
  className?: string;
  size?: ButtonSize;
  variant?: ButtonVariant;
} = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-[var(--site-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    variantClassMap[variant],
    sizeClassMap[size],
    className,
  );
}

function Button({
  className,
  size = "default",
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
}) {
  return (
    <button
      data-slot="button"
      data-size={size}
      data-variant={variant}
      className={buttonVariants({ className, size, variant })}
      {...props}
    />
  );
}

export { Button, buttonVariants };
