import { motion, AnimatePresence } from "motion/react";

interface TooltipProps {
  tooltipData: { text: string; lyrics?: string };
  visible: boolean;
  x: number;
  y: number;
}

export default function Tooltip({ tooltipData, visible, x, y }: TooltipProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 5 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          style={{
            left: x,
            top: y - 10,
            transform: "translateX(-50%) translateY(-100%)",
          }}
          className="fixed z-[100] pointer-events-none"
        >
          <div className="glass px-4 py-2.5 rounded-xl shadow-xl min-w-[140px] max-w-[220px]">
            {/* 任务三改动：极简排版，只展示日记文本和歌词，无多语言分隔符 */}
            <p className="text-[11px] leading-relaxed text-stone-600 font-light tracking-wide">
              {tooltipData.text}
            </p>
            {tooltipData.lyrics && (
              <p className="mt-1 text-[10px] leading-relaxed text-stone-500/80 font-light tracking-wide italic">
                {tooltipData.lyrics}
              </p>
            )}
            {/* Diamond indicator */}
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 glass border-t-0 border-l-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
