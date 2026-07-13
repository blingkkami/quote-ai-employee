# 팝빌 등록 및 자동 발행 가이드

이 앱은 팝빌 인증정보를 Vercel 서버에 한 번 설정하고, 사용 브라우저를 최초 한 번 연결한 뒤 견적 승인 시 전자세금계산서를 자동 발행하는 방식입니다.

## 1. 팝빌 연동 신청

1. 앱 운영자가 [팝빌 연동 신청](https://developers.popbill.com/customer-center/partner-request)을 진행합니다.
2. 발급받은 `LinkID`와 `SecretKey`는 서버에서만 사용합니다.
3. 발행할 사업자번호를 연동회원으로 등록합니다.
4. [테스트 인증서](https://developers.popbill.com/customer-center/requestcert)를 등록해 테스트 발행을 준비합니다.

팝빌 비밀키를 앱 화면, GitHub 저장소, 고객에게 보내는 문서에 넣으면 안 됩니다.

## 2. Vercel 환경변수 등록

Vercel 프로젝트의 Settings > Environment Variables에 다음 값을 등록합니다.

```text
POPBILL_LINK_ID=팝빌에서_발급받은_LinkID
POPBILL_SECRET_KEY=팝빌에서_발급받은_SecretKey
POPBILL_CORP_NUM=사업자등록번호_숫자10자리
POPBILL_CORP_NAME=공급자_상호
POPBILL_CEO_NAME=대표자명
POPBILL_USER_ID=팝빌_회원아이디
POPBILL_IS_TEST=true
POPBILL_ACCESS_TOKEN=48자리_이상의_임의_보안키
```

환경변수를 바꾼 뒤에는 Vercel에서 다시 배포해야 새 값이 적용됩니다.

## 3. 브라우저 최초 1회 연결

1. 앱의 설정 > 세금계산서 연동 > 연동 설정을 엽니다.
2. `POPBILL_ACCESS_TOKEN`에 등록한 발행 보안키를 입력합니다.
3. `연결하고 상태 확인`을 누릅니다.
4. `팝빌 서버 연결과 연동회원 상태를 확인했습니다`가 나오면 완료입니다.

연결에 성공하면 원래 보안키는 저장하지 않고 서버가 서명한 `HttpOnly` 보안 쿠키만 남깁니다. 같은 브라우저에서는 다시 입력할 필요가 없습니다. 보안키 변경, 쿠키 삭제, 브라우저 데이터 초기화, 직접 연결 해제 시에만 다시 연결합니다.

## 4. 테스트 발행

1. 고객 관리에서 고객 상호, 사업자등록번호, 대표자 정보를 입력합니다.
2. 견적 작성에서 발행 방식을 `자동 발행`으로 선택합니다.
3. `세금계산서 발행`을 선택한 상태로 견적을 저장합니다.
4. `승인·발행`을 누릅니다.
5. 발행센터에서 발행 상태를 확인합니다.

`발행 대기` 또는 `발행 실패`인 건은 발행센터에서 원인을 확인한 뒤 다시 시도합니다. 이미 대기 중인 과거 견적은 새 연결만으로 자동 발행되지 않습니다.

## 5. 운영 발행 전환

1. 테스트 발행을 확인합니다.
2. [팝빌 운영 전환](https://developers.popbill.com/customer-center/serviceopen)을 신청합니다.
3. 승인 후 Vercel의 `POPBILL_IS_TEST`를 `false`로 바꿉니다.
4. 다시 배포하고 설정 화면에서 연결 상태가 `운영 환경`인지 확인합니다.
5. 소액 또는 내부 확인 가능한 거래로 최초 실발행을 검증합니다.

공식 참고 문서: [전자세금계산서 Node.js 발행 튜토리얼](https://developers.popbill.com/reference/taxinvoice/node/getting-started/tutorial), [공동인증서 안내](https://developers.popbill.com/guide/taxinvoice/introduction/certificate)
