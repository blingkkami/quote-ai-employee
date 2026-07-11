# 최적화 권장사항 메모 (미수행)

리팩토링 중 발견했으나 제1원칙(동작 보존)에 따라 수행하지 않은 항목. 이후 별도 작업으로 검토.

- `new Date().toISOString()` / `.slice(0, 10)` 인라인 호출이 App.tsx(updateQuote·approveQuote·recordPayment), CustomerManager, VendorManager 등에 반복됨. `lib/date.ts`의 `now()`/`today()`로 통합 가능.
- "자동 발행 / 수동 발행" 라벨 문자열이 QuoteBuilder·CustomerManager·IssueCenter 3곳에 반복. `constants.ts`에 라벨 맵으로 통합 가능.
- `quotes.find(...)`, `customers.find(...)` 조회 패턴이 여러 뷰에 반복. `Map` 기반 조회 헬퍼 또는 셀렉터로 통합 시 가독성·성능(대량 데이터 시) 개선.
- App.tsx의 뷰 라우팅이 조건부 렌더링 8줄 나열. 뷰 수가 늘면 `Record<View, ReactNode>` 매핑 고려.
- `loadData()`의 `{ ...defaultData, ...JSON.parse(raw) }`는 얕은 병합이라 저장 데이터에 없는 신규 필드가 중첩 객체에는 보충되지 않음. 스키마 마이그레이션 로직 도입 검토 (동작 변경이므로 미수행).
- Dashboard 매출 바 차트는 sales 전체를 렌더링. 데이터 증가 시 상위 N건 제한 고려.
