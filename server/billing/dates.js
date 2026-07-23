export function nextMonthlyChargeAt(value = new Date()) {
  const current = new Date(value);
  if (Number.isNaN(current.getTime())) throw new Error("결제 기준일이 올바르지 않습니다.");
  const year = current.getUTCFullYear();
  const nextMonthIndex = current.getUTCMonth() + 1;
  const lastDayOfNextMonth = new Date(Date.UTC(year, nextMonthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    year,
    nextMonthIndex,
    Math.min(current.getUTCDate(), lastDayOfNextMonth),
    current.getUTCHours(),
    current.getUTCMinutes(),
    current.getUTCSeconds(),
    current.getUTCMilliseconds()
  )).toISOString();
}
