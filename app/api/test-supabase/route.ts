import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const results: any[] = [];
  
  try {
    // 환경변수 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    results.push({
      step: '환경변수 확인',
      status: 'success',
      data: {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceKey,
        url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'MISSING'
      }
    });
    
    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json({
        error: '환경변수가 설정되지 않았습니다',
        results
      }, { status: 500 });
    }
    
    // Admin 클라이언트로 사용자 목록 확인
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    
    results.push({
      step: 'Admin 클라이언트 생성',
      status: 'success',
      data: 'OK'
    });
    
    // 사용자 목록 조회
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      results.push({
        step: '사용자 목록 조회',
        status: 'error',
        error: usersError.message
      });
      return NextResponse.json({ results }, { status: 500 });
    }
    
    results.push({
      step: '사용자 목록 조회',
      status: 'success',
      data: {
        totalUsers: users.users.length,
        users: users.users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          last_sign_in_at: u.last_sign_in_at
        }))
      }
    });
    
    // 최근 생성된 사용자가 있으면 로그인 테스트
    if (users.users.length > 0) {
      const testUser = users.users[users.users.length - 1];
      results.push({
        step: '테스트 대상 사용자',
        status: 'info',
        data: {
          email: testUser.email,
          id: testUser.id,
          created_at: testUser.created_at
        }
      });
      
      // 비밀번호 재설정 테스트
      const newPassword = 'testpass123!';
      
      results.push({
        step: '비밀번호 재설정 시도',
        status: 'info',
        data: `${testUser.email}의 비밀번호를 ${newPassword}로 변경`
      });
      
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        testUser.id,
        {
          password: newPassword
        }
      );
      
      if (updateError) {
        results.push({
          step: '비밀번호 재설정',
          status: 'error',
          error: updateError.message
        });
      } else {
        results.push({
          step: '비밀번호 재설정',
          status: 'success',
          data: '비밀번호 변경 성공'
        });
        
        // 새 비밀번호로 로그인 테스트  
        if (!supabaseAnonKey) {
          results.push({
            step: '새 비밀번호로 로그인 테스트',
            status: 'error',
            error: 'ANON_KEY가 없습니다'
          });
          return NextResponse.json({ results }, { status: 500 });
        }
        
        const supabaseClient = createClient(supabaseUrl as string, supabaseAnonKey as string);
        
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
          email: testUser.email,
          password: newPassword
        });
        
        if (loginError) {
          results.push({
            step: '새 비밀번호로 로그인 테스트',
            status: 'error',
            error: loginError.message
          });
        } else {
          results.push({
            step: '새 비밀번호로 로그인 테스트',
            status: 'success',
            data: {
              message: '로그인 성공!',
              userId: loginData.user.id,
              email: loginData.user.email
            }
          });
          
          // 로그아웃
          await supabaseClient.auth.signOut();
          
          results.push({
            step: '로그아웃',
            status: 'success',
            data: '로그아웃 완료'
          });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Supabase 테스트 완료',
      results,
      summary: {
        totalSteps: results.length,
        successSteps: results.filter(r => r.status === 'success').length,
        errorSteps: results.filter(r => r.status === 'error').length
      }
    });
    
  } catch (error: any) {
    results.push({
      step: '전체 테스트',
      status: 'error',
      error: error.message
    });
    
    return NextResponse.json({
      success: false,
      error: error.message,
      results
    }, { status: 500 });
  }
} 