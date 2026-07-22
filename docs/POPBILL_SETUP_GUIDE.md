# 팝빌 등록 및 자동 발행 가이드

이 앱은 팝빌 인증정보를 Vercel 서버에 한 번 설정하고, 사용 브라우저를 최초 한 번 연결한 뒤 견적 승인 시 전자세금계산서를 자동 발행하는 방식입니다.

## 1. 팝빌 연동 신청

1. 앱 운영자가 [팝빌 연동 신청](https://developers.popbill.com/customer-center/partner-request)을 진행합니다.
2. 발급받은 `LinkID`와 `SecretKey`는 서버에서만 사용합니다.
3. 발행할 사업자번호를 연동회원으로 등록합니다.
4. [테스트 인증서](https://developers.popbill.com/customer-center/requestcert)를 등록해 테스트 발행을 준비합니다.

팝빌 비밀키를 앱 화면, GitHub 저장소, 고객에게 보내는 문서에 넣으면 안 됩니다.

## 2. Vercel 환경변수 등록

Vercel 프로젝트의 Settings > Environment Variables에 아래 변수 한 개를 등록합니다. 값은 줄바꿈 없이 JSON 전체를 붙여넣습니다.

```text
이름: POPBILL_CONFIG
값: {"linkId":"팝빌에서_발급받은_LinkID","secretKey":"팝빌에서_발급받은_SecretKey","corpNum":"조회비용을_부담할_사업자번호10자리","isTest":true}
```

환경변수를 바꾼 뒤에는 Vercel에서 다시 배포해야 새 값이 적용됩니다.

기존의 `POPBILL_LINK_ID`, `POPBILL_SECRET_KEY`, `POPBILL_CORP_NUM`, `POPBILL_IS_TEST` 개별 변수도 계속 지원하지만 새 설치에서는 `POPBILL_CONFIG` 한 개만 사용하는 것을 권장합니다.

## 3. 브라우저 최초 1회 연결

1. 앱의 설정 > 팝빌 자동발행에서 사업자등록번호를 입력합니다.
2. `연결 시작`을 누릅니다.
3. 신규 연동회원이면 안내되는 사업장·담당자 정보를 확인하고 한 번만 가입합니다.
4. `팝빌 자동발행 연결이 정상입니다`가 나오면 완료입니다.

`SecretKey`는 고객이 입력하지 않으며 Vercel 서버에만 보관됩니다. 고객별 팝빌 비밀번호도 블링빌 데이터베이스에 저장하지 않습니다.

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
3. 승인 후 `POPBILL_CONFIG` 값의 `"isTest":true`를 `"isTest":false`로 바꿉니다.
4. 다시 배포하고 설정 화면에서 연결 상태가 `운영 환경`인지 확인합니다.
5. 소액 또는 내부 확인 가능한 거래로 최초 실발행을 검증합니다.

공식 참고 문서: [전자세금계산서 Node.js 발행 튜토리얼](https://developers.popbill.com/reference/taxinvoice/node/getting-started/tutorial), [공동인증서 안내](https://developers.popbill.com/guide/taxinvoice/introduction/certificate)
