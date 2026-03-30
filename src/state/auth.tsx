import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type AuthUser = {
  id: string;
  displayName: string;
  avatarSeed: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  login: (displayName: string) => void;
  logout: () => void;
  loginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
};

const STORAGE_KEY = "rainyVibe:mockUser";

const AuthContext = createContext<AuthContextValue | null>(null);

function safeParseUser(raw: string | null): AuthUser | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw) as Partial<AuthUser>;
    if (!obj || typeof obj !== "object") return null;
    if (typeof obj.id !== "string") return null;
    if (typeof obj.displayName !== "string") return null;
    if (typeof obj.avatarSeed !== "string") return null;
    return { id: obj.id, displayName: obj.displayName, avatarSeed: obj.avatarSeed };
  } catch {
    return null;
  }
}

function createMockUser(displayName: string): AuthUser {
  const name = displayName.trim() || "Rainy";
  const id = crypto.randomUUID?.() ?? `u_${Date.now()}`;
  const avatarSeed = `${name}:${id}`;
  return { id, displayName: name, avatarSeed };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => safeParseUser(localStorage.getItem(STORAGE_KEY)));
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setUser(safeParseUser(e.newValue));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((displayName: string) => {
    const next = createMockUser(displayName);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUser(next);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const openLoginModal = useCallback(() => setLoginModalOpen(true), []);
  const closeLoginModal = useCallback(() => setLoginModalOpen(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, login, logout, loginModalOpen, openLoginModal, closeLoginModal }),
    [user, login, logout, loginModalOpen, openLoginModal, closeLoginModal]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

