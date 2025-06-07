import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabaseClient';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, newPassword } = body;

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Service Role을 사용한 Admin 클라이언트 생성
    const supabaseAdmin = createAdminClient();

    // Admin API로 비밀번호 업데이트
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        password: newPassword
      }
    );

    if (authError) {
      console.error('Admin password update error:', authError);
      return NextResponse.json(
        { error: `비밀번호 변경 실패: ${authError.message}` },
        { status: 400 }
      );
    }

    console.log('✅ Admin API로 비밀번호 변경 성공:', userId);

    return NextResponse.json({
      success: true,
      user: authData.user
    });

  } catch (error: any) {
    console.error('Update password API error:', error);
    return NextResponse.json(
      { error: `서버 오류: ${error.message}` },
      { status: 500 }
    );
  }
} 