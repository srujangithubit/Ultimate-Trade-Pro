export const AnimatedHorizontalBar = (props: Record<string, unknown>) => {
    const { fill, x, y, width, height } = props;
    const safeWidth = Math.max(0, Number(width) || 0);
    const safeHeight = Math.max(0, Number(height) || 0);

    return (
        <rect
            x={x as number}
            y={y as number}
            width={safeWidth}
            height={safeHeight}
            fill={fill as string}
            rx={4}
            style={{ transition: 'width 0.6s ease-out' }}
        />
    );
};

export const AnimatedVerticalBar = (props: Record<string, unknown>) => {
    const { fill, x, y, width, height } = props;
    const safeWidth = Math.max(0, Number(width) || 0);
    const safeHeight = Math.max(0, Number(height) || 0);

    return (
        <rect
            x={x as number}
            y={y as number}
            width={safeWidth}
            height={safeHeight}
            fill={fill as string}
            rx={4}
            style={{ transition: 'height 0.6s ease-out' }}
        />
    );
};
