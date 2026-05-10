'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'How it works', href: '/#how-it-works' },
  { name: 'Dashboard',    href: '/dashboard'     },
  { name: 'Demo',         href: '/demo'          },
  { name: 'Pricing',      href: '/pricing'       },
  { name: 'Docs',         href: '/docs'          },
  { name: 'Changelog',    href: '/changelog'     },
];

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto mt-3 px-4 max-w-5xl">
        <div className="flex items-center justify-between rounded-2xl px-5 py-3 border border-white/10 bg-[#030509]/85 backdrop-blur-xl shadow-xl shadow-black/50">
          <Link href="/" className="font-heading font-bold text-[15px] tracking-tight text-white">
            MaintainerOS
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href}
                className={cn(
                  'px-4 py-2 text-sm rounded-xl transition-all duration-200',
                  pathname === item.href
                    ? 'text-white bg-white/8'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5',
                )}>
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <Link href="/demo"
              className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all duration-200">
              See demo
            </Link>
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/connect"
                className="px-4 py-2 text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl shadow-lg shadow-emerald-500/20 transition-all duration-200 inline-block">
                Connect repo
              </Link>
            </motion.div>
          </div>

          <button onClick={() => setMenuOpen(!menuOpen)} className="lg:hidden p-2 rounded-xl hover:bg-white/5 transition-colors">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-2 rounded-2xl border border-white/10 bg-[#030509]/95 backdrop-blur-xl p-4 lg:hidden">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href} onClick={() => setMenuOpen(false)}
                className="block px-4 py-3 text-sm text-zinc-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors">
                {item.name}
              </Link>
            ))}
            <div className="mt-3 pt-3 border-t border-white/10">
              <Link href="/connect" className="block text-center py-2.5 text-sm font-semibold bg-emerald-500 text-black rounded-xl">
                Connect repo
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </header>
  );
}
