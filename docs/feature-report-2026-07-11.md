# 작업 보고서 — 2026-07-11

견적서 AI직원 앱에 "자동발행 심장" 두 개(세금계산서 실연동, AI 견적 초안)를 구현한 기록.
기존 UI·동작은 보존했고, 매 단계 `npx tsc --noEmit` 통과를 확인함.

---

## 1. 세금계산서 발행 실연동 (Popbill)

**이전 상태**: 승인 버튼이 상태만 `issued`로 바꾸고 가짜 발행번호를 붙이는 시뮬레이션. 서버 호출 없음.

**현재 상태**: 승인 버튼 → 실제 `POST /api/popbill/issue` 호출 → 응답에 따라 발행 상태(issued/failed) 기록.

- `api/popbill/issue.js` — popbill 공식 Node SDK(`popbill@1.64.2`)로 즉시발행(registIssue) 구현.
  환경변수 키가 없으면 **mock 모드**로 안전하게 동작 (응답에 `mode: "mock"` 표시, 발행번호 `PB-MOCK-...`).
- `src/lib/tax-invoice.ts` — 프론트 API 클라이언트 (절대 throw하지 않음).
- `src/App.tsx` `approveQuote` — 자동 발행 모드일 때 API 호출, 고객 사업자번호 없으면 failed 처리.
- `vite.config.ts` (신규) — 개발 서버에서 `/api/*` 경로가 동작하도록 미들웨어 추가. 배포(Vercel)에서는 API Route가 그대로 사용됨.

**실발행 전환 방법**: `.env`에 아래 7개 키를 채우면 mock → 실발행으로 자동 전환.

```
POPBILL_LINK_ID=        # 팝빌 연동신청 후 발급
POPBILL_SECRET_KEY=
POPBILL_CORP_NUM=       # 우리 사업자번호 (숫자만)
POPBILL_CORP_NAME=      # 상호
POPBILL_CEO_NAME=       # 대표자명
POPBILL_USER_ID=        # 팝빌 아이디
POPBILL_IS_TEST=true    # true=테스트베드(연습), false=실제 발행
```

- 팝빌 가입: https://www.popbill.com
- 팝빌 쪽 발행 수수료가 건당 별도로 있음 (연동 전까지는 무료 mock).
- `POPBILL_IS_TEST=true`(기본값)이면 실제 국세청 전송 없이 테스트베드에서 연습 가능.

## 2. AI 견적 초안 생성

**2026-07-12 사용자 요청으로 기능 전체 삭제됨.** 복구가 필요하면 git 기록(커밋 ee46206 이전)에서 되살릴 수 있음.

(과거 기록 요약) 의뢰 내용을 문장으로 넣으면 프로젝트명·작업 항목·금액·납품 정보·인사 메시지 초안을 생성하던 기능. 관련 파일 `api/ai/draft-quote.js`, `src/lib/ai-draft.ts`, `QuoteBuilder.tsx`의 "AI 견적 초안" 섹션과 `@anthropic-ai/sdk` 의존성, `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` 환경변수를 모두 제거함.

## 3. 기타

- `.env` — 키 보관 파일 (프로젝트 루트). **`.gitignore`에 등록되어 GitHub에 올라가지 않음.**
- `.env.example` — 필요한 키 목록 문서.
- `src/styles.css` — 좁은 화면에서 표가 세로로 깨지던 문제 수정 (`.table-wrap` 셀에 `white-space: nowrap`).

## 4. 비용 구조 요약

| 기능 | 비용 |
|---|---|
| 견적 작성·PDF·견적 목록·고객/매입처 관리·수금·대시보드 | **무료** (AI 아님, 브라우저에서만 동작) |
| AI 초안 생성 (현재 꺼짐) | 켜면 호출 1회당 몇십~몇백 원 (Anthropic 크레딧) |
| 세금계산서 실발행 (현재 mock) | 연동하면 팝빌 발행 수수료 건당 별도 |

## 5. 배포 관련 메모

- 기존 배포본: https://blingkkami-quote-generator.vercel.app/ — 이전 세대 간단 버전(aimax1 저장소 `feature/quote-pdf-generator` 브랜치), AI 없음, 무료.
- 이 앱(AI 직원)을 Vercel에 배포하면 `api/` 폴더가 서버리스 함수로 자동 동작.
  배포 시 환경변수(ANTHROPIC_API_KEY, POPBILL_*)는 Vercel 대시보드 → Settings → Environment Variables에 등록해야 함 (.env 파일은 배포에 포함되지 않음).
- 데이터는 브라우저 localStorage에만 저장됨 — 기기/브라우저를 바꾸면 데이터가 따라가지 않음. 여러 기기에서 쓰려면 추후 DB(예: Supabase) 연동 필요.
