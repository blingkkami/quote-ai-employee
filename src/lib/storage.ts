import type { AppData } from "../types";
import { defaultData } from "../data/seed";
import { syncCustomerTotals } from "./finance";

export const STORAGE_KEY = "blingkkami-ai-quote-employee:v8";

export function loadData(): AppData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return defaultData;
  try {
    const data = { ...defaultData, ...JSON.parse(raw) } as AppData;
    return {
      ...data,
      customers: syncCustomerTotals(data.customers, data.sales, data.quotes)
    };
  } catch {
    return defaultData;
  }
}

export function saveData(data: AppData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
