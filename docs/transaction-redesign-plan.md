# 블링빌 거래 중심 개편 설계 (③ 내부 시스템 개편)

작성: 2026-07-24 · 상태: **설계안(승인 대기)** · 근거 문서: `blingbill-system-improvement-plan.md`(볼타 벤치마크)

---

## 1. 목표

문서(견적서·세금계산서·명세서)를 하나씩 다루는 지금 구조를, **하나의 거래를 중심으로 문서·수금·미수·발송 이력을 묶어 "지금 처리할 일"을 먼저 보여주는** 운영 도구로 확장한다. 기능을 늘리는 게 아니라 **이미 있는 데이터를 연결·판단**하는 것이 핵심.

## 2. 핵심 판단 — 데이터는 이미 연결돼 있다

현재 `AppData`(`src/types.ts`)는 사실상 이미 거래 단위로 연결돼 있다:

| 엔티티 | 역할 | 연결 키 |
|---|---|---|
| `QuoteRecord` | 문서·발행·발송 상태 보유 | `id`, `customerId` |
| `SaleRecord` | 청구·수금(부분수금 `payments[]`) | `quoteId`, `customerId` |
| `Customer` | 거래처, 누적/미수 파생값 | `id` |
| `PurchaseRecord` | 매입, 견적 연결 | `vendorId`, `relatedQuoteId` |

→ **"거래(Transaction)"는 새 테이블이 아니라, `Quote + Sale + Customer`를 묶어 계산한 파생 뷰모델**로 정의할 수 있다. 빠진 것은 (A) 상태 자동 계산 로직, (B) 거래 중심 화면뿐이다.

## 3. 접근 방식 — 2안 비교

| | 안 A: 계산 레이어 + UI (권장) | 안 B: 테이블 분리 마이그레이션 |
|---|---|---|
| 방식 | `app_data` JSON 유지, 파생 뷰모델·상태함수·신규 화면 추가 | 거래/문서/수금을 Supabase 테이블로 분리, RLS 재설계 |
| 위험 | 낮음 (기존 저장구조 불변, 순수함수 테스트) | 높음 (마이그레이션·RLS·동시성·롤백) |
| 기간 | 단계별 점진 | 큼 |
| 서버측 요금제 게이팅(①) | 불가(데이터가 본인 JSON 한 덩어리) — 클라이언트 게이팅 유지 | 가능(테이블별 RLS로 플랜 강제) |
| 확장성(대량 거래) | JSON 한계 있음(수천 건대) | 우수 |

**권장: 안 A를 먼저** 전량 구현해 사용자 가치를 빠르고 안전하게 확보하고, **안 B(테이블 분리 + 서버 게이팅)는 사용량이 실제로 커진 뒤** 별도 마이그레이션 트랙으로 분리한다. ①의 서버측 메뉴 게이팅은 안 B에 속하므로, 그때까지는 현행 클라이언트 게이팅(본인 데이터 한정, 매출 누수 수준)을 유지한다.

## 4. 거래 뷰모델 정의 (파생, 저장 안 함)

```
Transaction = {
  quote: QuoteRecord
  sale?: SaleRecord            // 승인 시 생성됨
  customer?: Customer
  // 아래는 계산값 (순수 함수)
  billed: number              // 청구액 = sale.amount ?? quoteTotal(quote)
  paid: number                // sale.paidAmount ?? 0
  outstanding: number         // billed - paid
  lastPaymentAt?: string      // sale.payments 마지막 날짜
  docStage: DocStage          // 문서 진행 상태
  paymentState: PaymentState  // 수금 상태
  ageState: AgeState          // 경과 상태
  commState: CommState        // 커뮤니케이션 상태
  daysElapsed: number         // 기준일로부터 경과일
}
```
`src/lib/transaction.ts`(신규)에 순수 함수로 구현하고 단위 테스트로 고정한다.

## 5. 상태 자동 계산 규칙 (기존 필드만 사용)

**문서 진행(docStage)** — `quote.status` + `invoiceStatus`/`cashReceiptStatus` + `documentEmailStatus`
- `작성중`: status=draft
- `발송완료`: documentEmailStatus=sent (또는 status=delivered)
- `승인완료`: status=approved 且 미발행
- `발행완료`: invoiceStatus∈{issued,sent} 또는 cashReceiptStatus=issued

**수금(paymentState)** — `sale.amount` vs `sale.paidAmount`
- `미수`: paid=0 · `부분수금`: 0<paid<billed · `수금완료`: paid≥billed

**경과(ageState)** — 기준일(발행일 `invoiceDate` ?? 승인일 `approvedAt`)로부터 경과일, 미수건에만 적용
- `예정`: <7일 · `확인 필요`: 7–14일 · `지연`: 14–30일 · `장기 미수`: >30일
- 임계값(7/14/30)은 상수로 두고 추후 설정화 가능

**커뮤니케이션(commState)** — `documentEmailStatus` + `customer.unpaidNoticeSentAt`
- `메일 발송`: 최근 발송 성공 · `재발송 필요`: 발송했지만 N일 경과·여전히 미수, 또는 발송 실패 · `확인 필요`: 발송 이력 없음

## 6. 신규·개편 화면 (볼타 우선순위 5선)

1. **거래 통합 상세** — 한 거래의 견적·발행 이력·수금 내역·미수 상태·메모·발송 로그를 한 화면(마스터-디테일). 기존 견적 상세를 확장.
2. **미수 관리 보드** — 거래처별 미수 합계, 경과일 라벨(7/14/30), 부분수금 분리, 재안내 추천. 기존 원장/미수 흐름을 실행형으로.
3. **거래처 CRM 상세** — 상단 요약카드(누적 거래·최근 발행·최근 입금·현재 미수·최근 연락). 기존 고객/매입처 상세 확장.
4. **실행형 대시보드** — "오늘 확인할 미수 N건 / 재발송 필요 N / 부분수금 N / 이번 주 만기·확인" 위젯. 기존 집계 대시보드 위에 실행 위젯 추가.
5. **발송·발행 로그** — 발송 일시·수신자·문서종류·성공/실패·재발송·발행 사유. 기존 각 상태 필드를 타임라인으로 집계.

## 7. 단계별 구현 순서 (각 단계: 독립 배포·테스트 가능)

- **P1. 계산 레이어** — `src/lib/transaction.ts` 뷰모델·상태함수 + 단위 테스트. UI 변화 없음. (안전, 기반)
- **P2. 실행형 대시보드 위젯** — 기존 대시보드 상단에 "지금 처리할 일" 위젯 추가. 가장 눈에 띄는 가치.
- **P3. 미수 관리 보드** — 경과 라벨·부분수금 분리·재안내 추천(기존 미수 안내 발송 재사용).
- **P4. 거래 통합 상세** — 견적 상세를 거래 타임라인·수금·로그 통합 화면으로.
- **P5. 거래처 CRM 요약카드** — 고객/매입처 상세 상단 카드.
- **P6. 발송·발행 로그 뷰** — 이력 타임라인 집계 화면.

각 단계 후: `npx tsc --noEmit` + `npx vitest run` 통과, 브라우저 확인, 커밋·배포.

## 8. 리스크·안전장치

- 저장 스키마(`app_data`) 불변 → 롤백은 코드 revert로 충분, 데이터 손상 없음.
- 모든 상태 규칙은 **순수 함수 + 테스트**로 고정해 회귀 방지.
- 요금제/과금 로직·발행 API는 건드리지 않음(별 트랙에서 이미 점검·수정 완료).
- 대량 거래(JSON 성능)·서버측 게이팅이 필요해지면 그때 안 B 마이그레이션을 별도 설계.

## 9. 비용 영향

없음. 계산·화면은 클라이언트에서 동작하며 추가 서버·외부 API 호출이 없다. (안 B로 갈 때만 Supabase 테이블·인덱스 비용 재검토)
