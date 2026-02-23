'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const initialize = useAuthStore((state) => state.initialize);
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
    const isLoading = useAuthStore((state) => state.isLoading);
    const [isMounted, setIsMounted] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsMounted(true);
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (!isMounted) return;

        // Protected routes
        const protectedRoutes = ['/overview', '/dashboard', '/settings'];
        const isProtectedRoute = protectedRoutes.some(route => pathname?.startsWith(route));

        // Public only routes (redirect to overview if logged in)
        const publicOnlyRoutes = ['/login', '/register'];
        const isPublicOnlyRoute = publicOnlyRoutes.some(route => pathname?.startsWith(route));

        if (!isLoading) {
            if (isProtectedRoute && !isAuthenticated) {
                router.push('/login');
            }
            if (isPublicOnlyRoute && isAuthenticated) {
                router.push('/overview');
            }
        }
    }, [isMounted, isAuthenticated, isLoading, pathname, router]);

    if (!isMounted) {
        return null; // or a loading spinner
    }

    if (isLoading) {
        // Retrieve theme from localStorage to avoid flash of wrong theme (optional) or just use simple loader
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        );
    }

    return <>{children}</>;
}
