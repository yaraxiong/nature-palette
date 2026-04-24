import Header from "./components/Header";
import Hero from "./components/Hero";
import RainGrid from "./components/RainGrid";
import { AuthProvider } from "./state/auth";
import { RainRecordsProvider, useRainRecords } from "./state/rainRecords";
import { useAuth } from "./state/auth";
import RecordModal from "./components/RecordModal";
import LoginModal from "./components/LoginModal";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toLocalISODate(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function AppContent() {
  const { user, login, loginModalOpen, openLoginModal, closeLoginModal } =
    useAuth();
  const { getRecordByDateISO, upsertRecordByDateISO } =
    useRainRecords();

  const todayISO = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return toLocalISODate(t);
  }, []);

  const [activeDateISO, setActiveDateISO] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [recordMode, setRecordMode] = useState<"create" | "edit">("create");
  const [recordDayIndexInView, setRecordDayIndexInView] = useState(29);
  const [recordDateISO, setRecordDateISO] = useState(todayISO);
  const [pendingOpen, setPendingOpen] = useState<{
    dateISO: string;
    dayIndexInView: number;
  } | null>(null);

  const [toast, setToast] = useState<string | null>(null);

  // 不使用 useMemo，确保在 localStorage 写入成功后能立刻刷新面板展示内容
  const record = recordDateISO ? getRecordByDateISO(recordDateISO) : null;

  const closeRecord = () => {
    setRecordOpen(false);
    setActiveDateISO(null);
  };

  const openRecordForDate = (dateISO: string, dayIndexInView: number) => {
    setActiveDateISO(dateISO);
    setRecordDayIndexInView(dayIndexInView);
    if (!user) {
      setPendingOpen({ dateISO, dayIndexInView });
      openLoginModal();
      return;
    }
    const existing = getRecordByDateISO(dateISO);
    setRecordDateISO(dateISO);
    setRecordMode(existing ? "edit" : "create");
    setRecordOpen(true);
  };

  const openEmptyPrompt = (dateISO: string, dayIndexInView: number) => {
    setActiveDateISO(dateISO);
    setRecordDayIndexInView(dayIndexInView);
    setToast("点击存档按钮来开启这一天的记录");
    window.setTimeout(() => setToast(null), 2200);
  };

  const onSaveRecord = (payload: {
    photoDataUrl: string | null;
    text: string;
    lyrics: { zh: string; en: string; ja: string };
    rainIntensityIndex: number;
    specificColorString: string;
  }) => {
    return upsertRecordByDateISO(recordDateISO, payload);
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
              openRecordForDate(todayISO, 29);
            }}
          />
          <RainGrid
            activeDateISO={activeDateISO}
            onExistingRecordClick={(dateISO, dayIndexInView) =>
              openRecordForDate(dateISO, dayIndexInView)
            }
            onEmptyRecordClick={(dateISO, dayIndexInView) =>
              openEmptyPrompt(dateISO, dayIndexInView)
            }
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
        dayIndex={recordDayIndexInView}
        dateISO={recordDateISO}
        record={record}
        onClose={closeRecord}
        onSave={onSaveRecord}
      />

      <LoginModal
        open={loginModalOpen}
        onClose={closeLoginModal}
        onLogin={(displayName) => {
          login(displayName);
          if (pendingOpen) {
            const { dateISO, dayIndexInView } = pendingOpen;
            setPendingOpen(null);
            openRecordForDate(dateISO, dayIndexInView);
          }
        }}
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
              <p className="text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
                {toast}
              </p>
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
