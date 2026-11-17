import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helper, className = "", ...props },
  ref,
) {
  return (
    <div className="flex flex-col gap-1 w-full text-left">
      {label && <label className="text-sm font-medium text-[#f4f4f5]">{label}</label>}
      <input
        ref={ref}
        {...props}
        className={`w-full px-4 py-3 min-h-12 bg-[#1a1a20] border rounded-xl text-[#f4f4f5] placeholder-[#71717a] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#C6FF3D] focus:border-transparent ${
          error ? "border-red-500" : "border-[#27272a]"
        } ${className}`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {helper && !error && <p className="text-xs text-[#71717a]">{helper}</p>}
    </div>
  );
});

