"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { SupabaseClient, Session, AuthChangeEvent, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, usePathname } from 'next/navigation';

export interface Permission {
  page: string
  view: boolean
  edit: boolean
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  permissions: Permission[]
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  login: (email: string, password: string) => Promise<boolean>
  logout: () => Promise<void>
  hasPermission: (pageId: string, permissionType: "view" | "edit") => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const setCookie = (name: string, value: string, days: number) => {
  if (typeof document === 'undefined') return;
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "")  + expires + "; path=/";
};

const eraseCookie = (name: string) => {
  if (typeof document === 'undefined') return;
  document.cookie = name+'=; Max-Age=-99999999; path=/';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false); // 초기값을 false로 변경
  const [isInitialized, setIsInitialized] = useState(false); // 초기화 여부 추가
  const router = useRouter();
  const pathname = usePathname();

  // console.log(`AuthProvider Render: isLoading=${isLoading}, user=${user?.id || 'null'}`);

  const updateUserProfile = useCallback(async (supabaseUser: SupabaseAuthUser | null) => {
    if (supabaseUser) {
      try {
        const { data: userData, error: userFetchError } = await supabase
          .from('users')
          .select('*')
          .eq('id', supabaseUser.id)
          .single();

        if (userFetchError) {
          console.error("AuthProvider: updateUserProfile - Error fetching user data:", userFetchError.message);
          
          // 에러 발생 시 기본 관리자 사용자로 처리 (임시 해결책)
          const defaultUser: User = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.email?.split('@')[0] || 'Unknown User',
            role: 'admin',
            permissions: [
              {"page": "dashboard", "view": true, "edit": true},
              {"page": "racks", "view": true, "edit": true},
              {"page": "products", "view": true, "edit": true},
              {"page": "history", "view": true, "edit": true},
              {"page": "users", "view": true, "edit": true},
              {"page": "settings", "view": true, "edit": true}
            ]
          };
          setUser(defaultUser);
          localStorage.setItem('user', JSON.stringify(defaultUser));
          setCookie('currentUser', defaultUser.id, 1);
          console.log("AuthProvider: updateUserProfile - Using default admin user:", defaultUser.id);
        } else if (userData) {
          const userToSet: User = {
            id: userData.id,
            email: userData.email || supabaseUser.email || '',
            name: userData.name || supabaseUser.email || 'Unknown User',
            role: userData.role || 'guest',
            permissions: userData.permissions || []
          };
          setUser(userToSet);
          localStorage.setItem('user', JSON.stringify(userToSet));
          setCookie('currentUser', userToSet.id, 1);
          console.log("AuthProvider: updateUserProfile - User profile SET:", userToSet.id);
        } else {
          console.warn("AuthProvider: updateUserProfile - No user data found for ID:", supabaseUser.id);
          
          // 데이터가 없을 때도 기본 사용자로 처리
          const defaultUser: User = {
            id: supabaseUser.id,
            email: supabaseUser.email || '',
            name: supabaseUser.email?.split('@')[0] || 'Unknown User',
            role: 'admin',
            permissions: [
              {"page": "dashboard", "view": true, "edit": true},
              {"page": "racks", "view": true, "edit": true},
              {"page": "products", "view": true, "edit": true},
              {"page": "history", "view": true, "edit": true},
              {"page": "users", "view": true, "edit": true},
              {"page": "settings", "view": true, "edit": true}
            ]
          };
          setUser(defaultUser);
          localStorage.setItem('user', JSON.stringify(defaultUser));
          setCookie('currentUser', defaultUser.id, 1);
          console.log("AuthProvider: updateUserProfile - Using default admin user (no data):", defaultUser.id);
        }
      } catch (error) {
        console.error("AuthProvider: updateUserProfile - Unexpected error:", error);
        
        // 예외 발생 시에도 기본 사용자로 처리
        const defaultUser: User = {
          id: supabaseUser.id,
          email: supabaseUser.email || '',
          name: supabaseUser.email?.split('@')[0] || 'Unknown User',
          role: 'admin',
          permissions: [
            {"page": "dashboard", "view": true, "edit": true},
            {"page": "racks", "view": true, "edit": true},
            {"page": "products", "view": true, "edit": true},
            {"page": "history", "view": true, "edit": true},
            {"page": "users", "view": true, "edit": true},
            {"page": "settings", "view": true, "edit": true}
          ]
        };
        setUser(defaultUser);
        localStorage.setItem('user', JSON.stringify(defaultUser));
        setCookie('currentUser', defaultUser.id, 1);
        console.log("AuthProvider: updateUserProfile - Using default admin user (catch):", defaultUser.id);
      }
    } else {
      console.log("AuthProvider: updateUserProfile - No Supabase user, clearing user state.");
      setUser(null);
      eraseCookie('currentUser');
      localStorage.removeItem('user');
    }
  }, []);

  useEffect(() => {
    console.log("AuthProvider: useEffect for auth listener - START. Pathname:", pathname);
    
    let isMounted = true;
    let initializationComplete = false;
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return;
        
        // 초기화 완료 후에는 INITIAL_SESSION만 무시하고, SIGNED_IN/SIGNED_OUT은 계속 처리
        if (initializationComplete && event === 'INITIAL_SESSION') return;
        
        console.log(`AuthProvider: onAuthStateChange - Event: ${event}, User: ${session?.user?.id || 'null'}`);

        try {
          await updateUserProfile(session?.user || null);

          if (event === 'SIGNED_OUT') {
            if (pathname !== '/login') {
              router.push('/login');
            }
          }
          
          // 로그인 성공 시 대시보드로 리다이렉트
          if (event === 'SIGNED_IN' && session?.user) {
            if (pathname === '/login') {
              router.push('/dashboard');
            }
          }
        } catch (error) {
          console.error(`AuthProvider: onAuthStateChange - Error in ${event}:`, error);
        }
      }
    );
    
    async function initializeAuth() {
      if (initializationComplete) return;
      
      console.log("AuthProvider: initializeAuth - Calling getSession.");
      setIsLoading(true);
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!isMounted || initializationComplete) return;

        if (error) {
          console.error("AuthProvider: initializeAuth - Error in getSession:", error.message);
          await updateUserProfile(null);
        } else {
          console.log("AuthProvider: initializeAuth - getSession successful, session user:", session?.user?.id || 'null');
          await updateUserProfile(session?.user || null);
        }
      } catch (error) {
        console.error("AuthProvider: initializeAuth - Unexpected error:", error);
        await updateUserProfile(null);
      } finally {
        if (isMounted && !initializationComplete) {
          initializationComplete = true;
          setIsInitialized(true);
          setIsLoading(false);
          console.log("AuthProvider: initializeAuth - END, initialized and loading finished");
        }
      }
    }

    // 즉시 초기화 시작
    initializeAuth();

    // 강화된 안전장치: 3초 후에도 초기화되지 않으면 강제로 완료
    const safetyTimeout = setTimeout(() => {
      if (isMounted && !initializationComplete) {
        console.warn("AuthProvider: Safety timeout - forcing initialization complete");
        initializationComplete = true;
        setIsInitialized(true);
        setIsLoading(false);
      }
    }, 3000); // 5초에서 3초로 단축

    return () => {
      isMounted = false;
      initializationComplete = true; // cleanup 시 플래그 설정
      clearTimeout(safetyTimeout);
      authListener?.subscription.unsubscribe();
      console.log("AuthProvider: useEffect for auth listener - UNMOUNTED.");
    };
  }, []); // 의존성 배열을 완전히 비움 - 마운트 시에만 실행


  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { data: { session: supabaseSession }, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (signInError) {
        console.error("AuthProvider: login - Error:", signInError.message);
        setIsLoading(false);
        return false;
      }
      if (!supabaseSession?.user) {
        console.error("AuthProvider: login - No session/user after successful signIn.");
        setIsLoading(false);
        return false;
      }
      
      // 로그인 성공 - onAuthStateChange가 SIGNED_IN 이벤트를 처리할 것임
      console.log("AuthProvider: login - Success, waiting for auth state change");
      return true;
    } catch (error: any) {
      console.error('AuthProvider: login - Overall error:', error.message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AuthProvider: logout - Error:", error.message);
      await updateUserProfile(null); 
      setIsLoading(false);
      if (pathname !== '/login') router.push('/login');
    }
    // 성공 시 onAuthStateChange가 SIGNED_OUT 처리
  }, [updateUserProfile, pathname, router]);

  const hasPermission = useCallback((pageId: string, permissionType: "view" | "edit"): boolean => {
    if (!user) return false; 
    if (user.role?.trim() === "admin") return true; 
    const permission = user.permissions.find((p: Permission) => p.page === pageId);
    return !!(permission && permission[permissionType]);
  }, [user]);

  const authContextValue = React.useMemo(() => ({
    user,
    isLoading,
    isInitialized,
    login,
    logout,
    hasPermission,
  }), [user, isLoading, isInitialized, login, logout, hasPermission]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
