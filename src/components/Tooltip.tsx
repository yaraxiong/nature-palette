import { motion, AnimatePresence } from "motion/react";

interface TooltipProps {
  content: string;
  visible: boolean;
  x: number;
  y: number;
}

export default function Tooltip({ content, visible, x, y }: TooltipProps) {
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
            transform: 'translateX(-50%) translateY(-100%)'
          }}
          className="fixed z-[100] pointer-events-none"
        >
          <div className="glass px-4 py-2.5 rounded-xl shadow-xl min-w-[140px] max-w-[220px]">
            <p className="whitespace-pre-line text-[11px] leading-relaxed text-stone-600 font-light tracking-wide text-center">
              {content}
            </p>
            {/* Diamond indicator */}
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2 h-2 rotate-45 glass border-t-0 border-l-0" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
