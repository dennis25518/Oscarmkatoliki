import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, supabase } from "./supabaseClient";

interface AuthContextType {
  user: any | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in and handle OAuth callbacks
    const checkAuth = async () => {
      try {
        // Handle OAuth callback - check for token in URL hash
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          // Supabase will handle the hash automatically, just get the session
          const session = await supabase.auth.getSession();
          if (session.data.session?.user) {
            setUser(session.data.session.user);
            // Clean up hash from URL
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );
          }
        } else {
          const currentUser = await auth.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const unsubscribe = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        // Clean up URL hash if it exists
        if (window.location.hash.includes("access_token")) {
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
    });

    return () => {
      unsubscribe?.data?.subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    const { error } = await auth.logout();
    if (!error) {
      setUser(null);
    } else {
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
