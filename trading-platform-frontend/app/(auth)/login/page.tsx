'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, ArrowRight, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/hooks/useAuth';
import { loginSchema, type LoginFormData } from '@/lib/utils/validators';

export default function LoginPage() {
    const router = useRouter();
    const { login, isLoading, error, clearError } = useAuth();
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
    });

    const onSubmit = async (data: LoginFormData) => {
        try {
            await login(data.email, data.password);
            router.push('/overview');
        } catch {
            // Error is handled by the store
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Welcome back</h2>
                <p className="text-muted-foreground">
                    Sign in to your account to continue trading
                </p>
            </div>

            {/* Social login */}
            <div className="grid gap-3">
                <Button variant="outline" className="w-full gap-2" type="button">
                    <Chrome className="h-4 w-4" />
                    Continue with Google
                </Button>
            </div>

            <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                    or continue with email
                </span>
            </div>

            {/* Error message */}
            {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {error}
                    <button onClick={clearError} className="ml-2 underline">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="email"
                            {...register('email')}
                            type="email"
                            placeholder="trader@example.com"
                            className="pl-10"
                        />
                    </div>
                    {errors.email && (
                        <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        <Link
                            href="/forgot-password"
                            className="text-sm text-primary hover:underline"
                        >
                            Forgot password?
                        </Link>
                    </div>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="password"
                            {...register('password')}
                            type={showPassword ? 'text' : 'password'}
                            placeholder="••••••••"
                            className="pl-10 pr-10"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                    {errors.password && (
                        <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Signing in...
                        </>
                    ) : (
                        <>
                            Sign in
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-primary font-medium hover:underline">
                    Sign up for free
                </Link>
            </p>
        </div>
    );
}
