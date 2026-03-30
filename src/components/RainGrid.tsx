import { useEffect, useRef, useState, type MouseEvent } from "react";
import { motion } from "motion/react";
import Tooltip from "./Tooltip";
import { useRainRecords } from "../state/rainRecords";

const COLORS = [
  "#E7E5E466", // bg-stone-200/40 (Dry)
  "#D1FAE566", // bg-emerald-100/40
  "#A7F3D080", // bg-emerald-200/50
  "#6EE7B799", // bg-emerald-300/60
  "#34D39999", // bg-emerald-400/60
  "#4A5D4E66", // Darker sage
  "#4A5D4E99", // Moss
  "#4A5D4ECC", // Deep rain
];

type RainGridProps = {
  activeDayIndex?: number | null;
  onExistingRecordClick: (dayIndex: number) => void;
  onEmptyRecordClick: (dayIndex: number) => void;
};

function getDryIntensityIndex(dayIndex: number) {
  // 固定、可复现：不依赖随机数，刷新也稳定（Dry：0..3）
  return (dayIndex * 7) % 4;
}

export default function RainGrid({ activeDayIndex, onExistingRecordClick, onEmptyRecordClick }: RainGridProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState({ visible: false, content: "", x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const { records, getDateISO } = useRainRecords();

  useEffect(() => {
    if (activeDayIndex == null) return;
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-day-index="${activeDayIndex}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [activeDayIndex]);

  const handleMouseEnter = (e: MouseEvent, content: string, index: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredIndex(index);
    setTooltip({
      visible: true,
      content,
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  return (
    <div className="w-full max-w-[390px] mx-auto px-6 pb-24">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400 font-medium">
            Last 30 Days
          </span>
          <div className="flex gap-1.5 items-center">
            <span className="text-[9px] text-stone-400 mr-1">Dry</span>
            {COLORS.slice(0, 4).map((c, i) => (
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
          {Array.from({ length: 30 }, (_, i) => i).map((i) => {
            const record = records[i];
            const isHovered = hoveredIndex === i;
            const isAnyHovered = hoveredIndex !== null;
            const isActive = activeDayIndex === i;

            const intensityIndex = record ? record.rainIntensityIndex : getDryIntensityIndex(i);
            const bg = COLORS[intensityIndex] ?? COLORS[0];

            const tooltipContent = record
              ? `${record.lyrics.zh}\n---\n${record.lyrics.en}\n---\n${record.lyrics.ja}`
              : `${getDateISO(i)}\n点击捕捉按钮来开启这一天的记录`;

            return (
              <motion.div
                key={i}
                data-day-index={i}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={
                  isAnyHovered && !isHovered
                    ? {
                        opacity: [0.4, 0.7, 0.4],
                        scale: [0.98, 1, 0.98],
                      }
                    : {
                        opacity: 1,
                        scale: 1,
                      }
                }
                whileHover={{
                  scale: 1.1,
                  zIndex: 20,
                  transition: { duration: 0.2, ease: "easeOut" },
                }}
                transition={
                  isAnyHovered && !isHovered
                    ? {
                        opacity: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 },
                        scale: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.05 },
                      }
                    : {
                        opacity: { delay: i * 0.02, duration: 0.5 },
                        scale: { delay: i * 0.02, duration: 0.5 },
                      }
                }
                onMouseEnter={(e) => handleMouseEnter(e, tooltipContent, i)}
                onMouseLeave={handleMouseLeave}
                onClick={() => {
                  if (record) onExistingRecordClick(i);
                  else onEmptyRecordClick(i);
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
