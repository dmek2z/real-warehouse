import { createClient } from '@supabase/supabase-js';

// 환경 변수 검증 및 디버깅
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 디버깅용 로그 (production에서는 제거 예정)
console.log('Environment variables check:', {
  hasUrl: !!supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  hasServiceKey: !!supabaseServiceKey,
  url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
  anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'undefined'
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
  });
  throw new Error(`Missing required environment variables: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''}`);
}

// 싱글톤 인스턴스 생성
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;

// 일반 사용자용 클라이언트
export const supabase = (() => {
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'supabase.auth.token'
        }
      });
      console.log('Supabase client initialized successfully');
    } catch (error) {
      console.error('Error initializing Supabase client:', error);
      throw error;
    }
  }
  return supabaseInstance;
})();

// 관리자 권한이 필요한 작업용 클라이언트
export const supabaseAdmin = (() => {
  if (!supabaseAdminInstance) {
    try {
      supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          storageKey: 'supabase.admin.token'
        }
      });
      console.log('Supabase admin client initialized successfully');
    } catch (error) {
      console.error('Error initializing Supabase admin client:', error);
      throw error;
    }
  }
  return supabaseAdminInstance;
})(); 