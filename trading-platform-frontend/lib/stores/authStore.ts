import { create } from 'zustand';
import { api } from '@/lib/api/client';

interface User {
    id: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    email: string;
    avatar: string | null;
    plan: string;
}

interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    login: (email: string, password: string) => Promise<void>;
    register: (data: { firstName: string; lastName: string; email: string; password: string }) => Promise<void>;
    logout: () => void;
    setUser: (user: User) => void;
    clearError: () => void;
    initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
    user: null,
    token: typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null,
    isAuthenticated: typeof window !== 'undefined' ? !!localStorage.getItem('auth_token') : false,
    isLoading: false,
    error: null,

    initialize: async () => {
        if (typeof window === 'undefined') return;

        const token = localStorage.getItem('auth_token');
        const refreshToken = localStorage.getItem('refresh_token');

        if (!token || !refreshToken) {
            set({
                token: null,
                user: null,
                isAuthenticated: false,
                isLoading: false,
            });
            return;
        }

        try {
            set({ isLoading: true });

            // Optionally: Validate token or just fetch user
            // If the token is invalid, the interceptor should handle 401 and try refresh
            const userResponse = await api.get<User>('/auth/me');

            set({
                user: userResponse.data,
                token: token,
                isAuthenticated: true,
                isLoading: false,
            });
        } catch (error) {
            console.error('Auth initialization failed:', error);
            // If fetching user fails and refresh fails (handled by interceptor), logout
            get().logout();
        } finally {
            set({ isLoading: false });
        }
    },

    login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
            const { data } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/login', {
                email,
                password,
            });

            localStorage.setItem('auth_token', data.accessToken);
            localStorage.setItem('refresh_token', data.refreshToken);

            // Fetch user details
            const userResponse = await api.get<User>('/auth/me');

            set({
                user: userResponse.data,
                token: data.accessToken,
                isAuthenticated: true,
                isLoading: false,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            set({
                isLoading: false,
                error: error.response?.data?.message || 'Login failed',
            });
            throw error;
        }
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    register: async (data: any) => {
        set({ isLoading: true, error: null });
        try {
            const { data: tokens } = await api.post<{ accessToken: string; refreshToken: string }>('/auth/register', {
                email: data.email,
                password: data.password,
                displayName: `${data.firstName || ''} ${data.lastName || ''}`.trim() || undefined,
            });

            localStorage.setItem('auth_token', tokens.accessToken);
            localStorage.setItem('refresh_token', tokens.refreshToken);

            // Fetch user details (auto-login after register)
            const userResponse = await api.get<User>('/auth/me');

            set({
                user: userResponse.data,
                token: tokens.accessToken,
                isAuthenticated: true,
                isLoading: false,
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
            set({
                isLoading: false,
                error: error.response?.data?.message || 'Registration failed',
            });
            throw error;
        }
    },

    logout: () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
        });
        // Optional: Redirect to login or home
        if (typeof window !== 'undefined') {
            window.location.href = '/';
        }
    },

    setUser: (user: User) => set({ user }),
    clearError: () => set({ error: null }),
}));
