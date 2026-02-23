'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/utils/validators';

export default function ForgotPasswordPage() {
    const [submitted, setSubmitted] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const {
        register,
        handleSubmit,
        formState: { errors },
        getValues,
    } = useForm<ForgotPasswordFormData>({
        resolver: zodResolver(forgotPasswordSchema),
    });

    const onSubmit = async () => {
        setIsLoading(true);
        // Mock delay
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setIsLoading(false);
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="space-y-6 text-center">
                <div className="flex justify-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/20">
                        <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold">Check your email</h2>
                    <p className="text-muted-foreground">
                        We&apos;ve sent a password reset link to{' '}
                        <span className="font-medium text-foreground">{getValues('email')}</span>
                    </p>
                </div>
                <Link href="/login">
                    <Button variant="outline" className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Reset password</h2>
                <p className="text-muted-foreground">
                    Enter your email and we&apos;ll send you a reset link
                </p>
            </div>

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

                <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                    {isLoading ? (
                        <>
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Sending...
                        </>
                    ) : (
                        <>
                            Send reset link
                            <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
                Remember your password?{' '}
                <Link href="/login" className="text-primary font-medium hover:underline">
                    Sign in
                </Link>
            </p>
        </div>
    );
}
