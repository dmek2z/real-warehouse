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
    // console.log("AuthProvider: updateUserProfile - START", supabaseUser?.id || 'null');
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
    console.log("AuthProvider: updateUserProfile - END");
  }, []);

  useEffect(() => {
    console.log("AuthProvider: useEffect for auth listener - START. Pathname:", pathname);
    
    let isMounted = true;
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!isMounted) return;
        console.log(`AuthProvider: onAuthStateChange - Event: ${event}, User: ${session?.user?.id || 'null'}`);

        try {
          await updateUserProfile(session?.user || null);

          if (event === 'SIGNED_OUT') {
            if (pathname !== '/login') {
              router.push('/login');
            }
          }
          
          // 초기화 완료 표시
          if (!isInitialized) {
            setIsInitialized(true);
            console.log(`AuthProvider: onAuthStateChange - setIsInitialized(true) after ${event}`);
          }
        } catch (error) {
          console.error(`AuthProvider: onAuthStateChange - Error in ${event}:`, error);
          // 에러 발생 시에도 초기화 완료로 표시
          if (!isInitialized) {
            setIsInitialized(true);
          }
        }
      }
    );
    
    async function initializeAuth() {
      console.log("AuthProvider: initializeAuth - Calling getSession.");
      setIsLoading(true); // 초기화 시작 시에만 로딩 설정
      
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error("AuthProvider: initializeAuth - Error in getSession:", error.message);
        await updateUserProfile(null);
      } else {
        console.log("AuthProvider: initializeAuth - getSession successful, session user:", session?.user?.id || 'null');
        await updateUserProfile(session?.user || null);
      }
      
      setIsInitialized(true);
      setIsLoading(false);
      console.log("AuthProvider: initializeAuth - END, initialized and loading finished");
    }

    initializeAuth();

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
      console.log("AuthProvider: useEffect for auth listener - UNMOUNTED.");
    };
  }, [updateUserProfile, router, pathname, isInitialized]); // isInitialized 의존성 추가


  const login = async (email: string, password: string): Promise<boolean> => {
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
      // 성공 시 onAuthStateChange가 SIGNED_IN 이벤트를 처리하여 user 상태를 업데이트하고,
      // 해당 핸들러 내에서 setIsLoading(false)가 호출됩니다.
      return true;
    } catch (error: any) {
      console.error('AuthProvider: login - Overall error:', error.message);
      setIsLoading(false);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("AuthProvider: logout - Error:", error.message);
      await updateUserProfile(null); 
      setIsLoading(false);
      if (pathname !== '/login') router.push('/login');
      // throw error; // 에러를 반드시 throw할 필요는 없을 수 있음
    }
    // 성공 시 onAuthStateChange가 SIGNED_OUT 처리 (user null, isLoading false, 페이지 이동)
  };

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
  }), [user, isLoading, isInitialized, hasPermission]); // login, logout 함수 참조가 변경되지 않도록 useCallback 적용 고려

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
