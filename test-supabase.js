const { createClient } = require('@supabase/supabase-js');

// 환경변수에서 가져오기
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('=== Supabase 연동 테스트 ===');
console.log('URL:', supabaseUrl ? 'OK' : 'MISSING');
console.log('Anon Key:', supabaseAnonKey ? 'OK' : 'MISSING');
console.log('Service Key:', supabaseServiceKey ? 'OK' : 'MISSING');

// Admin 클라이언트로 사용자 목록 확인
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function testSupabase() {
  try {
    console.log('\n=== 1. 사용자 목록 조회 ===');
    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ 사용자 목록 조회 실패:', usersError.message);
      return;
    }
    
    console.log('✅ 총 사용자 수:', users.users.length);
    users.users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (ID: ${user.id}) - 생성일: ${user.created_at}`);
    });
    
    // 최근 생성된 사용자로 로그인 테스트
    if (users.users.length > 0) {
      const testUser = users.users[users.users.length - 1]; // 가장 최근 사용자
      console.log(`\n=== 2. 최근 사용자로 로그인 테스트: ${testUser.email} ===`);
      
      // 일반 클라이언트로 로그인 시도
      const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
      
      // 임시 비밀번호로 테스트 (일반적으로 사용되는 것들)
      const testPasswords = ['123456', 'password', 'test123', '123123'];
      
      for (const password of testPasswords) {
        console.log(`패스워드 테스트: ${password}`);
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
          email: testUser.email,
          password: password
        });
        
        if (loginError) {
          console.log(`❌ 로그인 실패 (${password}):`, loginError.message);
        } else {
          console.log(`✅ 로그인 성공! 사용자 ID:`, loginData.user.id);
          await supabaseClient.auth.signOut();
          break;
        }
      }
    }
    
    console.log('\n=== 3. 비밀번호 재설정 테스트 ===');
    if (users.users.length > 0) {
      const testUser = users.users[users.users.length - 1];
      const newPassword = 'newpass123';
      
      console.log(`사용자 ${testUser.email}의 비밀번호를 ${newPassword}로 변경 시도...`);
      
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        testUser.id,
        {
          password: newPassword
        }
      );
      
      if (updateError) {
        console.error('❌ 비밀번호 변경 실패:', updateError.message);
      } else {
        console.log('✅ 비밀번호 변경 성공');
        
        // 새 비밀번호로 로그인 테스트
        console.log('새 비밀번호로 로그인 테스트...');
        const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
        
        const { data: loginData, error: loginError } = await supabaseClient.auth.signInWithPassword({
          email: testUser.email,
          password: newPassword
        });
        
        if (loginError) {
          console.error('❌ 새 비밀번호로 로그인 실패:', loginError.message);
        } else {
          console.log('✅ 새 비밀번호로 로그인 성공!', loginData.user.id);
          await supabaseClient.auth.signOut();
        }
      }
    }
    
  } catch (error) {
    console.error('전체 테스트 실패:', error.message);
  }
}

testSupabase(); 