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

  /* ========== 新增状态：图片压缩与AI生成 ========== */
  // previewBase64: 用原生 FileReader 异步读取的原始图片 Base64（用于页面即时预览）
  const [previewBase64, setPreviewBase64] = useState<string | null>(null);

  // compressedBase64: Canvas 前端压缩后的纯净 JPEG Base64（用于发送给 AI 模型）
  const [compressedBase64, setCompressedBase64] = useState<string | null>(null);

  // isGenerating: AI 调用过程中的加载状态（防止重复提交）
  const [isGenerating, setIsGenerating] = useState(false);

  // aiLyrics: 从豆包 API 返回的 AI 生成歌词
  const [aiLyrics, setAiLyrics] = useState<string>("");

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
    // 重置新增的图片压缩和 AI 生成相关状态
    setPreviewBase64(null);
    setCompressedBase64(null);
    setIsGenerating(false);
    setAiLyrics("");
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

      /* ========== 【阶段 1】FileReader 异步读取原始图片为 Base64 ========== */
      // 核心理由：我们需要将本地文件转换为可以在浏览器中直接预览的 Data URL 格式。
      // FileReader 是浏览器原生异步 API，不会阻塞主线程。使用 Promise 包装让我们能用 await 等待读取完成。
      // Base64 编码的 Data URL 可以直接赋值给 <img src="" /> 进行即时预览，无需上传到服务器。
      const originalBase64 = await readFileAsDataUrl(file);
      setPreviewBase64(originalBase64);

      /* ========== 【阶段 2】Canvas 前端压缩：等比例缩放 + 质量压缩 ========== */
      // 核心问题：原始照片可能高达 5-10MB，直接发给 AI 模型会导致三个痛点：
      //   1. 网络传输慢（浪费带宽和用户流量）
      //   2. AI API 请求体过大，可能被服务端拒绝（通常有 payload 大小限制）
      //   3. AI 视觉大模型处理大图比例失衡，影响推理速度和成本
      //
      // Canvas 方案的优势：
      //   - 在浏览器内存中完成压缩，无需往服务端上传原图
      //   - canvas.toDataURL('image/jpeg', 0.6) 的 0.6 参数代表 JPEG 质量系数，同时编码为高效的 JPEG 格式
      //   - 最大宽度 800px 的限制，既保证了 AI 模型能看清细节，又大幅削减文件体积（通常降至 50-100KB）
      //   - 纯前端处理无隐私泄露风险（与后端压缩不同，源文件不会离开用户设备）
      const compressedBase64 = await compressImageToJpegDataUrl(file, 800, 0.6);
      setCompressedBase64(compressedBase64);

      // 将压缩后的 Base64 也同步到预览，让用户看到实际会发送给 AI 的图片
      setPhotoDataUrl(compressedBase64);
    } catch (error) {
      console.error("图片处理失败:", error);
      const raw = await readFileAsDataUrl(file);
      setPhotoDataUrl(raw);
      setPreviewBase64(raw);
    } finally {
      setLyricsDirty(false);
      setLoading(false);
    }
  };

  /* ========== AI 歌词生成函数 ========== */
  const generateAILyricsFromImage = async () => {
    // 验证是否有压缩后的图片可用
    if (!compressedBase64) {
      console.warn("没有可用的图片，请先上传图片");
      return;
    }

    setIsGenerating(true);

    try {
      /* ========== 【多模态 JSON Payload 组装】OpenAI 兼容格式 ========== */
      // 豆包视觉大模型采用 OpenAI Chat Completion API 的兼容协议。
      // 多模态支持的关键在于在 content 数组中混搭文本和图像对象。这个设计允许 AI 在单次请求中理解文字上下文和图像内容。
      //
      // 结构解析：
      //   - messages: 消息历史数组，用于多轮对话（我们这里是单轮）
      //   - role: "user" 表示这是用户的请求
      //   - content: 这是一个数组，可以包含多个内容块：
      //       * { type: "text", text: "..."}：纯文本 Prompt
      //       * { type: "image_url", image_url: { url: "..." }}：图像 Base64 引用
      //   - model: 使用环境变量中的端点信息（豆包的模型标识符）
      //
      // Base64 图像编码的好处：
      //   - 避免多次 HTTP 请求（不需要先上传图，再引用 URL）
      //   - 完全内联请求体，更易于 API 网关和负载均衡处理
      //   - 敏感数据永不落地第三方（直接从浏览器到豆包）
      const payload = {
        model: import.meta.env.VITE_DOUBAO_ENDPOINT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `请根据这张照片匹配一句充满网感的雨天歌词。要求：\n1. 必须是关于下雨/雨天的歌词或诗句\n2. 富有文艺气息和网络流行语结合的风格\n3. 长度控制在 15-30 个汉字\n4. 直接返回歌词，不要解释`,
              },
              {
                type: "image_url",
                image_url: {
                  // compressedBase64  已是完整的 Data URL（形如 "data:image/jpeg;base64,/9j/4AAQSkZJRg..."）
                  url: compressedBase64,
                },
              },
            ],
          },
        ],
      };

      // 极其重要的调试步骤：在发送 fetch 之前打印完整的请求体
      // 这样在面试时如果 API 调用失败，可以看到具体的 payload 结构，快速定位问题
      console.log("发给豆包的完整数据:", payload);
      console.log(
        "请求头 - Authorization: Bearer",
        import.meta.env.VITE_DOUBAO_API_KEY?.substring(0, 10) + "...",
      );

      const response = await fetch("/api/v3/chat/completions" /*修改网址*/, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_DOUBAO_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(
          `豆包 API 返回 ${response.status}: ${response.statusText}`,
        );
      }

      const data = await response.json();
      console.log("豆包 API 响应:", data);

      // 解析 OpenAI 兼容格式的响应
      // 标准格式：{ choices: [{ message: { content: "歌词内容" } }] }
      const generatedText = data.choices?.[0]?.message?.content || "";

      if (generatedText) {
        // 将 AI 生成的歌词更新到状态中
        setAiLyrics(generatedText);
        // 同步更新 lyrics 状态，使用 RainLyrics 结构兼容
        setLyrics({ zh: generatedText, en: "", ja: "" });
        setLyricsText(generatedText);
        setLyricsDirty(false);
      } else {
        throw new Error("AI 返回的歌词为空");
      }
    } catch (error) {
      console.error("AI 歌词生成失败:", error);
      alert(
        `生成歌词失败: ${error instanceof Error ? error.message : "未知错误"}`,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const seal = async () => {
    if (loading || isGenerating) return;
    setLoading(true);

    // 如果有图片且还没有获取 AI 歌词，先生成歌词
    if (compressedBase64 && !aiLyrics && mode === "create") {
      await generateAILyricsFromImage();
    }

    // 模拟 AI 加载 Vibe（如果没有调用过 AI）
    if (!aiLyrics) {
      await new Promise((r) => setTimeout(r, 900));
    }

    // 任务二改动：支持盲盒式刷新歌词
    let nextLyrics =
      lyrics || aiLyrics
        ? { zh: aiLyrics || lyricsText, en: "", ja: "" }
        : lyrics;

    if (mode === "create" && !aiLyrics) {
      // create模式且没有 AI 歌词：使用预设歌词
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
                      : "你可以修改文字后重新封存。"}
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
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
                      AI Lyrics
                    </p>
                    {/* 「AI 生成」按钮：只要有上传图片就显示，支持 create 和 edit 模式 */}
                    {compressedBase64 && (
                      <button
                        type="button"
                        onClick={generateAILyricsFromImage}
                        disabled={isGenerating || loading}
                        className="px-2 py-1 rounded-full text-[9px] font-medium tracking-[0.1em] glass glass-hover transition-all duration-300 disabled:opacity-50"
                        title="基于上传的图片使用豆包 AI 生成歌词"
                      >
                        <span className="text-emerald-600/70">
                          {isGenerating
                            ? "生成中..."
                            : lyricsText
                              ? "✨ 重新生成"
                              : "✨ 生成"}
                        </span>
                      </button>
                    )}
                  </div>
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
