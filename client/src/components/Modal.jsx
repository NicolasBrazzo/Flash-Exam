import { useEffect } from "react";
import { X } from "lucide-react";

// Larghezza massima del pannello: "md" (default) per conferme e testi brevi,
// "lg" per dettagli e form più ampi
const SIZES = {
  md: "max-w-md",
  lg: "max-w-2xl",
};

const Modal = ({ isOpen, onClose, title, children, size = "md" }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Esc chiude il modale
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className={`relative flex max-h-[90dvh] w-full flex-col rounded-lg bg-card shadow-xl ${SIZES[size] || SIZES.md}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border py-2 pl-6 pr-2">
          {title && (
            <h2 id="modal-title" className="text-base font-semibold text-card-foreground">
              {title}
            </h2>
          )}
          {/* 44px: target di tocco comodo anche su iPad */}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
