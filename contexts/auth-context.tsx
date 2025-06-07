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
  forceLogout: () => void
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
  const [user, setUser] = useState<User | null>(() => {
    // 초기화 시 localStorage에서 사용자 정보 복원 (SSR 고려)
    if (typeof window !== 'undefined') {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          console.log('AuthProvider: Restored user from localStorage on init');
          return JSON.parse(storedUser);
        }
      } catch (error) {
        console.warn('AuthProvider: Failed to parse stored user data:', error);
      }
    }
    return null;
  });
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
          // DB 권한 문제는 예상된 상황이므로 warning으로 처리
          if (userFetchError.message.includes('permission denied')) {
            console.warn("AuthProvider: Database not configured, using fallback admin user");
          } else {
            console.error("AuthProvider: updateUserProfile - Error fetching user data:", userFetchError.message);
          }
          
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
          localStorage.setItem('user_role', 'admin'); // 추가 안전장치
          setCookie('currentUser', defaultUser.id, 1);
          console.log("AuthProvider: updateUserProfile - Using default admin user:", defaultUser.id, defaultUser);
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
          localStorage.setItem('user_role', userToSet.role); // 추가 안전장치
          setCookie('currentUser', userToSet.id, 1);
          console.log("AuthProvider: updateUserProfile - User profile SET:", userToSet.id, userToSet);
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
          localStorage.setItem('user_role', 'admin'); // 추가 안전장치
          setCookie('currentUser', defaultUser.id, 1);
          console.log("AuthProvider: updateUserProfile - Using default admin user (no data):", defaultUser.id, defaultUser);
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
        localStorage.setItem('user_role', 'admin'); // 추가 안전장치
        setCookie('currentUser', defaultUser.id, 1);
        console.log("AuthProvider: updateUserProfile - Using default admin user (catch):", defaultUser.id, defaultUser);
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

          // 중요한 인증 이벤트 후 로딩 상태 해제
          if (['SIGNED_IN', 'SIGNED_OUT'].includes(event)) {
            setIsLoading(false);
            console.log(`AuthProvider: onAuthStateChange - setIsLoading(false) after ${event}`);
          }

          if (event === 'SIGNED_OUT') {
            if (pathname !== '/login') {
              router.push('/login');
            }
          }
          
          // 로그인 성공 시 대시보드로 리다이렉트
          if (event === 'SIGNED_IN' && session?.user) {
            console.log('AuthProvider: SIGNED_IN - redirecting to dashboard');
            setIsLoading(false); // 여기서 확실히 로딩 해제
            if (pathname === '/login') {
              setTimeout(() => {
                router.push('/dashboard');
              }, 100);
            }
          }
        } catch (error) {
          console.error(`AuthProvider: onAuthStateChange - Error in ${event}:`, error);
          // 에러 발생 시에도 로딩 해제
          if (['SIGNED_IN', 'SIGNED_OUT'].includes(event)) {
            setIsLoading(false);
          }
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
          console.log("AuthProvider: initializeAuth - Setting isInitialized(true) and isLoading(false)");
          setIsInitialized(true);
          setIsLoading(false);
          console.log("AuthProvider: initializeAuth - END, initialized and loading finished");
        } else {
          console.log("AuthProvider: initializeAuth - Finally block skipped, isMounted:", isMounted, "initializationComplete:", initializationComplete);
        }
      }
    }

    // 즉시 초기화 시작
    initializeAuth().catch((error) => {
      console.error("AuthProvider: initializeAuth failed:", error);
      if (isMounted && !initializationComplete) {
        initializationComplete = true;
        setIsInitialized(true);
        setIsLoading(false);
      }
    });

    // 단일 안전장치: 2초 후에도 초기화되지 않으면 강제로 완료
    const safetyTimeout = setTimeout(() => {
      if (isMounted && !initializationComplete) {
        console.warn("AuthProvider: Safety timeout (2s) - forcing initialization complete");
        initializationComplete = true;
        setIsInitialized(true);
        setIsLoading(false);
      }
    }, 2000);

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
        // 인증 실패는 정상적인 사용자 입력 오류일 수 있으므로 레벨 조정
        if (signInError.message.includes('Invalid login credentials')) {
          console.warn("AuthProvider: login - Invalid credentials provided");
        } else {
          console.error("AuthProvider: login - Error:", signInError.message);
        }
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
      
      // 안전장치: 3초 후에도 로딩이 해제되지 않으면 강제 해제
      setTimeout(() => {
        if (isLoading) {
          console.warn("AuthProvider: login - Timeout fallback, forcing isLoading false");
          setIsLoading(false);
        }
      }, 3000);
      
      return true;
    } catch (error: any) {
      console.error('AuthProvider: login - Overall error:', error.message);
      setIsLoading(false);
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    // 이미 로그아웃 중이면 중복 실행 방지
    if (isLoading) {
      console.log("AuthProvider: logout already in progress, skipping");
      return;
    }

    try {
      setIsLoading(true);
      console.log("AuthProvider: logout - Starting logout process");
      
      // 1단계: 즉시 로컬 상태 정리
      setUser(null);
      setIsInitialized(false);
      
      // 2단계: 로컬 스토리지 정리
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        eraseCookie('currentUser');
        console.log("AuthProvider: localStorage cleared");
      } catch (storageError) {
        console.warn("AuthProvider: localStorage clear failed:", storageError);
      }
      
      // 3단계: Supabase 로그아웃
      try {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.error("AuthProvider: Supabase signOut error:", error.message);
        } else {
          console.log("AuthProvider: Supabase signOut successful");
        }
      } catch (supabaseError) {
        console.error("AuthProvider: Supabase signOut failed:", supabaseError);
      }
      
      // 4단계: 강제 리다이렉트 (지연 없이)
      console.log("AuthProvider: logout completed, redirecting to login");
      window.location.href = '/login'; // router.push 대신 강제 페이지 이동
      
    } catch (error: any) {
      console.error("AuthProvider: logout - Unexpected error:", error);
      
      // 에러 발생 시에도 무조건 로그아웃 상태로 만들기
      setUser(null);
      setIsInitialized(false);
      
      try {
        localStorage.removeItem('user');
        localStorage.removeItem('user_role');
        eraseCookie('currentUser');
      } catch {}
      
      // 강제 리다이렉트
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const forceLogout = useCallback(() => {
    console.log("AuthProvider: forceLogout - Emergency logout");
    
    // 즉시 상태 정리
    setUser(null);
    setIsInitialized(false);
    setIsLoading(false);
    
    // 로컬 스토리지 정리
    try {
      localStorage.clear(); // 모든 로컬 스토리지 정리
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
    } catch (error) {
      console.warn("forceLogout: cleanup failed", error);
    }
    
    // 강제 페이지 이동
    window.location.href = '/login';
  }, []);

  const hasPermission = useCallback((pageId: string, permissionType: "view" | "edit"): boolean => {
    // 로그아웃 중이면 권한 체크 안 함
    if (isLoading && !user && !isInitialized) {
      return false;
    }
    
    // 초기화 중이거나 로딩 중일 때는 기본적으로 권한 허용 (관리자로 가정)
    if (!isInitialized) {
      return true;
    }
    
    // 사용자 정보가 없으면 localStorage에서 다시 확인
    if (!user) {
      try {
        const storedRole = localStorage.getItem('user_role');
        if (storedRole === 'admin') {
          return true;
        }
      } catch (error) {
        console.warn('hasPermission: Failed to read localStorage:', error);
      }
      return false; 
    }
    
    // 관리자는 모든 권한 허용
    if (user.role?.trim() === "admin") {
      return true; 
    }
    
    // 일반 사용자는 권한 배열에서 확인
    const permission = user.permissions?.find((p: Permission) => p.page === pageId);
    const hasAccess = !!(permission && permission[permissionType]);
    return hasAccess;
  }, [user, isInitialized, isLoading]);

  const authContextValue = React.useMemo(() => ({
    user,
    isLoading,
    isInitialized,
    login,
    logout,
    forceLogout,
    hasPermission,
  }), [user, isLoading, isInitialized, login, logout, forceLogout, hasPermission]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
}
