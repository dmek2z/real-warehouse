# TAD STORY - 냉동 창고 관리 시스템

TAD STORY는 냉동 창고 내의 품목, 랙(보관 공간), 사용자, 입출고 내역 등을 효율적으로 관리하고, 창고 운영에 대한 가시성 및 통찰력을 제공하는 웹 기반 관리 시스템입니다.

![Next.js](https://img.shields.io/badge/Next.js-15.2.4-black)
![React](https://img.shields.io/badge/React-19-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-BaaS-green)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.17-blue)

## 🚀 주요 기능

### 🔐 사용자 인증
- 이메일과 비밀번호를 통한 로그인/로그아웃
- 아이디 저장, 자동 로그인 옵션
- 역할 기반 권한 관리 (관리자, 매니저, 뷰어)

### 📊 대시보드
- 창고 현황 요약 (전체 랙, 사용 중 랙, 빈 랙, 품목 유형 수)
- 카테고리별 보관 분포 파이 차트
- 최근 입출고 활동 표시

### 🏗️ 랙 관리
- 라인별 랙 시각화 및 관리
- 드래그 앤 드롭을 통한 랙 라인 간 이동
- 랙 내 품목 관리 및 이동
- 엑셀 파일을 통한 일괄 업로드
- 검색 및 필터링 기능

### 📦 품목 코드 관리
- 품목 마스터 데이터 관리 (코드, 이름, 설명, 카테고리)
- 카테고리 관리
- 엑셀 일괄 업로드 지원

### 👥 사용자 관리
- 사용자 계정 관리
- 페이지별 접근 권한 설정
- 권한 템플릿 (관리자, 매니저, 뷰어) 적용

### 📋 히스토리
- 시스템 활동 로그 조회
- 유형별 필터링 및 페이지네이션
- 변경 이력 추적

### 📈 분석
- 일일 냉장 창고 사용량 통계
- 온도 및 용량 상태 모니터링
- 데이터 내보내기 (CSV, PDF, Excel)

## 🛠️ 기술 스택

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Database, Authentication, Realtime)
- **State Management**: React Context API
- **Charts**: Recharts
- **Drag & Drop**: React DnD
- **Icons**: Lucide React
- **Forms**: React Hook Form
- **Excel Processing**: xlsx
- **Notifications**: Sonner

## 🚀 배포 방법

자세한 배포 가이드는 [DEPLOYMENT.md](./DEPLOYMENT.md)를 참고하세요.

### 빠른 시작

1. **환경 변수 설정**
   ```bash
   # .env.local 파일 생성
   NEXT_PUBLIC_SUPABASE_URL=https://ffpuyonlxnnjytnimwmg.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmcHV5b25seG5uanl0bmltd21nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NjI2MjQsImV4cCI6MjA2MzUzODYyNH0.ZRdVu6dKjMDSINiMvCvItaahgpGSDK2GAzEN5JldiOw
   ```

2. **의존성 설치**
   ```bash
   npm install
   ```

3. **개발 서버 실행**
   ```bash
   npm run dev
   ```

4. **Supabase 데이터베이스 설정**
   - `supabase-schema.sql` 파일을 Supabase SQL Editor에서 실행

## 📁 프로젝트 구조

```
tadstory/
├── app/                    # Next.js App Router
│   ├── dashboard/         # 대시보드 페이지들
│   ├── login/            # 로그인 페이지
│   └── globals.css       # 전역 스타일
├── components/           # 재사용 가능한 컴포넌트
├── contexts/            # React Context (Auth, Storage)
├── lib/                # API 및 유틸리티
├── hooks/              # 커스텀 훅
├── utils/              # 유틸리티 함수
├── styles/             # 스타일 파일
└── public/             # 정적 파일
```

## 🔐 사용자 역할 및 권한

### 관리자 (Admin)
- 시스템의 모든 기능에 접근 가능
- 사용자 계정 관리, 권한 설정

### 매니저 (Manager)
- 대시보드, 랙 관리, 품목 코드, 히스토리, 분석 페이지 보기/편집
- 사용자 관리 페이지는 편집 불가

### 뷰어 (Viewer)
- 모든 페이지 보기 전용 접근
- 편집 기능 제한

## 📊 데이터 모델

주요 테이블:
- `categories`: 품목 카테고리
- `product_codes`: 품목 마스터 데이터
- `products`: 실제 재고 인스턴스
- `racks`: 창고 랙 정보
- `rack_products`: 랙-제품 관계
- `users`: 사용자 정보
- `activity_logs`: 시스템 활동 로그

## 🔧 개발 가이드

### 환경 설정
- Node.js 18.18.0 이상 권장
- npm 또는 yarn

### 코드 스타일
- TypeScript Strict Mode
- ESLint + Prettier
- Tailwind CSS 컨벤션

### 데이터베이스
- Supabase PostgreSQL
- Row Level Security (RLS) 적용
- 실시간 구독 지원

## 🚨 주요 고려사항

### 보안
- Row Level Security (RLS) 정책 적용
- 클라이언트 측 권한 검증
- API 키 보안 관리

### 성능
- 서버 사이드 렌더링 (SSR)
- 이미지 최적화
- 데이터 캐싱

### 확장성
- 컴포넌트 기반 아키텍처
- 타입 안전성
- 모듈화된 API 구조

## 🐛 알려진 이슈

- xlsx 라이브러리 보안 취약점 (업데이트 대기 중)
- Node.js 18.15.0 버전 호환성 (18.18.0 이상 권장)

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이센스

이 프로젝트는 MIT 라이센스를 따릅니다.

## 📞 지원

배포 또는 사용 중 문제가 발생하면:
- [Issues](https://github.com/dmek2z/real-warehouse/issues) 페이지에 문의
- [DEPLOYMENT.md](./DEPLOYMENT.md) 문서 참고
- [Supabase 문서](https://supabase.com/docs) 및 [Vercel 문서](https://vercel.com/docs) 참고

---

**TAD STORY** - 냉동 창고 관리의 새로운 기준 🧊 