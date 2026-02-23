import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z
    .object({
        firstName: z.string().min(2, 'First name is required'),
        lastName: z.string().min(2, 'Last name is required'),
        email: z.string().email('Please enter a valid email'),
        password: z
            .string()
            .min(8, 'Password must be at least 8 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number'),
        confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    });

export const forgotPasswordSchema = z.object({
    email: z.string().email('Please enter a valid email'),
});

export const newSessionSchema = z.object({
    name: z.string().min(3, 'Session name must be at least 3 characters'),
    instrument: z.string().min(1, 'Please select an instrument'),
    timeframe: z.string().min(1, 'Please select a timeframe'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    startingBalance: z.number().min(1000, 'Minimum starting balance is $1,000'),
});

export const tradeSchema = z.object({
    instrument: z.string().min(1, 'Instrument is required'),
    direction: z.enum(['LONG', 'SHORT']),
    entryPrice: z.number().positive('Entry price must be positive'),
    exitPrice: z.number().positive('Exit price must be positive'),
    quantity: z.number().positive('Quantity must be positive'),
    entryDate: z.string().min(1, 'Entry date is required'),
    exitDate: z.string().min(1, 'Exit date is required'),
    setup: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
});

export const orderSchema = z.object({
    direction: z.enum(['BUY', 'SELL']),
    orderType: z.enum(['MARKET', 'LIMIT', 'STOP']),
    quantity: z.number().positive('Quantity must be positive'),
    price: z.number().positive().optional(),
    stopLoss: z.number().positive().optional(),
    takeProfit: z.number().positive().optional(),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
export type NewSessionFormData = z.infer<typeof newSessionSchema>;
export type TradeFormData = z.infer<typeof tradeSchema>;
export type OrderFormData = z.infer<typeof orderSchema>;
