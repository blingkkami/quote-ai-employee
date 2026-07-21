import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { AppData } from "../types";
import { defaultData } from "../data/seed";
import { hasAppContent, loadCloudData, saveCloudData } from "../lib/cloud-storage";
import { clearLegacyData, loadLegacyData, mergeAppData } from "../lib/storage";

export type SyncState = "idle" | "saving" | "saved" | "error";

type SaveJob = {
  userId: string;
  data: AppData;
};

export function useCloudAppData(userId?: string) {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [syncState, setSyncState] = useState<SyncState>("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();
  const [migrationData, setMigrationData] = useState<AppData | null>(null);
  const readyUserIdRef = useRef("");
  const activeUserIdRef = useRef("");
  const dataRef = useRef<AppData | null>(null);
  const pendingSaveRef = useRef<SaveJob | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const runSaveQueue = useCallback(async () => {
    if (savePromiseRef.current) return savePromiseRef.current;

    const run = async () => {
      while (pendingSaveRef.current) {
        const job = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (job.userId !== activeUserIdRef.current) continue;

        setSyncState("saving");
        setSyncError("");
        try {
          await saveCloudData(job.userId, job.data);
          if (job.userId === activeUserIdRef.current) {
            setLastSyncedAt(new Date().toISOString());
            setSyncState("saved");
          }
        } catch (error) {
          if (job.userId === activeUserIdRef.current) {
            pendingSaveRef.current = job;
            setSyncError(error instanceof Error ? error.message : String(error));
            setSyncState("error");
          }
          break;
        }
      }
    };

    savePromiseRef.current = run().finally(() => {
      savePromiseRef.current = null;
    });
    return savePromiseRef.current;
  }, []);

  const queueSave = useCallback((nextUserId: string, nextData: AppData) => {
    pendingSaveRef.current = { userId: nextUserId, data: nextData };
    void runSaveQueue();
  }, [runSaveQueue]);

  useEffect(() => {
    activeUserIdRef.current = userId ?? "";
    readyUserIdRef.current = "";
    pendingSaveRef.current = null;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setData(null);
    setMigrationData(null);
    setLoadError("");
    setSyncError("");
    setSyncState("idle");
    setLastSyncedAt(undefined);

    if (!userId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void loadCloudData(userId)
      .then((result) => {
        if (!active || activeUserIdRef.current !== userId) return;
        if (result.data) {
          setData(result.data);
          setLastSyncedAt(result.updatedAt);
          setSyncState("saved");
        } else {
          const legacy = loadLegacyData();
          setData(mergeAppData(defaultData));
          if (legacy && hasAppContent(legacy)) {
            setMigrationData(legacy);
          } else {
            queueSave(userId, mergeAppData(defaultData));
          }
        }
        readyUserIdRef.current = userId;
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [queueSave, userId]);

  useEffect(() => {
    if (!userId || !data || readyUserIdRef.current !== userId || migrationData) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSyncState((current) => current === "error" ? current : "saving");
    saveTimerRef.current = setTimeout(() => queueSave(userId, data), 700);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [data, migrationData, queueSave, userId]);

  const importLegacyData = useCallback(async () => {
    if (!userId || !migrationData) return;
    setSyncState("saving");
    await saveCloudData(userId, migrationData);
    setData(migrationData);
    setMigrationData(null);
    clearLegacyData();
    setLastSyncedAt(new Date().toISOString());
    setSyncState("saved");
  }, [migrationData, userId]);

  const startFresh = useCallback(async () => {
    if (!userId) return;
    const freshData = mergeAppData(defaultData);
    setSyncState("saving");
    await saveCloudData(userId, freshData);
    setData(freshData);
    setMigrationData(null);
    clearLegacyData();
    setLastSyncedAt(new Date().toISOString());
    setSyncState("saved");
  }, [userId]);

  const flush = useCallback(async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (userId && dataRef.current && readyUserIdRef.current === userId && !migrationData) {
      pendingSaveRef.current = { userId, data: dataRef.current };
    }
    await runSaveQueue();
  }, [migrationData, runSaveQueue, userId]);

  const persistNow = useCallback(async (nextData: AppData) => {
    if (!userId) throw new Error("로그인 후 저장할 수 있습니다.");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    dataRef.current = nextData;
    setData(nextData);
    pendingSaveRef.current = null;
    setSyncState("saving");
    setSyncError("");
    try {
      await saveCloudData(userId, nextData);
      setLastSyncedAt(new Date().toISOString());
      setSyncState("saved");
    } catch (error) {
      pendingSaveRef.current = { userId, data: nextData };
      setSyncError(error instanceof Error ? error.message : String(error));
      setSyncState("error");
      throw error;
    }
  }, [userId]);

  const retry = useCallback(() => {
    if (userId && dataRef.current) queueSave(userId, dataRef.current);
  }, [queueSave, userId]);

  return {
    data,
    setData: setData as Dispatch<SetStateAction<AppData>>,
    loading,
    loadError,
    syncError,
    syncState,
    lastSyncedAt,
    migrationData,
    importLegacyData,
    startFresh,
    flush,
    persistNow,
    retry
  };
}
