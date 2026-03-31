import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type RainLyrics = {
  zh: string;
  en: string;
  ja: string;
};

export type RainRecord = {
  // 以本地日期（yyyy-mm-dd）作为唯一键，支持“时间漫游”
  dateISO: string;
  photoDataUrl: string | null;
  text: string;
  lyrics: RainLyrics;
  rainIntensityIndex: number; // 保留以兼容旧版数据
  specificColorString: string; // 精准计算的 RGB 颜色字符串："rgb(r, g, b)"
  updatedAt: number;
};

type RainRecordsContextValue = {
  records: RainRecord[];
  getRecordByDateISO: (dateISO: string) => RainRecord | null;
  upsertRecordByDateISO: (
    dateISO: string,
    record: Omit<RainRecord, "dateISO" | "updatedAt">,
  ) => boolean;
};

const RainRecordsContext = createContext<RainRecordsContextValue | null>(null);

const RECORDS_KEY = "rainyVibe:rainRecords:v1";

function isRecordLike(x: any): x is RainRecord {
  return (
    x &&
    typeof x === "object" &&
    typeof x.dateISO === "string" &&
    typeof x.text === "string" &&
    x.lyrics &&
    typeof x.lyrics.zh === "string" &&
    typeof x.lyrics.en === "string" &&
    typeof x.lyrics.ja === "string" &&
    (typeof x.photoDataUrl === "string" || x.photoDataUrl === null) &&
    typeof x.rainIntensityIndex === "number" &&
    typeof x.specificColorString === "string" &&
    typeof x.updatedAt === "number"
  );
}

function loadRecords(): RainRecord[] {
  const raw = localStorage.getItem(RECORDS_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    // 兼容旧版本：旧结构是长度 30 的数组（可能包含 null），并含 dayIndex 字段。
    const candidates: any[] = parsed.filter(Boolean);
    const result: RainRecord[] = [];
    for (const c of candidates) {
      if (isRecordLike(c)) result.push(c);
    }

    // 去重：保留 updatedAt 更晚的记录
    const byDate = new Map<string, RainRecord>();
    for (const r of result) {
      const prev = byDate.get(r.dateISO);
      if (!prev || r.updatedAt > prev.updatedAt) byDate.set(r.dateISO, r);
    }
    return Array.from(byDate.values());
  } catch {
    return [];
  }
}

export function RainRecordsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [records, setRecords] = useState<RainRecord[]>(() => loadRecords());
  const recordsRef = useRef<RainRecord[]>(records);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  const getRecordByDateISO = useCallback(
    (dateISO: string) =>
      recordsRef.current.find((r) => r.dateISO === dateISO) ?? null,
    [],
  );

  const upsertRecordByDateISO = useCallback(
    (dateISO: string, record: Omit<RainRecord, "dateISO" | "updatedAt">) => {
      const nextRecord: RainRecord = {
        dateISO,
        photoDataUrl: record.photoDataUrl ?? null,
        text: record.text,
        lyrics: record.lyrics,
        rainIntensityIndex: record.rainIntensityIndex,
        specificColorString: record.specificColorString,
        updatedAt: Date.now(),
      };

      const prev = recordsRef.current;
      const idx = prev.findIndex((r) => r.dateISO === dateISO);
      const next =
        idx >= 0
          ? prev.map((r, i) => (i === idx ? nextRecord : r))
          : [...prev, nextRecord];

      try {
        localStorage.setItem(RECORDS_KEY, JSON.stringify(next));
        recordsRef.current = next;
        setRecords(next);
        return true;
      } catch (err: any) {
        // 防爆：避免 QuotaExceededError 导致白屏
        if (err?.name === "QuotaExceededError") {
          alert("图片依然过大，请尝试截取部分");
        } else {
          alert("保存失败，请稍后重试");
        }
        return false;
      }
    },
    [],
  );

  const value = useMemo<RainRecordsContextValue>(
    () => ({ records, getRecordByDateISO, upsertRecordByDateISO }),
    [records, getRecordByDateISO, upsertRecordByDateISO],
  );

  return (
    <RainRecordsContext.Provider value={value}>
      {children}
    </RainRecordsContext.Provider>
  );
}

export function useRainRecords(): RainRecordsContextValue {
  const ctx = useContext(RainRecordsContext);
  if (!ctx)
    throw new Error("useRainRecords must be used within RainRecordsProvider");
  return ctx;
}
