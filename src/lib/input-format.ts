const digitsOnly = (value: string, maxLength: number) => value.replace(/\D/g, "").slice(0, maxLength);

export function formatBusinessNumber(value: string) {
  const digits = digitsOnly(value, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

export function formatPhoneNumber(value: string) {
  const trimmed = value.trim();
  const international = trimmed.startsWith("+");
  const digits = digitsOnly(value, international ? 15 : 12);

  if (!digits) return international ? "+" : "";
  if (international) return `+${digits}`;

  if (/^(15|16|18)\d/.test(digits)) {
    const serviceNumber = digits.slice(0, 8);
    return serviceNumber.length <= 4
      ? serviceNumber
      : `${serviceNumber.slice(0, 4)}-${serviceNumber.slice(4)}`;
  }

  if (digits.startsWith("02")) {
    const phone = digits.slice(0, 10);
    if (phone.length <= 2) return phone;
    if (phone.length <= 5) return `${phone.slice(0, 2)}-${phone.slice(2)}`;
    if (phone.length <= 9) return `${phone.slice(0, 2)}-${phone.slice(2, 5)}-${phone.slice(5)}`;
    return `${phone.slice(0, 2)}-${phone.slice(2, 6)}-${phone.slice(6)}`;
  }

  if (digits.startsWith("050") && digits.length > 3) {
    const phone = digits.slice(0, 12);
    if (phone.length <= 4) return phone;
    if (phone.length <= 8) return `${phone.slice(0, 4)}-${phone.slice(4)}`;
    return `${phone.slice(0, 4)}-${phone.slice(4, 8)}-${phone.slice(8)}`;
  }

  const phone = digits.slice(0, 11);
  if (phone.length <= 3) return phone;
  if (phone.length <= 7) return `${phone.slice(0, 3)}-${phone.slice(3)}`;
  if (phone.length <= 10) return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  return `${phone.slice(0, 3)}-${phone.slice(3, 7)}-${phone.slice(7)}`;
}
