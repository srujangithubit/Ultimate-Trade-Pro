'use client';

import { useState, useRef } from 'react';
import {
    User,
    Bell,
    Palette,
    Key,
    Save,
    Moon,
    Sun,
    Monitor,
    Shield,
    Camera,
    Trash2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserPreferences } from '@/lib/stores/userPreferencesStore';

export default function SettingsPage() {
    const { user, initialize } = useAuth();
    const { theme, setTheme } = useTheme();
    const {
        avatarUrl,
        setAvatarUrl,
        currency,
        setCurrency,
        dateFormat,
        setDateFormat,
        timezone,
        setTimezone,
        notifications,
        setNotification,
    } = useUserPreferences();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Split user displayName back into First and Last for the form inputs
    const displayNameParts = (user?.displayName || '').split(' ');
    const initialFirst = displayNameParts[0] || user?.firstName || '';
    const initialLast = displayNameParts.slice(1).join(' ') || user?.lastName || '';

    const [firstName, setFirstName] = useState(initialFirst);
    const [lastName, setLastName] = useState(initialLast);
    const [email, setEmail] = useState(user?.email || '');

    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const initials = user?.displayName
        ? user.displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : ((user?.firstName?.[0] || 'G') + (user?.lastName?.[0] || 'U')).toUpperCase();

    const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate size (2MB max)
        if (file.size > 2 * 1024 * 1024) {
            alert('File too large. Maximum size is 2MB.');
            return;
        }

        // Validate type
        if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
            alert('Invalid file type. Please use JPG, PNG, GIF, or WebP.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target?.result as string;

            // Resize to 256x256 max to keep localStorage small
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const size = Math.min(img.width, img.height, 256);
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                // Center-crop
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);

                const resizedUrl = canvas.toDataURL('image/jpeg', 0.85);
                setAvatarUrl(resizedUrl);
            };
            img.src = dataUrl;
        };
        reader.readAsDataURL(file);

        // Reset the input so the same file can be re-selected
        e.target.value = '';
    };

    const handleRemoveAvatar = () => {
        setAvatarUrl(null);
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            const { api } = await import('@/lib/api/client');

            // Build the compound displayName just like register does
            const displayName = `${firstName} ${lastName}`.trim();

            await api.patch('/users/me', {
                displayName
            });

            // Re-fetch the user details in authStore so the navbar updates immediately
            if (initialize) await initialize();

            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (error) {
            console.error("Failed to update profile", error);
        } finally {
            setSaving(false);
        }
    };

    const notificationItems = [
        { key: 'backtestCompleted' as const, label: 'Backtest Completed', desc: 'Get notified when a backtest finishes running' },
        { key: 'weeklyReport' as const, label: 'Weekly Performance Report', desc: 'Receive a weekly summary of your trading performance' },
        { key: 'riskAlerts' as const, label: 'Risk Alerts', desc: 'Alerts when you exceed drawdown thresholds' },
        { key: 'productUpdates' as const, label: 'Product Updates', desc: 'New features and platform announcements' },
    ];

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account preferences and configuration.
                </p>
            </div>

            <Tabs defaultValue="profile" className="space-y-6">
                <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
                    <TabsTrigger value="profile" className="gap-2">
                        <User className="h-4 w-4" />
                        <span className="hidden sm:inline">Profile</span>
                    </TabsTrigger>
                    <TabsTrigger value="preferences" className="gap-2">
                        <Palette className="h-4 w-4" />
                        <span className="hidden sm:inline">Preferences</span>
                    </TabsTrigger>
                    <TabsTrigger value="notifications" className="gap-2">
                        <Bell className="h-4 w-4" />
                        <span className="hidden sm:inline">Notifications</span>
                    </TabsTrigger>
                    <TabsTrigger value="api-keys" className="gap-2">
                        <Key className="h-4 w-4" />
                        <span className="hidden sm:inline">API Keys</span>
                    </TabsTrigger>
                </TabsList>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profile Information</CardTitle>
                            <CardDescription>Update your personal details and avatar.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="relative group">
                                    <Avatar className="h-20 w-20">
                                        {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile" />}
                                        <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    >
                                        <Camera className="h-5 w-5 text-white" />
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                            Change Avatar
                                        </Button>
                                        {avatarUrl && (
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemoveAvatar}>
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">JPG, PNG, GIF or WebP. Max 2MB.</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/gif,image/webp"
                                    className="hidden"
                                    onChange={handleAvatarUpload}
                                />
                            </div>

                            <Separator />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">First Name</Label>
                                    <Input id="firstName" value={firstName} onChange={e => setFirstName(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">Last Name</Label>
                                    <Input id="lastName" value={lastName} onChange={e => setLastName(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timezone">Timezone</Label>
                                <Select value={timezone} onValueChange={setTimezone}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="EST">Eastern (EST/EDT)</SelectItem>
                                        <SelectItem value="CST">Central (CST/CDT)</SelectItem>
                                        <SelectItem value="MST">Mountain (MST/MDT)</SelectItem>
                                        <SelectItem value="PST">Pacific (PST/PDT)</SelectItem>
                                        <SelectItem value="UTC">UTC</SelectItem>
                                        <SelectItem value="IST">India (IST)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleSave} disabled={saving} className="gap-2">
                                <Save className="h-4 w-4" />
                                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
                            </Button>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Password</CardTitle>
                            <CardDescription>Change your account password.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Current Password</Label>
                                <Input type="password" placeholder="••••••••" />
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>New Password</Label>
                                    <Input type="password" placeholder="••••••••" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirm New Password</Label>
                                    <Input type="password" placeholder="••••••••" />
                                </div>
                            </div>
                            <Button variant="outline">Update Password</Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Preferences Tab */}
                <TabsContent value="preferences" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Appearance</CardTitle>
                            <CardDescription>Customize the look and feel of the platform.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <Label>Theme</Label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { value: 'light', label: 'Light', icon: Sun },
                                        { value: 'dark', label: 'Dark', icon: Moon },
                                        { value: 'system', label: 'System', icon: Monitor },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setTheme(option.value)}
                                            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-smooth ${theme === option.value
                                                ? 'border-primary bg-primary/5'
                                                : 'border-border hover:border-primary/50'
                                                }`}
                                        >
                                            <option.icon className={`h-6 w-6 ${theme === option.value ? 'text-primary' : 'text-muted-foreground'}`} />
                                            <span className="text-sm font-medium">{option.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Separator />

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Default Currency</Label>
                                    <Select value={currency} onValueChange={setCurrency}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD ($)</SelectItem>
                                            <SelectItem value="EUR">EUR (€)</SelectItem>
                                            <SelectItem value="GBP">GBP (£)</SelectItem>
                                            <SelectItem value="INR">INR (₹)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Date Format</Label>
                                    <Select value={dateFormat} onValueChange={setDateFormat}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                            <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                            <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
                                Preferences are saved automatically when you make a change.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Email Notifications</CardTitle>
                            <CardDescription>Choose what email notifications you receive.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {notificationItems.map((item) => (
                                <div key={item.key} className="flex items-center justify-between rounded-lg border p-4">
                                    <div>
                                        <p className="text-sm font-medium">{item.label}</p>
                                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={notifications[item.key]}
                                            onChange={(e) => setNotification(item.key, e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                                    </label>
                                </div>
                            ))}
                            <div className="rounded-md bg-green-500/10 border border-green-500/20 p-3 text-sm text-green-600 dark:text-green-400">
                                Notification preferences are saved automatically.
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* API Keys Tab */}
                <TabsContent value="api-keys" className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>API Keys</CardTitle>
                            <CardDescription>Manage API keys for broker connections and data providers.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                                            <Shield className="h-4 w-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Alpaca Markets</p>
                                            <p className="text-xs text-muted-foreground">Paper Trading Account</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">Configure</Button>
                                </div>
                            </div>

                            <div className="rounded-lg border p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                                            <Key className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">Interactive Brokers</p>
                                            <p className="text-xs text-muted-foreground">Not connected</p>
                                        </div>
                                    </div>
                                    <Button variant="outline" size="sm">Connect</Button>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>Platform API Key</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value="tp_live_sk_••••••••••••••••••••"
                                        readOnly
                                        className="font-mono text-sm"
                                    />
                                    <Button variant="outline">Regenerate</Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Use this key to access the TradePro API programmatically.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
