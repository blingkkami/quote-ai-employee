export const money = (value: number) => new Intl.NumberFormat("ko-KR").format(Math.round(value || 0));
