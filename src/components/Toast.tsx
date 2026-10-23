import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';

type ToastContextValue = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((nextMessage: string) => {
    setMessage(nextMessage);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[90] flex justify-center sm:inset-x-auto sm:bottom-6 sm:right-6 sm:justify-end">
        {message && (
          <div
            key={message}
            role="status"
            className="flex w-full max-w-[380px] animate-fade-up items-center gap-2.5 rounded-xl border border-primary-400/25 bg-[#191428]/95 px-3.5 py-3 text-[10px] font-medium leading-snug text-white/85 shadow-glow backdrop-blur-xl"
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal2" />
            <span>{message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
