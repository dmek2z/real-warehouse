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