'use client';

import {
    useRef,
    useState,
    useEffect,
    useCallback,
    Children,
    cloneElement,
    isValidElement,
    type ReactNode,
    type ReactElement,
} from 'react';

interface SafeResponsiveContainerProps {
    width?: number | `${number}%`;
    height?: number | `${number}%`;
    minWidth?: number;
    minHeight?: number;
    debounce?: number;
    aspect?: number;
    children: ReactNode;
}

export function ResponsiveContainer({
    children,
    minHeight = 0,
    debounce = 150,
}: SafeResponsiveContainerProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [size, setSize] = useState<{ w: number; h: number } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const { width, height } = el.getBoundingClientRect();
        if (width > 0 && height > 0) {
            setSize((prev) => {
                const w = Math.floor(width);
                const h = Math.floor(height);
                if (prev && prev.w === w && prev.h === h) return prev;
                return { w, h };
            });
        }
    }, []);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        measure();

        const obs = new ResizeObserver(() => {
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(measure, debounce);
        });
        obs.observe(el);
        return () => {
            obs.disconnect();
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [measure, debounce]);

    return (
        <div
            ref={ref}
            style={{
                width: '100%',
                height: '100%',
                minWidth: 0,
                minHeight: minHeight || undefined,
            }}
        >
            {size &&
                Children.map(children, (child) => {
                    if (isValidElement(child)) {
                        return cloneElement(child as ReactElement<{ width?: number; height?: number }>, {
                            width: size.w,
                            height: size.h,
                        });
                    }
                    return child;
                })}
        </div>
    );
}
