'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
    LayoutDashboard,
    PlayCircle,
    BookOpen,
    BarChart3,
    BookMarked,
    Calculator,
    Settings,
    Menu,
    X,
    LogOut,
    Moon,
    Sun,
    Bell,
    Search,
    TrendingUp,
    UserCircle,
    User,
    CreditCard,
    HelpCircle,
    Keyboard,
    Newspaper,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/hooks/useAuth';
import { useUserPreferences } from '@/lib/stores/userPreferencesStore';
import CommandPalette from './CommandPalette';

const navigation = [
    { name: 'Overview', href: '/overview', icon: LayoutDashboard },
    { name: 'Accounts', href: '/accounts', icon: UserCircle },
    { name: 'Backtesting', href: '/backtesting', icon: PlayCircle },
    { name: 'Journal', href: '/journal', icon: BookOpen },
    { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    { name: 'Playbooks', href: '/playbooks', icon: BookMarked },
    { name: 'Calculators', href: '/calculators', icon: Calculator },
    { name: 'News', href: '/news', icon: Newspaper },
    { name: 'Settings', href: '/settings', icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname();
    const { avatarUrl } = useUserPreferences();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    return (
        <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                    <TrendingUp className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-lg font-bold gradient-text">TradePro</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            onClick={onNavigate}
                            className={`
                flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-smooth
                ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-md'
                                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                }
              `}
                        >
                            <item.icon className="h-5 w-5" />
                            {item.name}
                            {item.name === 'Backtesting' && (
                                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                                    Beta
                                </Badge>
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Theme toggle + User */}
            <div className="border-t border-border p-4 space-y-3">
                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-smooth"
                >
                    {mounted ? (
                        <>
                            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </>
                    ) : (
                        <>
                            <Sun className="h-4 w-4" />
                            <span>Light Mode</span>
                        </>
                    )}
                </button>

                <div className="flex items-center gap-3 rounded-lg px-3 py-2">
                    <Avatar className="h-8 w-8">
                        {avatarUrl && <AvatarImage src={avatarUrl} alt="User avatar" />}
                        <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                            {user?.displayName
                                ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                : ((user?.firstName?.[0] || 'G') + (user?.lastName?.[0] || 'U')).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                            {user?.displayName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Guest User')}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{user?.email || 'guest@demo.com'}</p>
                    </div>
                    <button
                        onClick={logout}
                        className="text-muted-foreground hover:text-foreground transition-smooth"
                    >
                        <LogOut className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const { avatarUrl } = useUserPreferences();
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Global Ctrl+K / Cmd+K shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen((v) => !v);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    return (
        <div className="flex h-screen bg-background">
            {/* Desktop Sidebar */}
            <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-sidebar">
                <SidebarContent />
            </aside>

            {/* Main Content */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Top bar — mobile */}
                <header className="flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6">
                    {/* Mobile menu */}
                    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                        <SheetTrigger asChild className="md:hidden">
                            <Button variant="ghost" size="icon">
                                {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="w-64 p-0" id="mobile-sidebar-sheet">
                            <SidebarContent onNavigate={() => setMobileOpen(false)} />
                        </SheetContent>
                    </Sheet>

                    {/* Search — opens command palette */}
                    <div className="flex-1 md:max-w-md">
                        <button
                            onClick={() => setSearchOpen(true)}
                            className="flex w-full items-center gap-2 rounded-lg border border-input bg-background py-2 pl-3 pr-2 text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
                        >
                            <Search className="h-4 w-4 shrink-0" />
                            <span className="flex-1 text-left">Search trades, instruments...</span>
                            <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
                                Ctrl K
                            </kbd>
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Bell className="h-5 w-5" />
                                    <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                                        3
                                    </span>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-80" id="notifications-dropdown">
                                <div className="px-3 py-2 font-semibold text-sm">Notifications</div>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                                    <span className="text-sm font-medium">Backtest completed</span>
                                    <span className="text-xs text-muted-foreground">ES Futures Strategy finished — 65.2% win rate</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                                    <span className="text-sm font-medium">New insight available</span>
                                    <span className="text-xs text-muted-foreground">Your morning sessions perform 23% better</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem className="flex flex-col items-start gap-1 py-3">
                                    <span className="text-sm font-medium">Weekly report ready</span>
                                    <span className="text-xs text-muted-foreground">View your performance summary for this week</span>
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="hidden md:block">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="relative flex items-center gap-2 px-2">
                                        <Avatar className="h-8 w-8">
                                            {avatarUrl && <AvatarImage src={avatarUrl} alt="User avatar" />}
                                            <AvatarFallback className="bg-primary/20 text-primary text-xs font-semibold">
                                                {user?.displayName
                                                    ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                                    : ((user?.firstName?.[0] || 'G') + (user?.lastName?.[0] || 'U')).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64" id="profile-dropdown">
                                    {/* User info header */}
                                    <DropdownMenuLabel className="font-normal">
                                        <div className="flex items-center gap-3 py-1">
                                            <Avatar className="h-10 w-10">
                                                {avatarUrl && <AvatarImage src={avatarUrl} alt="User avatar" />}
                                                <AvatarFallback className="bg-primary/20 text-primary text-sm font-semibold">
                                                    {user?.displayName
                                                        ? user.displayName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                                                        : ((user?.firstName?.[0] || 'G') + (user?.lastName?.[0] || 'U')).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex flex-col min-w-0">
                                                <p className="text-sm font-semibold truncate">
                                                    {user?.displayName || (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : 'Guest User')}
                                                </p>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {user?.email || 'guest@demo.com'}
                                                </p>
                                            </div>
                                        </div>
                                    </DropdownMenuLabel>

                                    <DropdownMenuSeparator />

                                    {/* Profile link */}
                                    <DropdownMenuItem asChild>
                                        <Link href="/settings" className="flex items-center gap-2 cursor-pointer">
                                            <User className="h-4 w-4" />
                                            Profile Settings
                                        </Link>
                                    </DropdownMenuItem>

                                    {/* Accounts */}
                                    <DropdownMenuItem asChild>
                                        <Link href="/accounts" className="flex items-center gap-2 cursor-pointer">
                                            <CreditCard className="h-4 w-4" />
                                            Trading Accounts
                                        </Link>
                                    </DropdownMenuItem>

                                    {/* Analytics */}
                                    <DropdownMenuItem asChild>
                                        <Link href="/analytics" className="flex items-center gap-2 cursor-pointer">
                                            <BarChart3 className="h-4 w-4" />
                                            Analytics
                                        </Link>
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    {/* Theme toggle */}
                                    <DropdownMenuItem
                                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                        className="flex items-center gap-2 cursor-pointer"
                                    >
                                        {mounted && theme === 'dark' ? (
                                            <Sun className="h-4 w-4" />
                                        ) : (
                                            <Moon className="h-4 w-4" />
                                        )}
                                        {mounted && theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                                    </DropdownMenuItem>

                                    {/* Keyboard shortcuts */}
                                    <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                                        <Keyboard className="h-4 w-4" />
                                        Keyboard Shortcuts
                                        <span className="ml-auto text-xs text-muted-foreground">⌘K</span>
                                    </DropdownMenuItem>

                                    {/* Help */}
                                    <DropdownMenuItem className="flex items-center gap-2 cursor-pointer">
                                        <HelpCircle className="h-4 w-4" />
                                        Help &amp; Support
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />

                                    {/* Sign out */}
                                    <DropdownMenuItem
                                        onClick={logout}
                                        className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Sign Out
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                </main>

                {/* Command palette / search dialog */}
                <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
            </div>
        </div>
    );
}
