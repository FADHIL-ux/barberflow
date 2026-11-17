import { type ReactNode, useEffect } from "react";
import { Button } from "./Button.tsx";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full md:max-w-lg bg-[#1a1a20] rounded-t-2xl md:rounded-2xl border border-[#27272a] shadow-2xl max-h-[90dvh] flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#27272a]">
          <h2 className="text-base font-semibold text-[#f4f4f5]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Tutup">
            ✕
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-[#27272a]">{footer}</div>}
      </div>
    </div>
  );
}

