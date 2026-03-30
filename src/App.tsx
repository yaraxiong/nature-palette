import Header from "./components/Header";
import Hero from "./components/Hero";
import RainGrid from "./components/RainGrid";
import { AuthProvider } from "./state/auth";
import { RainRecordsProvider, useRainRecords } from "./state/rainRecords";
import { useAuth } from "./state/auth";
import RecordModal from "./components/RecordModal";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

function AppContent() {
  const { user, openLoginModal } = useAuth();
  const { records, upsertRecord } = useRainRecords();
  const todayIndex = 29;

  const [activeDayIndex, setActiveDayIndex] = useState<number | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"create" | "edit">("create");
  const [recordDayIndex, setRecordDayIndex] = useState(todayIndex);

  const [toast, setToast] = useState<string | null>(null);

  const record = useMemo(() => records[recordDayIndex] ?? null, [records, recordDayIndex]);

  const closeRecord = () => {
    setRecordOpen(false);
    setActiveDayIndex(null);
  };

  const openRecordForDay = (dayIndex: number) => {
    if (!user) {
      openLoginModal();
      return;
    }
    const existing = records[dayIndex];
    setActiveDayIndex(dayIndex);
    setRecordDayIndex(dayIndex);
    setRecordMode(existing ? "edit" : "create");
    setRecordOpen(true);
  };

  const openEmptyPrompt = (dayIndex: number) => {
    setActiveDayIndex(dayIndex);
    setToast("点击捕捉按钮来开启这一天的记录");
    window.setTimeout(() => setToast(null), 2200);
  };

  const onSaveRecord = (payload: {
    photoDataUrl: string | null;
    text: string;
    lyrics: { zh: string; en: string; ja: string };
    rainIntensityIndex: number;
  }) => {
    upsertRecord(recordDayIndex, payload);
  };

  return (
    <>
      <main className="min-h-screen selection:bg-emerald-100 selection:text-emerald-900">
        {/* Background subtle texture/gradient */}
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.15]" />
        <div className="fixed inset-0 -z-10 bg-gradient-to-b from-transparent via-emerald-50/5 to-transparent" />

        <Header />

        <div className="max-w-screen-sm mx-auto">
          <Hero
            onCaptureToday={() => {
              openRecordForDay(todayIndex);
            }}
          />
          <RainGrid
            activeDayIndex={activeDayIndex}
            onExistingRecordClick={(dayIndex) => openRecordForDay(dayIndex)}
            onEmptyRecordClick={(dayIndex) => openEmptyPrompt(dayIndex)}
          />
        </div>

        {/* Footer hint */}
        <footer className="fixed bottom-8 left-0 right-0 flex justify-center pointer-events-none">
          <p className="text-[10px] tracking-[0.3em] text-stone-400 uppercase font-light">
            Changsha • Spring Rain
          </p>
        </footer>
      </main>

      <RecordModal
        open={recordOpen}
        mode={recordMode}
        dayIndex={recordDayIndex}
        record={record}
        onClose={closeRecord}
        onSave={onSaveRecord}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed z-[250] left-1/2 top-[92px] -translate-x-1/2 px-4"
          >
            <div className="glass rounded-2xl border border-rain-border shadow-xl px-4 py-3">
              <p className="text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">{toast}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RainRecordsProvider>
        <AppContent />
      </RainRecordsProvider>
    </AuthProvider>
  );
}
