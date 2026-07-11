export const today = () => new Date().toISOString().slice(0, 10);
export const now = () => new Date().toISOString();

export const koreanDate = (value: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
};
