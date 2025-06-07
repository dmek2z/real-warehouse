import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, permissions } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Service Role을 사용한 Admin 클라이언트 생성
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 기존 사용자 확인 (더 정확한 중복 체크)
    console.log('🔍 기존 사용자 확인 중:', email);
    
    try {
      // 페이지별로 사용자 확인 (최대 1000명씩)
      let page = 1;
      let foundUser = null;
      
      while (page <= 5 && !foundUser) { // 최대 5000명까지 확인
        const { data: existingUsers, error: checkError } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000
        });
        
        if (checkError) {
          console.warn('사용자 목록 조회 실패:', checkError.message);
          break;
        }
        
        if (existingUsers?.users) {
          foundUser = existingUsers.users.find((u: any) => u.email === email);
          
          if (foundUser) {
            console.log('❌ 기존 사용자 발견:', {
              email: foundUser.email,
              id: foundUser.id,
              created_at: foundUser.created_at
            });
            
            return NextResponse.json(
              { 
                error: `이미 등록된 이메일입니다: ${email}`,
                details: `기존 사용자 ID: ${foundUser.id}`,
                userExists: true
              },
              { status: 409 }
            );
          }
          
          // 더 이상 사용자가 없으면 중단
          if (existingUsers.users.length < 1000) break;
        } else {
          break;
        }
        
        page++;
      }
      
      console.log('✅ 기존 사용자 없음, 생성 진행:', email);
      
    } catch (listError: any) {
      console.warn('사용자 목록 조회 중 오류:', listError.message);
      // 목록 조회 실패해도 생성은 시도
    }

    // Admin API로 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role
      }
    });

    if (authError) {
      console.error('Admin API error:', authError);
      
      // 중복 이메일 에러 특별 처리
      if (authError.message.includes('already been registered') || 
          authError.message.includes('email address is invalid') ||
          authError.message.includes('User already registered')) {
        return NextResponse.json(
          { error: `이미 등록된 이메일입니다: ${email}` },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: `사용자 생성 실패: ${authError.message}` },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: '사용자 데이터가 생성되지 않았습니다.' },
        { status: 400 }
      );
    }

    // users 테이블에 추가 정보 저장
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email,
        name,
        role,
        permissions: permissions || []
      });

    if (dbError) {
      console.warn('DB insert warning:', dbError.message);
      // DB 저장 실패해도 Auth 사용자는 생성됨
    }

    console.log('✅ Admin API로 사용자 생성 성공:', authData.user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email,
        name,
        role,
        permissions: permissions || []
      }
    });

  } catch (error: any) {
    console.error('Create user API error:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 