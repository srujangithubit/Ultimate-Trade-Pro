'use client';

import { useAuthStore } from '@/lib/stores/authStore';

export function useAuth() {
    const store = useAuthStore();

    return {
        user: store.user,
        token: store.token,
        isAuthenticated: store.isAuthenticated,
        isLoading: store.isLoading,
        error: store.error,
        login: store.login,
        register: store.register,
        logout: store.logout,
        clearError: store.clearError,
        initialize: store.initialize,
    };
}
