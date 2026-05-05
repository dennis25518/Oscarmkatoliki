import * as React from "react";
import { FiCheckCircle, FiAlertCircle, FiInfo, FiAlertTriangle, FiX } from "react-icons/fi";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastItemProps {
  toast: ToastMessage;
  onRemove: (id: string) => void;
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  React.useEffect(() => {
    const timer = setTimeout(() => {
      onRemove(toast.id);
    }, toast.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemove]);

  const styles: Record<ToastType, string> = {
    success: "bg-green-50 border-green-400 text-green-800",
    error: "bg-red-50 border-red-400 text-red-800",
    info: "bg-blue-50 border-blue-400 text-blue-800",
    warning: "bg-amber-50 border-amber-400 text-amber-800",
  };

  const icons: Record<ToastType, React.ReactNode> = {
    success: <FiCheckCircle size={18} className="text-green-500 flex-shrink-0" />,
    error: <FiAlertCircle size={18} className="text-red-500 flex-shrink-0" />,
    info: <FiInfo size={18} className="text-blue-500 flex-shrink-0" />,
    warning: <FiAlertTriangle size={18} className="text-amber-500 flex-shrink-0" />,
  };

  return (
    <div
      className={`flex items-start gap-3 w-80 max-w-full border rounded-xl px-4 py-3 shadow-lg animate-slide-in ${styles[toast.type]}`}
    >
      {icons[toast.type]}
      <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="ml-1 opacity-60 hover:opacity-100 transition flex-shrink-0"
      >
        <FiX size={16} />
      </button>
    </div>
  );
}

// ─── Context ───────────────────────────────────────────────────────────────

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const showToast = React.useCallback(
    (message: string, type: ToastType = "info", duration = 4000) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);
    },
    [],
  );

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container - top-right on desktop, top-center on mobile */}
      <div className="fixed top-4 right-4 left-4 sm:left-auto z-[9999] flex flex-col gap-2 items-center sm:items-end pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full sm:w-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
