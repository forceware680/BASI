// lib/auth.tsx — React Context & Hook untuk Autentikasi dan Role-Based Access Control (RBAC).

import React, { createContext, useContext, useEffect, useState } from "react";
import { login as apiLogin, getSessionUser } from "./api";
import type { UserSession } from "./api";

interface AuthContextType {
  user: UserSession | null;
  isAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: React.Dispatch<React.SetStateAction<UserSession | null>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = "simbasi_bmd_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Muat dan validasi sesi saat startup
  useEffect(() => {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      setIsLoading(false);
      return;
    }

    try {
      const savedUser: UserSession = JSON.parse(rawSession);
      if (savedUser && savedUser.id) {
        // Validasi ke backend apakah user masih aktif
        getSessionUser(savedUser.id)
          .then((verified) => {
            if (verified) {
              setUser(verified);
              localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(verified));
            } else {
              localStorage.removeItem(SESSION_STORAGE_KEY);
              setUser(null);
            }
          })
          .catch(() => {
            // Jika koneksi DB offline / gagal sementara, tetap gunakan saved session lokal
            setUser(savedUser);
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        setIsLoading(false);
      }
    } catch {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      setIsLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    const session = await apiLogin(username, password);
    setUser(session);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const isAdmin = user?.role === "ADMIN";

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth harus digunakan di dalam <AuthProvider>");
  }
  return context;
}
