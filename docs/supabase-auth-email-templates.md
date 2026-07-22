# 블링빌 Supabase 인증 메일 템플릿

Supabase Dashboard의 `Authentication > Emails > Templates`에서 아래 제목과 본문을 등록합니다.

## 회원가입 인증

### 제목

```text
[블링빌] 이메일 인증을 완료해 주세요
```

### 본문

```html
<div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,'Noto Sans KR',sans-serif;color:#172033;">
  <div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #dce3ec;border-radius:8px;">
    <div style="display:inline-block;padding:10px 12px;border-radius:7px;background:#5876b5;color:#ffffff;font-weight:700;">BB</div>
    <h1 style="margin:24px 0 10px;font-size:24px;line-height:1.4;">블링빌 이메일 인증</h1>
    <p style="margin:0 0 8px;line-height:1.7;">블링빌 회원가입을 계속하려면 아래 버튼을 눌러 이메일 주소를 인증해 주세요.</p>
    <p style="margin:0 0 24px;color:#65758a;line-height:1.6;">본인이 요청하지 않았다면 이 메일을 무시하셔도 됩니다.</p>
    <a href="{{ .ConfirmationURL }}" style="display:block;padding:14px 18px;border-radius:7px;background:#315f9d;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;">이메일 인증하기</a>
    <p style="margin:24px 0 0;color:#7a8799;font-size:12px;line-height:1.6;">버튼이 열리지 않으면 아래 주소를 브라우저에 붙여 넣어 주세요.<br><span style="word-break:break-all;">{{ .ConfirmationURL }}</span></p>
  </div>
</div>
```

## 비밀번호 재설정

### 제목

```text
[블링빌] 비밀번호를 다시 설정해 주세요
```

### 본문

```html
<div style="margin:0;padding:32px 16px;background:#f4f7fb;font-family:Arial,'Noto Sans KR',sans-serif;color:#172033;">
  <div style="max-width:520px;margin:0 auto;padding:32px;background:#ffffff;border:1px solid #dce3ec;border-radius:8px;">
    <div style="display:inline-block;padding:10px 12px;border-radius:7px;background:#5876b5;color:#ffffff;font-weight:700;">BB</div>
    <h1 style="margin:24px 0 10px;font-size:24px;line-height:1.4;">비밀번호 재설정</h1>
    <p style="margin:0 0 24px;line-height:1.7;">아래 버튼을 눌러 블링빌 비밀번호를 새로 설정해 주세요.</p>
    <a href="{{ .ConfirmationURL }}" style="display:block;padding:14px 18px;border-radius:7px;background:#315f9d;color:#ffffff;text-align:center;text-decoration:none;font-weight:700;">비밀번호 다시 설정하기</a>
    <p style="margin:24px 0 0;color:#7a8799;font-size:12px;line-height:1.6;">본인이 요청하지 않았다면 비밀번호는 변경되지 않습니다.</p>
  </div>
</div>
```

## URL 설정

- Site URL: `https://quote.blingkkami.com`
- Redirect URL: `https://quote.blingkkami.com/**`
