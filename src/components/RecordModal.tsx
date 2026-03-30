import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RAIN_COLORS } from "../constants/rainColors";
import type { RainLyrics, RainRecord } from "../state/rainRecords";
import { useRainRecords } from "../state/rainRecords";

type RecordModalProps = {
  open: boolean;
  mode: "create" | "edit";
  dayIndex: number;
  record: RainRecord | null;
  onClose: () => void;
  onSave: (payload: {
    photoDataUrl: string | null;
    text: string;
    lyrics: RainLyrics;
    rainIntensityIndex: number;
  }) => void;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function computeRainIntensityIndex(text: string, photoDataUrl: string | null) {
  const t = text.trim();
  const len = t.length;
  const photoBoost = photoDataUrl ? 28 : 0;
  const score = (len * 3 + photoBoost) % 100; // 0..99
  // 更长的文字更容易落到“湿润”区间（索引 4..7）
  const wetBias = len > 12 ? 18 : 0;
  const adjusted = clamp(score + wetBias, 0, 99);
  const idx = Math.floor((adjusted / 100) * (RAIN_COLORS.length - 1));
  return clamp(idx, 0, RAIN_COLORS.length - 1);
}

function simulateLyrics(text: string) {
  const t = text.trim();
  const seed = t.length + (t ? t.charCodeAt(0) : 13);

  const zhOptions = [
    "雨还在下，像在替谁把心事悄悄说完。",
    "把今天的潮湿封进字里，让它慢慢回响。",
    "风经过窗沿，替你把不敢说的话写成歌。",
    "雨声当作节拍，思念就不再那么吵。",
  ];
  const enOptions = [
    "The rain keeps time for the words I never said.",
    "Today’s hush is pressed into the quiet between notes.",
    "Let the wet sky sing softly, line by line.",
    "A gentle beat—falling rain, steady and true.",
  ];
  const jaOptions = [
    "雨の音が、言葉にならない気持ちを連れてくる。",
    "今日のしめりを胸にしまって、ゆっくり響かせる。",
    "窓辺を通る風が、歌に変えてくれる。",
    "落ちる水のリズムで、想いは静かになる。",
  ];

  const zh = zhOptions[seed % zhOptions.length];
  const en = enOptions[seed % enOptions.length];
  const ja = jaOptions[seed % jaOptions.length];

  // 将用户输入短句“轻轻点入”，模拟 AI 将文字/照片转成歌词
  const hintZh = t ? `「${t.slice(0, 20)}${t.length > 20 ? "…" : ""}」` : "（无文字）";
  const hintEn = t ? `“${t.slice(0, 18)}${t.length > 18 ? "…" : ""}”` : "（no text）";
  const hintJa = t ? `「${t.slice(0, 18)}${t.length > 18 ? "…" : ""}」` : "（文章なし）";

  return {
    lyrics: {
      zh: `${hintZh}\n${zh}`,
      en: `${hintEn}\n${en}`,
      ja: `${hintJa}\n${ja}`,
    },
  };
}

export default function RecordModal({ open, mode, dayIndex, record, onClose, onSave }: RecordModalProps) {
  const { getDateISO } = useRainRecords();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(record?.photoDataUrl ?? null);
  const [text, setText] = useState(record?.text ?? "");
  const [lyrics, setLyrics] = useState<RainLyrics | null>(record?.lyrics ?? null);
  const [sealed, setSealed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhotoDataUrl(record?.photoDataUrl ?? null);
    setText(record?.text ?? "");
    setLyrics(record?.lyrics ?? null);
    setSealed(Boolean(record && record.photoDataUrl !== null) || Boolean(record && record.text.trim()));
    setLoading(false);
  }, [open, record]);

  const rainIntensityIndex = useMemo(() => computeRainIntensityIndex(text, photoDataUrl), [text, photoDataUrl]);
  const title = mode === "create" ? "封存今天的雨" : "查看/修改当天雨";
  const dateISO = record?.dateISO ?? getDateISO(dayIndex);

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onerror = () => reject(new Error("read failed"));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
    setPhotoDataUrl(dataUrl);
    // 新图片后，未封存状态下让歌词“先待定”
    setSealed(false);
  };

  const seal = async () => {
    if (loading) return;
    setLoading(true);
    setSealed(false);

    // 模拟 AI 加载
    await new Promise((r) => setTimeout(r, 900));
    const generated = simulateLyrics(text);

    setLyrics(generated.lyrics);
    onSave({
      photoDataUrl,
      text,
      lyrics: generated.lyrics,
      rainIntensityIndex,
    });

    setLoading(false);
    setSealed(true);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#F7F9F6]/40"
            onClick={onClose}
            aria-label="关闭画板"
          />

          <motion.div
            className="relative z-[2] w-full max-w-[440px] glass rounded-3xl shadow-xl border border-rain-border overflow-hidden"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-[12px] font-medium tracking-[0.22em] text-[#4A5D4E]">{title}</h2>
                  <p className="mt-2 text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
                    {mode === "create" ? "上传雨景，写下心情，然后封存。" : "你可以微调文字与照片后重新封存。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full glass glass-hover transition-all duration-500"
                  aria-label="关闭"
                >
                  <span className="text-[12px] text-[#4A5D4E] opacity-70">×</span>
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                  {dateISO}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-stone-400 font-light">Dry</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-rain-border"
                    style={{ backgroundColor: RAIN_COLORS[rainIntensityIndex] }}
                    aria-hidden="true"
                  />
                  <span className="text-[9px] text-stone-400 font-light">Wet</span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="glass rounded-2xl border border-rain-border bg-white/20 p-3">
                <div className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium mb-2">
                  Rain Photo
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative w-[92px] h-[92px] rounded-xl border border-rain-border overflow-hidden bg-white/10">
                    {photoDataUrl ? (
                      <img
                        src={photoDataUrl}
                        alt="Rain"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-[10px] text-stone-500/80">
                        选择照片
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full px-4 py-2 rounded-full glass glass-hover transition-all duration-500"
                    >
                      <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-70">
                        上传/选择图片
                      </span>
                    </button>
                    <p className="mt-2 text-[10px] text-stone-500/80 leading-relaxed font-light">
                      保存在本地，刷新不会丢失。
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium mb-2">
                  Mood / Lyrics note
                </label>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setSealed(false);
                  }}
                  rows={3}
                  maxLength={120}
                  placeholder="比如：雨声治愈，听着某首歌…"
                  className="w-full glass rounded-2xl px-4 py-3 text-[12px] tracking-wide text-stone-700 placeholder:text-stone-400/80 outline-none focus:bg-white/55 transition-all duration-500"
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                    AI Lyrics
                  </p>
                  <p className="text-[10px] text-stone-500/80 font-light">
                    Day {dayIndex + 1}
                  </p>
                </div>

                <div className="mt-2 glass rounded-2xl border border-rain-border bg-white/20 p-4 min-h-[118px]">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <motion.div
                        className="w-6 h-6 rounded-full border border-rain-border border-t-emerald-500/70"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <p className="text-[11px] text-stone-600/90 font-light tracking-wide">
                        AI 正在封存…
                      </p>
                    </div>
                  ) : lyrics ? (
                    <div className="whitespace-pre-line text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
                      <p>{lyrics.zh}</p>
                      <div className="h-2" />
                      <p>{lyrics.en}</p>
                      <div className="h-2" />
                      <p>{lyrics.ja}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-stone-600/90 font-light tracking-wide">
                      点击「封存」后展示多语言歌词。
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-full glass glass-hover transition-all duration-500"
                  disabled={loading}
                >
                  <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-60">
                    取消
                  </span>
                </button>

                <button
                  type="button"
                  onClick={seal}
                  disabled={loading}
                  className="group relative px-5 py-2 rounded-full glass glass-hover shadow-sm overflow-hidden disabled:opacity-60"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/20 to-teal-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <span className="relative text-[11px] font-medium tracking-[0.2em] text-[#4A5D4E]">
                    {sealed ? "重新封存" : "封存"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

