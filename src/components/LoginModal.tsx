import { AnimatePresence, motion } from "motion/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: (displayName: string) => void;
};

function getInitials(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "R";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase()).join("");
}

function stringToHsl(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return { h, s: 26, l: 86 };
}

export default function LoginModal({ open, onClose, onLogin }: LoginModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");

  const initials = useMemo(() => getInitials(name || "Rainy"), [name]);
  const avatarBg = useMemo(() => {
    const { h, s, l } = stringToHsl(name || "Rainy");
    return `hsl(${h} ${s}% ${l}% / 0.6)`;
  }, [name]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const submit = () => {
    onLogin(name);
    setName("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[300] flex items-center justify-center p-4 pointer-events-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          aria-labelledby={titleId}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#F7F9F6]/40 z-[1]"
            onClick={onClose}
            aria-label="关闭登录弹窗"
          />

          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative z-50 w-full max-w-[420px] glass rounded-3xl shadow-xl border border-rain-border pointer-events-auto"
          >
            <div className="flex items-start justify-between px-6 pt-6">
              <div>
                <h2 id={titleId} className="text-[12px] font-medium tracking-[0.22em] text-[#4A5D4E]">
                  LOGIN
                </h2>
                <p className="mt-2 text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
                  仅用于本地模拟。登录后才可捕捉今天的雨。
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="p-2 rounded-full glass glass-hover transition-all duration-500"
                aria-label="关闭"
              >
                <X className="w-4 h-4 text-[#4A5D4E] opacity-60" strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-6 pb-6 pt-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-10 h-10 rounded-full border border-rain-border grid place-items-center text-[11px] tracking-widest text-[#4A5D4E]"
                  style={{ background: avatarBg }}
                  aria-hidden="true"
                >
                  {initials}
                </div>

                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium mb-2">
                    Display name
                  </label>
                  <input
                    ref={inputRef}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    placeholder="比如：小雨 / Rainy"
                    className="w-full glass rounded-2xl px-4 py-3 text-[12px] tracking-wide text-stone-700 placeholder:text-stone-400/80 outline-none focus:bg-white/55 transition-all duration-500"
                    maxLength={24}
                    inputMode="text"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full glass glass-hover transition-all duration-500"
                >
                  <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-60">
                    取消
                  </span>
                </button>

                <button
                  type="button"
                  onClick={submit}
                  className="group relative px-5 py-2 rounded-full glass glass-hover shadow-sm overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/20 to-teal-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <span className="relative text-[11px] font-medium tracking-[0.2em] text-[#4A5D4E]">
                    登录
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

