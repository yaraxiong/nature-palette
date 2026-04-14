import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Tooltip from "./Tooltip";
import { useRainRecords } from "../state/rainRecords";
import { RAIN_COLORS } from "../constants/rainColors";

type RainGridProps = {
  activeDateISO?: string | null;
  onExistingRecordClick: (dateISO: string, dayIndexInView: number) => void;
  onEmptyRecordClick: (dateISO: string, dayIndexInView: number) => void;
};

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

function getDryIntensityIndexFromDateISO(dateISO: string) {
  // 为了“时间漫游”一致性，空白格的颜色也要跟日期绑定
  let hash = 0;
  for (let i = 0; i < dateISO.length; i++)
    hash = (hash * 31 + dateISO.charCodeAt(i)) % 1000;
  return hash % 4; // 0..3
}

function getWindowDates(today: Date, dayOffset: number) {
  // dayOffset = 0 时：窗口末尾严格等于用户本地今天
  // end = today - dayOffset
  // start = end - 29
  const end = addDays(today, -dayOffset);
  const start = addDays(end, -29);
  return { start, end };
}

export default function RainGrid({
  activeDateISO,
  onExistingRecordClick,
  onEmptyRecordClick,
}: RainGridProps) {
  const { getRecordByDateISO } = useRainRecords();

  const [dayOffset, setDayOffset] = useState(0); // 每次跳转 30 天
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState({
    visible: false,
    tooltipData: { text: "", lyrics: "" },
    x: 0,
    y: 0,
  });

  const gridRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const windowDates = useMemo(
    () => getWindowDates(today, dayOffset),
    [today, dayOffset],
  );

  const visibleDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(windowDates.start, i);
      return { dayIndexInView: i, dateISO: toLocalISODate(d) };
    });
  }, [windowDates.start]);

  const todayISO = useMemo(() => toLocalISODate(today), [today]);

  useEffect(() => {
    // capture today 时，如果当前窗口不是 dayOffset=0，强制回到“今天窗口”
    if (!activeDateISO) return;
    if (activeDateISO === todayISO && dayOffset !== 0) setDayOffset(0);
  }, [activeDateISO, dayOffset, todayISO]);

  useEffect(() => {
    if (!activeDateISO) return;
    const idx = visibleDays.findIndex((d) => d.dateISO === activeDateISO);
    if (idx < 0) return;
    const el = gridRef.current?.querySelector<HTMLElement>(
      `[data-day-index="${idx}"]`,
    );
    el?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "smooth",
    });
  }, [activeDateISO, visibleDays]);

  const dayLabel = dayOffset === 0 ? "LAST 30 DAYS" : "PREV 30 DAYS";
  const dayLabelFuture = dayOffset < 0 ? "NEXT 30 DAYS" : dayLabel;

  const handleMouseEnter = (
    e: MouseEvent,
    tooltipData: { text: string; lyrics: string },
    index: number,
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredIndex(index);
    setTooltip({
      visible: true,
      tooltipData,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip((prev) => ({ ...prev, visible: false }));
  };

  return (
    <div className="w-full max-w-[390px] mx-auto px-6 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="上一页（回到更早的 30 天）"
              onClick={() => setDayOffset((v) => v + 30)}
              className="p-1 rounded-full glass glass-hover transition-all duration-500"
            >
              <ChevronLeft
                className="w-4 h-4 text-[#4A5D4E] opacity-60"
                strokeWidth={1.5}
              />
            </button>

            <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
              {dayLabelFuture}
            </span>

            <button
              type="button"
              aria-label="下一页（回到更晚的 30 天）"
              onClick={() => setDayOffset((v) => v - 30)}
              className="p-1 rounded-full glass glass-hover transition-all duration-500"
            >
              <ChevronRight
                className="w-4 h-4 text-[#4A5D4E] opacity-60"
                strokeWidth={1.5}
              />
            </button>
          </div>

          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] text-stone-400 mr-1">Dry</span>
            {RAIN_COLORS.slice(0, 4).map((c, i) => (
              <motion.div
                key={i}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [1, 1.2, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: i * 0.2,
                }}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: c }}
              />
            ))}
            <span className="text-[9px] text-stone-400 ml-1">Wet</span>
          </div>
        </div>

        <div
          ref={gridRef}
          className="grid grid-cols-6 sm:grid-cols-10 gap-2 w-full"
        >
          {visibleDays.map((d) => {
            const record = getRecordByDateISO(d.dateISO);
            const isHovered = hoveredIndex === d.dayIndexInView;
            const isAnyHovered = hoveredIndex !== null;
            const isActive = activeDateISO === d.dateISO;

            // 任务三改动：不再使用 RAIN_COLORS 映射，直接使用 specificColorString
            const bg = record
              ? record.specificColorString
              : (RAIN_COLORS[getDryIntensityIndexFromDateISO(d.dateISO)] ??
                RAIN_COLORS[0]);

            // 任务三改动：清理假多语言，只展示日记文本和中文歌词
            const tooltipData = record
              ? { text: record.text, lyrics: record.lyrics.zh || "" }
              : {
                  text: `${d.dateISO}\n点击按钮来开启这一天的记录`,
                  lyrics: "",
                };

            return (
              <motion.div
                key={d.dateISO}
                data-day-index={d.dayIndexInView}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isAnyHovered && !isHovered
                    ? { opacity: [0.4, 0.7, 0.4], scale: [0.98, 1, 0.98] }
                    : { opacity: 1, scale: 1 }
                }
                whileHover={{
                  scale: 1.1,
                  zIndex: 20,
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
                transition={
                  isAnyHovered && !isHovered
                    ? {
                        opacity: {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: d.dayIndexInView * 0.05,
                        },
                        scale: {
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: d.dayIndexInView * 0.05,
                        },
                      }
                    : {
                        opacity: {
                          delay: d.dayIndexInView * 0.02,
                          duration: 0.5,
                        },
                        scale: {
                          delay: d.dayIndexInView * 0.02,
                          duration: 0.5,
                        },
                      }
                }
                onMouseEnter={(e) =>
                  handleMouseEnter(e, tooltipData, d.dayIndexInView)
                }
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  if (record)
                    onExistingRecordClick(d.dateISO, d.dayIndexInView);
                  else onEmptyRecordClick(d.dateISO, d.dayIndexInView);
                }}
                className={[
                  "aspect-square rounded-md cursor-pointer relative",
                  isActive ? "ring-1 ring-white/60" : "",
                ].join(" ")}
                style={{
                  backgroundColor: bg,
                  boxShadow: isHovered
                    ? "0 4px 12px rgba(0,0,0,0.08)"
                    : isActive
                      ? "0 6px 18px rgba(74,93,78,0.22)"
                      : "none",
                  transform: isActive ? "scale(1.06)" : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      <Tooltip {...tooltip} />
    </div>
  );
}
