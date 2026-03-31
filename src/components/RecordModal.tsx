import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { RAIN_COLORS } from "../constants/rainColors";
import { getGranularColorFromHumidity } from "../utils/colors";
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
    specificColorString: string;
  }) => boolean;
};

// 预设的唯美春雨文案库
const POETIC_LYRICS = [
  "最美的不是下雨天，是曾与你躲过雨的屋檐。",
  "把今天的潮湿封进字里，让它慢慢回响。",
  "雨声当作节拍，思念就不再那么吵。",
  "隔着布满水珠的玻璃，看见更近的春天。",
  "今天的雨，是我为你下的锚。",
  "听雨落下的声音，像是在寻找谁的解答。",
  "春雨如酒，让人在清醒与沉醉间徘徊。",
];

function simulateLyrics(): RainLyrics {
  const randomIndex = Math.floor(Math.random() * POETIC_LYRICS.length);
  // 为了不破坏外部已有的类型定义，我们将单句歌词存入 zh 字段，其他留空
  return { zh: POETIC_LYRICS[randomIndex], en: "", ja: "" };
}

function formatLyricsForTextarea(lyrics: RainLyrics) {
  return lyrics.zh || "";
}

function parseLyricsFromTextarea(raw: string): RainLyrics {
  return { zh: raw.trim(), en: "", ja: "" };
}

async function compressImageToJpegDataUrl(
  file: File,
  maxWidth = 800,
  quality = 0.6,
): Promise<string> {
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

export default function RecordModal({
  open,
  mode,
  dayIndex,
  dateISO,
  record,
  onClose,
  onSave,
}: RecordModalProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(
    record?.photoDataUrl ?? null,
  );
  const [text, setText] = useState(record?.text ?? "");
  const [lyrics, setLyrics] = useState<RainLyrics | null>(
    record?.lyrics ?? null,
  );
  const [loading, setLoading] = useState(false);

  // 核心改动：新增手动调节的情绪湿度计状态 (0-100，平滑连续值)
  const [rainHumidityValue, setRainHumidityValue] = useState(
    record?.rainIntensityIndex ? (record.rainIntensityIndex / 4) * 100 : 50,
  );

  const [lyricsDirty, setLyricsDirty] = useState(false);
  const [lyricsText, setLyricsText] = useState("");

  useEffect(() => {
    if (!open) return;
    setPhotoDataUrl(record?.photoDataUrl ?? null);
    setText(record?.text ?? "");
    setLyrics(record?.lyrics ?? null);
    setRainHumidityValue(
      record?.rainIntensityIndex ? (record.rainIntensityIndex / 4) * 100 : 50,
    );
    setLoading(false);
    setLyricsDirty(false);
  }, [open, record]);

  useEffect(() => {
    if (!open) return;
    setLyricsText(lyrics ? formatLyricsForTextarea(lyrics) : "");
  }, [open, lyrics]);

  const title = mode === "create" ? "封存今天的雨" : "查看/修改当天雨";

  const onPickPhoto = async (file: File | null) => {
    if (!file) return;

    try {
      setLoading(true);
      const compressed = await compressImageToJpegDataUrl(file, 800, 0.6);
      setPhotoDataUrl(compressed);
    } catch {
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

    // 模拟 AI 加载 Vibe
    await new Promise((r) => setTimeout(r, 900));

    // 任务二改动：支持盲盒式刷新歌词
    let nextLyrics = lyrics;

    if (mode === "create") {
      // create模式：总是生成新歌词
      nextLyrics = simulateLyrics();
    } else if (mode === "edit" && !lyricsDirty) {
      // edit模式且用户未手动修改歌词：强制生成新歌词（盲盒效果）
      nextLyrics = simulateLyrics();
    } else if (lyricsDirty) {
      // edit模式且用户已手动修改歌词：使用用户的修改
      nextLyrics = parseLyricsFromTextarea(lyricsText);
    }

    setLyrics(nextLyrics);

    // 计算精准的颜色字符串
    const specificColorString = getGranularColorFromHumidity(rainHumidityValue);
    // 转换 0-100 的湿度值回到 0-4 的索引（保留兼容性）
    const rainIntensityIndex = Math.round((rainHumidityValue / 100) * 4);

    const success = onSave({
      photoDataUrl,
      text,
      lyrics: nextLyrics!,
      rainIntensityIndex,
      specificColorString,
    });

    setLoading(false);

    // 保存成功后立刻关闭面板
    if (success) {
      setLyricsDirty(false);
      onClose();
    }
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
        >
          {/* 遮罩层：加上 onClose 确保点击外部也能关闭 */}
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
                  <h2 className="text-[12px] font-medium tracking-[0.22em] text-[#4A5D4E]">
                    {title}
                  </h2>
                  <p className="mt-2 text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
                    {mode === "create"
                      ? "上传雨景，写下心情，然后封存。"
                      : "你可以微调文字与歌词后重新封存。"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-2 rounded-full glass glass-hover transition-all duration-500"
                  aria-label="关闭"
                >
                  <span className="text-[12px] text-[#4A5D4E] opacity-70">
                    ×
                  </span>
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                  {dateISO}
                </p>

                {/* 核心改动：升级为平滑渐变色彩条Slider (0-100) */}
                <div className="flex items-center gap-1.5 flex-1 ml-4">
                  <span className="text-[9px] text-stone-400 font-light whitespace-nowrap">
                    Dry
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={rainHumidityValue}
                    onChange={(e) =>
                      setRainHumidityValue(Number(e.target.value))
                    }
                    disabled={loading}
                    className="rain-intensity-slider flex-1"
                    aria-label="情绪湿度"
                  />
                  <span className="text-[9px] text-stone-400 font-light whitespace-nowrap">
                    Wet
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 pb-6">
              <div className="glass rounded-2xl border border-rain-border bg-white/20 overflow-hidden">
                <div className="relative h-[168px] bg-white/10">
                  {photoDataUrl ? (
                    <img
                      src={photoDataUrl}
                      alt="Rain"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center">
                      <p className="text-[11px] text-stone-600/80 font-light tracking-wide">
                        选择一张雨景照片
                      </p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white/30" />
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                      Rain Photo
                    </p>
                    <p className="text-[10px] text-stone-500/70 font-light">
                      本地保存
                    </p>
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
                  <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                    AI Lyrics
                  </p>
                  <p className="text-[10px] text-stone-500/80 font-light">
                    Day {dayIndex + 1}
                  </p>
                </div>

                <div className="mt-2 glass rounded-2xl border border-rain-border bg-white/20 p-4 min-h-[90px] pointer-events-auto">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <motion.div
                        className="w-6 h-6 rounded-full border border-rain-border border-t-emerald-500/70"
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      />
                      <p className="text-[11px] text-stone-600/90 font-light tracking-wide">
                        AI 正在封存…
                      </p>
                    </div>
                  ) : (
                    <textarea
                      value={lyricsText}
                      onChange={(e) => {
                        setLyricsText(e.target.value);
                        setLyricsDirty(true);
                      }}
                      rows={3}
                      placeholder="点击“封存”后将为你抽取一句绝美诗句。你也可以在此微调。"
                      className="w-full glass rounded-2xl px-4 py-3 text-[12px] tracking-wide text-stone-700 placeholder:text-stone-400/80 outline-none focus:bg-white/55 transition-all duration-500 pointer-events-auto resize-none"
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
