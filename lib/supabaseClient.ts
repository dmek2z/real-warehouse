import { createClient } from '@supabase/supabase-js';

// 환경 변수 검증 및 디버깅
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 디버깅용 로그 (development에서만 출력)
if (process.env.NODE_ENV === 'development') {
  console.log('Environment variables check:', {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
    anonKey: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : 'undefined'
  });
}

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', {
    NEXT_PUBLIC_SUPABASE_URL: !!supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !!supabaseAnonKey
  });
  throw new Error(`Missing required environment variables: ${!supabaseUrl ? 'NEXT_PUBLIC_SUPABASE_URL ' : ''}${!supabaseAnonKey ? 'NEXT_PUBLIC_SUPABASE_ANON_KEY' : ''}`);
}

// 전역 싱글톤 방식 - 단 하나의 클라이언트만 생성
declare global {
  var __supabase_client__: ReturnType<typeof createClient> | undefined;
}

// 단일 클라이언트 생성 함수
function createSupabaseClient() {
  // 서버 사이드
  if (typeof window === 'undefined') {
    return createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  
  // 클라이언트 사이드 - 완전한 싱글톤
  if (!globalThis.__supabase_client__) {
    console.log('🚀 Creating SINGLE Supabase client instance');
    
    globalThis.__supabase_client__ = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: `sb-${supabaseUrl!.replace('https://', '').split('.')[0]}-auth-token`,
        detectSessionInUrl: false,
        flowType: 'pkce'
      }
    });
  } else {
    console.log('♻️ Reusing existing Supabase client');
  }
  
  return globalThis.__supabase_client__;
}

// 유일한 클라이언트 인스턴스
export const supabase = createSupabaseClient();

// Admin 클라이언트는 서버에서만 생성하는 함수로 변경
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client should only be used on server side');
  }
  
  return createClient(
    supabaseUrl!,
    supabaseServiceKey || supabaseAnonKey!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

// 기존 호환성을 위한 더미 (사용하지 말 것)
export const supabaseAdmin = {
  from: () => { throw new Error('Use createAdminClient() in API routes instead'); },
  auth: { admin: () => { throw new Error('Use createAdminClient() in API routes instead'); } }
} as any; 