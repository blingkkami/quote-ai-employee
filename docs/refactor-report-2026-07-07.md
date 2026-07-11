# 리팩토링 결과 보고 (2026-07-07)

역할 분담: 기획·판단·검증 = Fable 5, 코딩 실행 = Opus 서브에이전트 (CLAUDE.md에 전역규칙으로 명시).

## 1. 변경 요약

### 분할·이동
- `src/main.tsx` (913줄) → 진입점 10줄 + `App.tsx`(셸·라우팅) + `views/` 9개 + `components/` 6개 + `constants.ts`로 분할
- `src/storage.ts` (172줄) → `lib/date.ts`, `lib/id.ts`, `lib/format.ts`, `lib/quote-calc.ts`, `lib/storage.ts`, `data/quote-defaults.ts`, `data/seed.ts`로 관심사 분리 후 삭제

### 중복 통합 (동작 동일)
- VendorManager: 인라인 setData 업데이터 3개 → `patchVendor(id, patch)` (기존과 동일하게 updatedAt 미갱신)
- QuoteBuilder: 항목 필드 인라인 핸들러 3개 → `updateItem(id, patch)`
- CustomerManager: tone 계산식 2곳 중복 → `toneFor(customer)`

### 미변경
- `src/types.ts`, `src/styles.css`, `index.html`, `api/` — 바이트 단위 동일 확인
- localStorage 키 `blingkkami-ai-quote-employee:v7` 유지 (기존 데이터 호환)

## 2. 구조 Before / After

### Before
```
src/
  main.tsx      (913줄: 전부 혼재)
  storage.ts    (172줄: 유틸+시드+저장 혼재)
  types.ts
  styles.css
```

### After
```
src/
  main.tsx           진입점만 (10줄)
  App.tsx            고정 셸: 사이드바·탑바·라우팅·데이터 오케스트레이션
  constants.ts       nav, 상태·발행 라벨
  types.ts           도메인 타입 (변경 없음)
  views/             ← 자주 수정하는 화면 (여기부터 보세요)
    QuoteBuilder.tsx  QuotePreview.tsx  QuoteList.tsx
    IssueCenter.tsx   CustomerManager.tsx  VendorManager.tsx
    Ledger.tsx        ItemInsights.tsx  Dashboard.tsx
  components/        고정 공통 UI
    SectionTitle / Input / TextArea / Editable / Status / DataTable
  lib/               순수 로직
    date.ts  id.ts  format.ts  quote-calc.ts  storage.ts
  data/              시드·기본값
    quote-defaults.ts  seed.ts
  styles.css         (변경 없음)
api/popbill/         (변경 없음 — Vercel 규약 유지)
```

## 3. 검증

- 단계별 `npx tsc --noEmit`: 기준선·Step A·B·C 모두 통과 (최종 EXIT 0)
- 정규화 diff(원본 vs 신규 전체 코드): 차이는 의도된 3건의 헬퍼 통합과 import 재배치뿐 — 로직·JSX·className·문자열 전부 동일
- CSV BOM: 이동 과정에서 원시 U+FEFF 문자로 저장된 것을 원본과 같은 `﻿` 이스케이프로 복원 (검증 단계에서 1글자 직접 수정, 런타임 동작 양쪽 동일)
- 원본 백업: 세션 outputs의 `backup-before-refactor/`

## 4. 최적화 권장사항 (미수행)

`docs/optimization-notes.md` 참조 (6건 축적).

## 5. 동작 보존 불확실로 보류한 지점

없음. 모든 변경이 코드 이동 또는 동치 변환임을 diff로 확인함.

참고: 프로젝트에 `.git` 폴더는 있으나 유효한 저장소가 아님(커밋 이력 조회 불가). 버전 관리를 원하면 `git init` 후 커밋 권장.
