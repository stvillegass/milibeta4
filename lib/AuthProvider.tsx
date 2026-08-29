"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

interface AuthContextValue {
  user: any | null;
  isAdmin: boolean;
  isAuthLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  isAuthLoading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Lee el rol del usuario desde la tabla `profiles` usando su user.id
  const loadProfileRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching profile role:", error);
        setProfileRole(null);
        return;
      }

      setProfileRole(data?.role || null);
    } catch (err) {
      console.error("Error loading profile role:", err);
      setProfileRole(null);
    }
  };

  useEffect(() => {
    // Leer la sesión activa al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileRole(session.user.id);
      } else {
        setProfileRole(null);
      }
      setIsAuthLoading(false);
    });

    // Escuchar cambios en la sesión (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfileRole(session.user.id);
      } else {
        setProfileRole(null);
      }
      setIsAuthLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const isAdmin = profileRole === "admin";

  return (
    <AuthContext.Provider value={{ user, isAdmin, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}