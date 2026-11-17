type BadgeVariant = "success" | "warning" | "danger" | "neutral";

const classes: Record<BadgeVariant, string> = {
  success: "bg-green-900/50 text-green-400 border-green-800",
  warning: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  danger: "bg-red-900/50 text-red-400 border-red-800",
  neutral: "bg-zinc-800 text-zinc-400 border-zinc-700",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: React.ReactNode }) {
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border ${classes[variant]}`}>{children}</span>;
}

