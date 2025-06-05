# TAD STORY 배포 가이드

TAD STORY 냉동 창고 관리 시스템을 Supabase와 Vercel을 이용해 배포하는 방법을 안내합니다.

## 1. 사전 준비

### 필요한 계정
- [Supabase](https://supabase.com) 계정
- [Vercel](https://vercel.com) 계정
- GitHub 계정 (코드 저장소용)

### 로컬 개발 환경
- Node.js 18.18.0 이상
- npm 또는 yarn

## 2. Supabase 설정

### 2.1 프로젝트 생성
1. [Supabase Dashboard](https://app.supabase.com)에 로그인
2. "New Project" 클릭
3. 프로젝트 정보 입력:
   - Name: `tadstory` (또는 원하는 이름)
   - Database Password: 강력한 비밀번호 설정
   - Region: 가장 가까운 지역 선택 (예: Northeast Asia (Seoul))

### 2.2 데이터베이스 스키마 생성
1. Supabase Dashboard → SQL Editor
2. 프로젝트 루트의 `supabase-schema.sql` 파일 내용을 복사
3. SQL Editor에 붙여넣기 후 "Run" 실행

### 2.3 환경 변수 확인
1. Supabase Dashboard → Settings → API
2. 다음 값들을 메모:
   - `Project URL`
   - `anon public` API key

### 2.4 Authentication 설정
1. Supabase Dashboard → Authentication → Settings
2. Site URL에 배포할 도메인 추가 (예: https://your-app.vercel.app)
3. Redirect URLs에도 동일한 도메인 추가

## 3. 로컬 개발 환경 설정

### 3.1 환경 변수 설정
프로젝트 루트에 `.env.local` 파일 생성:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://ffpuyonlxnnjytnimwmg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcHV5b25seG5uanl0bmltd21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NjI2MjQsImV4cCI6MjA2MzUzODYyNH0.ZRdVu6dKjMDSINiMvCvItaahgpGSDK2GAzEN5JldiOw
```

### 3.2 의존성 설치 및 실행
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하여 정상 작동 확인

## 4. Vercel 배포

### 4.1 GitHub 저장소 준비
1. GitHub에 새 저장소 생성
2. 로컬 프로젝트를 GitHub에 push:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/dmek2z/real-warehouse.git
git push -u origin main
```

### 4.2 Vercel 프로젝트 생성
1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. "New Project" 클릭
3. GitHub 저장소를 선택하여 import
4. 프로젝트 설정:
   - Framework Preset: `Next.js`
   - Root Directory: `./` (기본값)
   - Build and Output Settings: 기본값 사용

### 4.3 환경 변수 설정
1. Vercel Dashboard → Settings → Environment Variables
2. 다음 환경 변수들을 추가:
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase 프로젝트 URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key

### 4.4 도메인 설정 (선택사항)
1. Vercel Dashboard → Settings → Domains
2. 커스텀 도메인이 있다면 추가 설정

## 5. 초기 설정 및 테스트

### 5.1 관리자 계정 생성
1. 배포된 앱에 접속
2. Supabase Dashboard → Authentication → Users
3. "Add user" 클릭하여 관리자 계정 생성
4. 생성된 사용자의 `user_metadata`를 수정하여 관리자 권한 부여

### 5.2 기본 데이터 확인
1. 카테고리가 정상적으로 생성되었는지 확인
2. 샘플 품목 코드와 랙이 생성되었는지 확인
3. 각 기능들이 정상 작동하는지 테스트

## 6. 보안 고려사항

### 6.1 Row Level Security (RLS)
- 스키마에 이미 기본적인 RLS 정책이 포함되어 있습니다
- 필요에 따라 더 세밀한 권한 제어를 위해 정책을 수정할 수 있습니다

### 6.2 API 키 보안
- `SUPABASE_SERVICE_ROLE_KEY`는 서버 사이드에서만 사용
- 클라이언트에는 절대 노출하지 않도록 주의

### 6.3 사용자 인증
- 현재는 기본적인 이메일/비밀번호 인증 사용
- 필요시 OAuth 제공자 추가 가능 (Google, GitHub 등)

## 7. 모니터링 및 유지보수

### 7.1 로그 모니터링
- Vercel Dashboard → Functions에서 실행 로그 확인
- Supabase Dashboard → Logs에서 데이터베이스 활동 모니터링

### 7.2 성능 최적화
- Vercel Analytics 활성화하여 성능 지표 추적
- Supabase Database → Performance에서 쿼리 성능 모니터링

### 7.3 백업
- Supabase는 자동 백업을 제공하지만, 중요한 데이터는 별도 백업 고려

## 8. 문제 해결

### 8.1 일반적인 문제들

**환경 변수 오류**
- `.env.local` 파일 위치 확인 (프로젝트 루트)
- 환경 변수명 정확성 확인 (`NEXT_PUBLIC_` 접두사 필수)

**데이터베이스 연결 오류**
- Supabase 프로젝트 URL과 API 키 재확인
- RLS 정책이 올바르게 설정되었는지 확인

**빌드 오류**
- Node.js 버전 확인 (18.18.0 이상 권장)
- `npm install` 재실행

**403 Forbidden 오류**
- RLS 정책 확인
- 사용자 인증 상태 확인

### 8.2 로그 확인 방법
- 브라우저 개발자 도구 → Console
- Vercel Dashboard → Functions → View Function Logs
- Supabase Dashboard → Logs

## 9. 추가 기능 구현

향후 다음 기능들을 구현할 수 있습니다:

### 9.1 실시간 알림
- 재고 부족 알림
- 온도 이상 알림
- 입출고 활동 알림

### 9.2 고급 분석
- 재고 회전율 분석
- 예측 분석
- 비용 분석

### 9.3 모바일 앱
- React Native를 이용한 모바일 앱 개발
- 바코드 스캔 기능
- 오프라인 지원

## 연락처

배포 과정에서 문제가 발생하면 다음을 참고하세요:
- [Supabase 문서](https://supabase.com/docs)
- [Vercel 문서](https://vercel.com/docs)
- [Next.js 문서](https://nextjs.org/docs) 