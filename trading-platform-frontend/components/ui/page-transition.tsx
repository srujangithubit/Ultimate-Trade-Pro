'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const variants = {
    hidden: { opacity: 0, x: 0, y: 20 },
    enter: { opacity: 1, x: 0, y: 0 },
    exit: { opacity: 0, x: 0, y: -20 },
};

export default function PageTransition({ children }: { children: ReactNode }) {
    return (
        <motion.main
            variants={variants}
            initial="hidden"
            animate="enter"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="flex-1 w-full"
        >
            {children}
        </motion.main>
    );
}
