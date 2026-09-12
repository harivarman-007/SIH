import React from 'react';
import { motion } from 'framer-motion';

export interface TimelineAnimationProps {
  animationNum?: number;
  timelineRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
  className?: string;
}

export const TimelineAnimation: React.FC<TimelineAnimationProps> = ({
  animationNum = 1,
  children,
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.45,
        delay: animationNum * 0.08,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
