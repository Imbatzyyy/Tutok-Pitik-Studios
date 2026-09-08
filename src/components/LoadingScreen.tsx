import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import logoImage from 'figma:asset/c5d3e549442d77b6cd4fded105377d2618135800.png';

interface LoadingScreenProps {
  onLoadingComplete: () => void;
}

export default function LoadingScreen({ onLoadingComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Simulate loading progress
    const duration = 2500; // 2.5 seconds total loading time
    const steps = 100;
    const intervalTime = duration / steps;

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsComplete(true);
            setTimeout(onLoadingComplete, 600); // Wait for exit animation
          }, 300);
          return 100;
        }
        return prev + 1;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, [onLoadingComplete]);

  return (
    <AnimatePresence>
      {!isComplete && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.1 }}
          transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 opacity-30">
            <motion.div
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at 50% 50%, #E63946 0%, transparent 50%)',
              }}
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>

          {/* Content container */}
          <div className="relative flex flex-col items-center gap-8 px-6">
            {/* Logo with pulse animation */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                duration: 0.8, 
                ease: [0.4, 0, 0.2, 1],
                delay: 0.2 
              }}
              className="relative"
            >
              <motion.div
                className="absolute inset-0 bg-[#E63946] opacity-20 blur-3xl"
                animate={{
                  scale: [1, 1.3, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
              <img 
                src={logoImage} 
                alt="Tutok Pitik Studios" 
                className="relative h-40 w-40 md:h-56 md:w-56 object-contain"
              />
            </motion.div>

            {/* Brand name with stagger animation */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-4xl md:text-6xl font-bold text-white tracking-tight text-center"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Tutok Pitik Studios
            </motion.h1>

            {/* Loading bar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="w-64 md:w-80"
            >
              {/* Progress bar container */}
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-800/50 backdrop-blur-sm">
                {/* Progress fill */}
                <motion.div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#E63946] to-[#ff6b76]"
                  style={{ width: `${progress}%` }}
                  transition={{ duration: 0.1 }}
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                </motion.div>
              </div>

              {/* Progress percentage */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="mt-3 text-center text-sm font-medium text-gray-500"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {progress}%
              </motion.div>
            </motion.div>

            {/* Loading text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                times: [0, 0.2, 0.8, 1],
              }}
              className="text-xs md:text-sm text-gray-600 tracking-widest uppercase"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              Preparing your experience
            </motion.p>
          </div>

          {/* Decorative corners */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
            transition={{ delay: 1 }}
            className="pointer-events-none absolute inset-0"
          >
            {/* Top left */}
            <div className="absolute left-0 top-0 h-32 w-32 border-l-2 border-t-2 border-[#E63946]" />
            {/* Top right */}
            <div className="absolute right-0 top-0 h-32 w-32 border-r-2 border-t-2 border-[#E63946]" />
            {/* Bottom left */}
            <div className="absolute bottom-0 left-0 h-32 w-32 border-b-2 border-l-2 border-[#E63946]" />
            {/* Bottom right */}
            <div className="absolute bottom-0 right-0 h-32 w-32 border-b-2 border-r-2 border-[#E63946]" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}