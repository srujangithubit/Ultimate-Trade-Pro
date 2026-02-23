'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, Lock, User, ArrowRight, Chrome } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/lib/hooks/useAuth';
import { registerSchema, type RegisterFormData } from '@/lib/utils/validators';

export default function RegisterPage() {
    const router = useRouter();
    const { register: registerUser, isLoading, error, clearError } = useAuth();
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<RegisterFormData>({
        resolver: zodResolver(registerSchema),
    });

    const onSubmit = async (data: RegisterFormData) => {
        try {
            await registerUser({
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.email,
                password: data.password,
            });
            router.push('/overview');
        } catch {
            // Error handled by store
        }
    };

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Create an account</h2>
                <p className="text-muted-foreground">
                    Start your journey to better trading today
                </p>
            </div>

            <Button variant="outline" className="w-full gap-2" type="button">
                <Chrome className="h-4 w-4" />
                Continue with Google
            </Button>

            <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                    or continue with email
                </span>
            </div>

            {error && (
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                    {error}
                    <button onClick={clearError} className="ml-2 underline">Dismiss</button>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="firstName"
                                {...register('firstName')}
                                placeholder="Alex"
                                className="pl-10"
                            />
                        </div>
                        {errors.firstName && (
                            <p className="text-sm text-destructive">{errors.firstName.message}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input
                            id="lastName"
                            {...register('lastName')}
                            placeholder="Trader"
                        />
                        {errors.lastName && (
                            <p className="text-sm text-destructive">{errors.lastName.message}</p>
                        )}
                    </div>
                </div>

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
                    <Label htmlFor="password">Password</Label>
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

                <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            id="confirmPassword"
                            {...register('confirmPassword')}
                            type="password"
                            placeholder="••••••••"
                            className="pl-10"
                        />
                    </div>
                    {errors.confirmPassword && (
                        <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                    )}
                </div>

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Creating account...
                        </>
                    ) : (
                        <>
                            Create account
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
