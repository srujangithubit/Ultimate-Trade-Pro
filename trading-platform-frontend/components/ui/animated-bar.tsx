import { motion } from 'framer-motion';

export const AnimatedHorizontalBar = (props: any) => {
    const { fill, x, y, width, height, index } = props;
    const safeWidth = Number.isNaN(width) ? 0 : width;
    const safeHeight = Number.isNaN(height) ? 0 : height;

    return (
        <motion.rect
            x={x}
            y={y}
            width={0}
            height={safeHeight}
            fill={fill}
            rx={4}
            initial={{ width: 0 }}
            animate={{ width: safeWidth }}
            transition={{ duration: 0.6, delay: (index || 0) * 0.05, ease: "easeOut" }}
        />
    );
};

export const AnimatedVerticalBar = (props: any) => {
    const { fill, x, y, width, height, index } = props;
    const safeWidth = Number.isNaN(width) ? 0 : width;
    const safeHeight = Number.isNaN(height) ? 0 : height;

    return (
        <motion.rect
            x={x}
            y={y}
            width={safeWidth}
            height={0}
            fill={fill}
            rx={4}
            initial={{ height: 0 }}
            animate={{ height: safeHeight }}
            transition={{ duration: 0.6, delay: (index || 0) * 0.05, ease: "easeOut" }}
        />
    );
};
