import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { RAIN_COLORS } from "../constants/rainColors";
import type { RainLyrics, RainRecord } from "../state/rainRecords";

type RecordModalProps = {
  open: boolean;
  mode: "create" | "edit";
  dayIndex: number; // 当前窗口内的索引（0..29），用于 UI 展示 Day 计数
  dateISO: string;
  record: RainRecord | null;
  onClose: () => void;
  onSave: (payload: {
    photoDataUrl: string | null;
    text: string;
    lyrics: RainLyrics;
    rainIntensityIndex: number;
  }) => boolean;
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

function formatLyricsForTextarea(lyrics: RainLyrics) {
  return `${lyrics.zh}\n---\n${lyrics.en}\n---\n${lyrics.ja}`;
}

function parseLyricsFromTextarea(raw: string): RainLyrics {
  const parts = raw.split(/\n---\n/);
  const zh = parts[0] ?? "";
  const en = parts[1] ?? "";
  const ja = parts.slice(2).join("\n---\n");
  return { zh, en, ja };
}

async function compressImageToJpegDataUrl(file: File, maxWidth = 800, quality = 0.6): Promise<string> {
  // 以 JPEG 输出，显著减少 Base64 体积，避免本地存储爆仓白屏
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("image load failed"));
      img.src = objectUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h) throw new Error("invalid image dimensions");

    const scale = w > maxWidth ? maxWidth / w : 1;
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas ctx");

    ctx.drawImage(img, 0, 0, targetW, targetH);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function readFileAsDataUrl(file: File): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export default function RecordModal({ open, mode, dayIndex, dateISO, record, onClose, onSave }: RecordModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(record?.photoDataUrl ?? null);
  const [text, setText] = useState(record?.text ?? "");
  const [lyrics, setLyrics] = useState<RainLyrics | null>(record?.lyrics ?? null);
  const [loading, setLoading] = useState(false);

  // 防止“图片/文字变化后 AI lyrics 仍然以旧结果为准”
  const [lyricsDirty, setLyricsDirty] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhotoDataUrl(record?.photoDataUrl ?? null);
    setText(record?.text ?? "");
    setLyrics(record?.lyrics ?? null);
    setLoading(false);
    setLyricsDirty(false);
  }, [open, record]);

  const rainIntensityIndex = useMemo(() => computeRainIntensityIndex(text, photoDataUrl), [text, photoDataUrl]);
  const title = mode === "create" ? "封存今天的雨" : "查看/修改当天雨";

  const [lyricsText, setLyricsText] = useState("");

  useEffect(() => {
    if (!open) return;
    setLyricsText(lyrics ? formatLyricsForTextarea(lyrics) : "");
  }, [open, lyrics]);

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;

    try {
      setLoading(true);
      // 先压缩，成功则用于保存
      const compressed = await compressImageToJpegDataUrl(file, 800, 0.6);
      setPhotoDataUrl(compressed);
    } catch {
      // 如果压缩失败，回退原始 dataURL（仍由 provider 的 try/catch 做防爆）
      const raw = await readFileAsDataUrl(file);
      setPhotoDataUrl(raw);
    } finally {
      setLyricsDirty(false);
      setLoading(false);
    }
  };

  const seal = async () => {
    if (loading) return;
    setLoading(true);

    // 模拟 AI 加载
    await new Promise((r) => setTimeout(r, 900));

    // 如果用户直接编辑了 AI lyrics，则不再重新生成；否则按当前文字生成
    const nextLyrics = lyricsDirty ? (lyrics ?? simulateLyrics(text).lyrics) : simulateLyrics(text).lyrics;
    setLyrics(nextLyrics);

    const success = onSave({
      photoDataUrl,
      text,
      lyrics: nextLyrics,
      rainIntensityIndex,
    });

    setLoading(false);
    // 保存成功后，标记为“已与当前内容一致”
    if (success) setLyricsDirty(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[220] flex items-center justify-center p-4 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          {/* 遮罩层：点击遮罩关闭，面板内部点击不冒泡 */}
          <button
            type="button"
            className="absolute inset-0 bg-[#F7F9F6]/40 z-[1]"
            onClick={onClose}
            aria-label="关闭画板"
          />

          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="relative z-[2] w-full max-w-[440px] glass rounded-3xl shadow-xl border border-rain-border overflow-hidden pointer-events-auto"
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
                    {mode === "create" ? "上传雨景，写下心情，然后封存。" : "你可以微调文字与 AI 歌词后重新封存。"}
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
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">{dateISO}</p>
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
              <div className="glass rounded-2xl border border-rain-border bg-white/20 overflow-hidden">
                <div className="relative h-[168px] bg-white/10">
                  {photoDataUrl ? (
                    <img src={photoDataUrl} alt="Rain" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <p className="text-[11px] text-stone-600/80 font-light tracking-wide">选择一张雨景照片</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/30" />
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">Rain Photo</p>
                    <p className="text-[10px] text-stone-500/70 font-light">本地保存</p>
                  </div>

                  <div className="mt-3">
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
                      disabled={loading}
                    >
                      <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-70">
                        上传/更换图片
                      </span>
                    </button>
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
                    setLyricsDirty(false);
                  }}
                  rows={3}
                  maxLength={120}
                  placeholder="比如：雨声治愈，听着某首歌…"
                  className="w-full glass rounded-2xl px-4 py-3 text-[12px] tracking-wide text-stone-700 placeholder:text-stone-400/80 outline-none focus:bg-white/55 transition-all duration-500 pointer-events-auto"
                  disabled={loading}
                />
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">AI Lyrics</p>
                  <p className="text-[10px] text-stone-500/80 font-light">Day {dayIndex + 1}</p>
                </div>

                <div className="mt-2 glass rounded-2xl border border-rain-border bg-white/20 p-4 min-h-[118px] pointer-events-auto">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <motion.div
                        className="w-6 h-6 rounded-full border border-rain-border border-t-emerald-500/70"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                      <p className="text-[11px] text-stone-600/90 font-light tracking-wide">AI 正在封存…</p>
                    </div>
                  ) : (
                    <textarea
                      value={lyricsText}
                      onChange={(e) => {
                        setLyricsText(e.target.value);
                        setLyricsDirty(true);
                        const parsed = parseLyricsFromTextarea(e.target.value);
                        setLyrics(parsed);
                      }}
                      rows={4}
                      placeholder="点击“封存”后展示多语言歌词（中/英/日）。你也可以在此处微调。"
                      className="w-full glass rounded-2xl px-4 py-3 text-[12px] tracking-wide text-stone-700 placeholder:text-stone-400/80 outline-none focus:bg-white/55 transition-all duration-500 pointer-events-auto"
                      disabled={loading}
                    />
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
                  <span className="text-[11px] font-medium tracking-[0.15em] text-[#4A5D4E] opacity-60">取消</span>
                </button>

                <button
                  type="button"
                  onClick={seal}
                  disabled={loading}
                  className="group relative px-5 py-2 rounded-full glass glass-hover shadow-sm overflow-hidden disabled:opacity-60"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/20 to-teal-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <span className="relative text-[11px] font-medium tracking-[0.2em] text-[#4A5D4E]">
                    {record?.photoDataUrl ? "重新封存" : "封存"}
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

