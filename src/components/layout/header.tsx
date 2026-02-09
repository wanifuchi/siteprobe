'use client';

import Link from 'next/link';
import { Search, History, Users, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: '分析', icon: Search },
  { href: '/personas', label: 'ペルソナ管理', icon: Users },
  { href: '/history', label: '履歴', icon: History },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground text-sm font-bold">
            SP
          </div>
          <span className="hidden sm:inline">SiteProbe</span>
        </Link>

        {/* デスクトップナビ */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}>
              <Button variant="ghost" size="sm" className="gap-2">
                <Icon className="h-4 w-4" />
                {label}
              </Button>
            </Link>
          ))}
        </nav>

        {/* モバイルメニューボタン */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* モバイルナビ */}
      {mobileOpen && (
        <nav className="border-t bg-background md:hidden">
          <div className="mx-auto max-w-7xl px-4 py-2 flex flex-col gap-1">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
