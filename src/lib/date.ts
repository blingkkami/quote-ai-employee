const pad = (value: number) => String(value).padStart(2, "0");

export const dateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const today = () => dateInputValue();
export const now = () => new Date().toISOString();

export const parseDate = (value: string) => {
  if (!value) return undefined;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const monthKey = (value: string | Date) => {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}` : "";
};

export const yearKey = (value: string | Date) => {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? String(date.getFullYear()) : "";
};

export const addDays = (value: string, days: number) => {
  const date = parseDate(value);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
};

export const daysSince = (value: string, reference = new Date()) => {
  const date = parseDate(value);
  if (!date) return 0;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const end = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate()).getTime();
  return Math.max(0, Math.floor((end - start) / 86400000));
};

export const koreanDate = (value: string) => {
  const date = parseDate(value);
  if (!date) return value || "";
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};
