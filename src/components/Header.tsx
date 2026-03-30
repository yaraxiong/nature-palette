import { CloudRain, User } from "lucide-react";
import { useMemo, useState } from "react";
import LoginModal from "./LoginModal";
import { useAuth } from "../state/auth";

export default function Header() {
  const { user, login, logout, loginModalOpen, openLoginModal, closeLoginModal } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = useMemo(() => {
    const name = user?.displayName?.trim() || "";
    if (!name) return "R";
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map(p => p[0]?.toUpperCase()).join("");
  }, [user?.displayName]);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-8 pointer-events-none">
      <div className="relative font-sans text-[15px] font-semibold tracking-[0.18em] text-[#4A5D4E] pointer-events-auto">
        RAINY Vibe
      </div>
      
      <div className="flex items-center gap-6 pointer-events-auto">
        {!user ? (
          <button
            onClick={openLoginModal}
            className="group flex items-center gap-2 px-4 py-1.5 rounded-full glass glass-hover transition-all duration-500"
          >
            <User className="w-3.5 h-3.5 text-[#4A5D4E] opacity-60 group-hover:opacity-100 transition-opacity" strokeWidth={1.5} />
            <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-60 group-hover:opacity-100 transition-opacity">
              LOGIN
            </span>
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="group flex items-center gap-2 px-2.5 py-1.5 rounded-full glass glass-hover transition-all duration-500"
              aria-label="用户菜单"
            >
              <div
                className="w-6 h-6 rounded-full border border-rain-border grid place-items-center text-[10px] tracking-widest text-[#4A5D4E] bg-white/30"
                aria-hidden="true"
              >
                {initials}
              </div>
              <span className="hidden sm:inline text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-60 group-hover:opacity-100 transition-opacity">
                {user.displayName}
              </span>
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-[120]"
                  onClick={() => setMenuOpen(false)}
                  aria-label="关闭用户菜单"
                />
                <div className="absolute right-0 mt-3 z-[130] glass rounded-2xl shadow-xl border border-rain-border min-w-[180px] overflow-hidden">
                  <div className="px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">Signed in</p>
                    <p className="mt-1 text-[12px] tracking-wide text-stone-700">{user.displayName}</p>
                  </div>
                  <div className="h-px bg-stone-200/40" />
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 glass-hover"
                  >
                    <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-70">
                      退出登录
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        
        <div className="hidden sm:block">
          <CloudRain className="w-5 h-5 text-[#4A5D4E] opacity-40" strokeWidth={1.5} />
        </div>
      </div>

      <LoginModal
        open={loginModalOpen}
        onClose={closeLoginModal}
        onLogin={(displayName) => login(displayName)}
      />
    </header>
  );
}
