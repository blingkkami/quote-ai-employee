import type { AppData } from "../types";
import { today } from "./date";
import { mergeAppData } from "./storage";

const BACKUP_APP = "blingbill";
const BACKUP_VERSION = 1;

export const backupFileName = () => `블링빌_백업_${today()}.json`;

export function exportBackup(data: AppData): void {
  const payload = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = backupFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

function isArrayField(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function parseBackup(text: string): AppData {
  const parsed = JSON.parse(text) as unknown;
  const envelope = parsed as { app?: unknown; data?: unknown };
  const candidate = (envelope && typeof envelope === "object" && "data" in envelope
    ? envelope.data
    : parsed) as Partial<AppData> | null;

  if (!candidate || typeof candidate !== "object") {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }

  const record = candidate as Record<string, unknown>;
  const requiredArrays = ["quotes", "customers", "vendors", "sales", "purchases"] as const;
  if (!requiredArrays.every((key) => isArrayField(record[key]))) {
    throw new Error("백업 파일 형식이 올바르지 않습니다.");
  }

  return mergeAppData(candidate);
}
