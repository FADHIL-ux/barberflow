import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { Spinner } from "./Spinner.tsx";

type Variant = "primary" | "secondary" | "danger" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary: "bg-[#C6FF3D] text-[#101014] hover:bg-[#b8f535] font-semibold",
  secondary: "bg-[#27272a] text-[#f4f4f5] hover:bg-[#3f3f46]",
  danger: "bg-red-600 text-white hover:bg-red-500",
  ghost: "text-[#f4f4f5] hover:bg-[#27272a]",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm min-h-10",
  md: "px-4 py-3 text-sm min-h-12",
  lg: "px-6 py-4 text-base min-h-14",
};

export function Button({ variant = "primary", size = "md", loading, disabled, children, className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 cursor-pointer ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

