"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.995 }}
      transition={{
        duration: 0.28,
        ease: [0.16, 1, 0.3, 1], // Natural Apple iOS cubic bezier
      }}
      className="w-full min-h-screen gpu-layer"
    >
      {children}
    </motion.div>
  );
}
