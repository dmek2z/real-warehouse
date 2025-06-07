import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, name } = body;

    if (!userId || !name) {
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

    // 1. Auth 메타데이터 업데이트
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { name }
      }
    );

    if (authError) {
      console.error('Auth metadata update error:', authError);
      return NextResponse.json(
        { error: `메타데이터 업데이트 실패: ${authError.message}` },
        { status: 400 }
      );
    }

    // 2. users 테이블 업데이트
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ name })
      .eq('id', userId);

    if (dbError) {
      console.warn('DB update warning:', dbError.message);
      // DB 업데이트 실패해도 Auth는 업데이트됨
    }

    console.log('✅ Admin API로 사용자 이름 업데이트 성공:', userId);

    return NextResponse.json({
      success: true,
      user: authData.user
    });

  } catch (error: any) {
    console.error('Update user name API error:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 