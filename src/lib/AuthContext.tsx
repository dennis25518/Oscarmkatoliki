import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

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
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        setUser(data.session?.user || null);
        
        // Clean up hash if present
        if (window.location.hash.includes("access_token")) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth state changes (Supabase automatically handles hash parsing)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      
      // Clean up hash after login
      if (event === "SIGNED_IN" && window.location.hash.includes("access_token")) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
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
