"use client";

import { motion, type Variants } from 'framer-motion';
import React from 'react';

const containerVariants = (stagger = 0.1, delay = 0): Variants => ({
    hidden: {},
    show: {
        transition: {
            staggerChildren: stagger,
            delayChildren: delay
        }
    }
});

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
        opacity: 1,
        y: 0,
        transition: {
            type: 'spring',
            stiffness: 260,
            damping: 24
        }
    }
};

interface FadeInStaggerProps {
    children: React.ReactNode;
    className?: string;
    stagger?: number;
    delay?: number;
}

export const FadeInStagger = ({ children, className, stagger = 0.1, delay = 0 }: FadeInStaggerProps) => (
    <motion.div
        className={className}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        variants={containerVariants(stagger, delay)}
    >
        {children}
    </motion.div>
);

interface FadeInStaggerItemProps {
    children: React.ReactNode;
    className?: string;
}

export const FadeInStaggerItem = ({ children, className }: FadeInStaggerItemProps) => (
    <motion.div className={className} variants={itemVariants}>
        {children}
    </motion.div>
);
