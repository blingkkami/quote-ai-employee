# 전역 규칙 (CLAUDE.md)

## 모델 역할 분담 (필수)

- **기획·판단·검증**: Claude Fable 5 (메인 세션)가 직접 수행한다.
  - 구조 설계, 규칙 정의, 변경 범위 판단, 결과 검증·리뷰, 보고서 작성
- **코딩·실제 실행**: Opus 서브에이전트(Agent tool, `model: "opus"`)에 위임한다.
  - 파일 생성·수정, 코드 이동, tsc 실행 등 실작업
- 서브에이전트에게는 Fable 5가 확정한 계획을 정확한 지시로 전달하고, 결과물은 반드시 Fable 5가 검증한다.

## 제1원칙 (최우선, 위반 불가)

**기존 동작과 UI 디자인의 완전한 보존.**

- 모든 변경은 외부에서 관찰 가능한 동작·렌더링 결과가 변경 전과 동일해야 한다.
- 동작 변경이 불가피한 지점은 수정하지 말고 보고서에 기록만 한다.
- 확신이 없는 변경은 수행하지 않는다 (보수적 접근).

## 검증 규칙

- 허용: `npx tsc --noEmit` 타입체크 (변경 검증 수단으로 적극 활용)
- 금지: 빌드 실행(`npm run build`), Playwright 등 실행 기반 검증
- 대규모 변경은 단계별로 분할하고, 각 단계마다 tsc 통과 확인 후 진행한다.
- 성능 최적화 작업은 수행하지 않는다. 발견한 권장사항은 `docs/optimization-notes.md`에 메모만 축적한다.

## 프로젝트 구조 규칙

- `src/main.tsx` — 진입점(createRoot)만 담당
- `src/App.tsx` — 앱 셸(사이드바·탑바·뷰 라우팅). 고정 UI, 수정 빈도 낮음
- `src/views/` — 화면 단위 컴포넌트 (수정 빈도 높음, 파일명 = 컴포넌트명 PascalCase)
- `src/components/` — 공통 재사용 UI (Input, DataTable 등)
- `src/lib/` — 순수 로직·유틸 (계산, 포맷, 저장)
- `src/data/` — 시드·초기 데이터
- `src/constants.ts` — 라벨·네비게이션 등 상수
- `src/types.ts` — 도메인 타입 단일 소스
- `api/` — 서버리스 API 라우트 (`api/<서비스>/<동작>.js`)

## 네이밍 규칙

- 컴포넌트 파일: PascalCase (`QuoteBuilder.tsx`)
- 로직·유틸 파일: kebab-case (`quote-calc.ts`)
- View 식별자·API 경로: 기존 값 유지 (동작 보존)
