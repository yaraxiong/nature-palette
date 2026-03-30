import { Camera } from "lucide-react";
import { motion } from "motion/react";

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center pt-32 pb-16 px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center"
      >
        <h1 className="text-[22px] font-light tracking-widest text-stone-600 mb-12">
          长沙，春雨的第 12 天。
        </h1>
        
        <button className="group relative flex items-center justify-center gap-3 px-8 py-4 rounded-full glass glass-hover shadow-sm overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/20 to-teal-50/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          <Camera className="w-4 h-4 text-[#4A5D4E] opacity-70" strokeWidth={1.5} />
          <span className="text-[14px] font-medium tracking-widest text-[#4A5D4E]">
            捕捉今天的雨
          </span>
        </button>
      </motion.div>
    </section>
  );
}
