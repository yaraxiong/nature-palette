import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type RainLyrics = {
  zh: string;
  en: string;
  ja: string;
};

export type RainRecord = {
  dayIndex: number; // 0..29
  dateISO: string; // yyyy-mm-dd (本地日期）
  photoDataUrl: string | null;
  text: string;
  lyrics: RainLyrics;
  rainIntensityIndex: number; // 0..COLORS.length-1 (在 UI 中映射)
  updatedAt: number;
};

const RECORDS_KEY = "rainyVibe:rainRecords:v1";
const START_KEY = "rainyVibe:rainDaysStartISO:v1";

type RainRecordsContextValue = {
  records: Array<RainRecord | null>;
  todayIndex: number; // 固定为 29（最后一天）
  getDateISO: (dayIndex: number) => string;
  getRecord: (dayIndex: number) => RainRecord | null;
  upsertRecord: (dayIndex: number, record: Omit<RainRecord, "dayIndex" | "dateISO" | "updatedAt">) => void;
};

const RainRecordsContext = createContext<RainRecordsContextValue | null>(null);

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(d: Date, delta: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + delta);
  return next;
}

function parseStartISO(raw: string | null) {
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const d = new Date(y, mo, da);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function initStartDate() {
  const start = parseStartISO(localStorage.getItem(START_KEY));
  if (start) return start;
  const today = new Date();
  // 30 天区间：start = today - 29
  const computed = addDays(today, -29);
  localStorage.setItem(START_KEY, toLocalISODate(computed));
  return computed;
}

function loadRecords(): Array<RainRecord | null> {
  const raw = localStorage.getItem(RECORDS_KEY);
  if (!raw) return Array.from({ length: 30 }, () => null);
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 30) return Array.from({ length: 30 }, () => null);
    return parsed.map((item, idx) => {
      if (item === null) return null;
      if (!item || typeof item !== "object") return null;
      const r = item as Partial<RainRecord>;
      if (typeof r.dayIndex !== "number") return null;
      if (typeof r.dateISO !== "string") return null;
      if (typeof r.text !== "string") return null;
      if (!r.lyrics || typeof r.lyrics !== "object") return null;
      const lyrics = r.lyrics as Partial<RainLyrics>;
      if (typeof lyrics.zh !== "string" || typeof lyrics.en !== "string" || typeof lyrics.ja !== "string") return null;
      if (typeof r.photoDataUrl !== "string" && r.photoDataUrl !== null) return null;
      if (typeof r.rainIntensityIndex !== "number") return null;
      if (typeof r.updatedAt !== "number") return null;
      const dayIndex = idx; // 强制以当前数组索引为准
      return { ...r, dayIndex, dateISO: r.dateISO } as RainRecord;
    });
  } catch {
    return Array.from({ length: 30 }, () => null);
  }
}

export function RainRecordsProvider({ children }: { children: React.ReactNode }) {
  const [records, setRecords] = useState<Array<RainRecord | null>>(() => loadRecords());
  const todayIndex = 29;

  useEffect(() => {
    // 确保数组长度稳定（防止手动改 localStorage 后崩溃）
    if (records.length !== 30) setRecords(Array.from({ length: 30 }, () => null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getRecord = useCallback(
    (dayIndex: number) => {
      if (dayIndex < 0 || dayIndex > 29) return null;
      return records[dayIndex] ?? null;
    },
    [records]
  );

  const getDateISO = useCallback((dayIndex: number) => {
    const start = initStartDate();
    const safeIndex = Math.max(0, Math.min(29, dayIndex));
    return toLocalISODate(addDays(start, safeIndex));
  }, []);

  const upsertRecord = useCallback(
    (dayIndex: number, record: Omit<RainRecord, "dayIndex" | "dateISO" | "updatedAt">) => {
      if (dayIndex < 0 || dayIndex > 29) return;
      const start = initStartDate();
      const dateISO = toLocalISODate(addDays(start, dayIndex));
      const nextRecord: RainRecord = {
        dayIndex,
        dateISO,
        photoDataUrl: record.photoDataUrl ?? null,
        text: record.text,
        lyrics: record.lyrics,
        rainIntensityIndex: record.rainIntensityIndex,
        updatedAt: Date.now(),
      };

      setRecords((prev) => {
        const copy = prev.slice();
        copy[dayIndex] = nextRecord;
        localStorage.setItem(RECORDS_KEY, JSON.stringify(copy));
        return copy;
      });
    },
    []
  );

  const value = useMemo<RainRecordsContextValue>(() => ({ records, todayIndex, getDateISO, getRecord, upsertRecord }), [
    records,
    todayIndex,
    getDateISO,
    getRecord,
    upsertRecord,
  ]);

  return <RainRecordsContext.Provider value={value}>{children}</RainRecordsContext.Provider>;
}

export function useRainRecords(): RainRecordsContextValue {
  const ctx = useContext(RainRecordsContext);
  if (!ctx) throw new Error("useRainRecords must be used within RainRecordsProvider");
  return ctx;
}

