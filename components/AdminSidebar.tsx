'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Settings,
    FolderTree,
    LogOut,
    Settings2,
    Calculator,
    Globe,
} from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';

const overviewItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
];

const workItems = [
    { name: 'Projects', href: '/admin/configuration', icon: FolderTree },
    { name: 'Budget App Leads', href: '/admin/budget-app-leads', icon: Calculator },
    { name: 'Website Leads', href: '/admin/website-leads', icon: Globe },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
];

export default function AdminSidebar() {
    const pathname = usePathname();
    const { data: session } = useSession();

    const user = session?.user;
    const initials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'AD';

    const NavItem = ({ item }: { item: { name: string; href: string; icon: React.ElementType } }) => {
        const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
        return (
            <Link
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 ${isActive
                        ? 'bg-white text-[#d4503a] shadow-sm'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
            >
                <item.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-[#d4503a]' : 'text-white/70'}`} />
                {item.name}
            </Link>
        );
    };

    return (
        <div
            className="flex h-screen w-64 flex-col"
            style={{ backgroundColor: '#c0392b' }}
        >
            {/* Logo Section */}
            <div className="px-6 pt-8 pb-6">
                <h1
                    className="text-2xl font-bold tracking-tight text-white"
                    style={{ fontFamily: 'var(--font-brand, "Playfair Display", serif)' }}
                >
                    Talentronaut
                </h1>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/50">
                    Admin Workspace
                </p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                {/* Overview */}
                <div>
                    <p className="mb-2 px-4 text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
                        Overview
                    </p>
                    <div className="space-y-1">
                        {overviewItems.map((item) => (
                            <NavItem key={item.href} item={item} />
                        ))}
                    </div>
                </div>

                {/* Work */}
                <div>
                    <p className="mb-2 px-4 text-[9px] font-black uppercase tracking-[0.22em] text-white/40">
                        Work
                    </p>
                    <div className="space-y-1">
                        {workItems.map((item) => (
                            <NavItem key={item.href} item={item} />
                        ))}
                    </div>
                </div>
            </nav>

            {/* User Profile Footer */}
            <div className="px-4 pb-6 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs border-2 border-white/30 shrink-0">
                            {initials}
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white truncate">
                                {user?.name || 'Admin'}
                            </p>
                            <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wide">
                                Admin
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/10 hover:text-white transition-all"
                        title="Sign Out"
                    >
                        <Settings2 className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
