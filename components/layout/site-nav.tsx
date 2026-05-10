'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const navItems = [
  { name: 'Product', href: '/#product' },
  { name: 'Dashboard', href: '/vercel/next.js' },
  { name: 'Pricing',      href: '/pricing'       },
  { name: 'Docs',         href: '/docs'          },
  { name: 'Changelog',    href: '/changelog'     },
];

export function SiteNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-4">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="mx-auto mt-4 max-w-[1040px]">
        <div className="flex items-center justify-between rounded-lg border border-[#F9F7F7]/12 bg-black/70 px-3 py-2 shadow-2xl shadow-black/35 backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-2 px-2">
            <Image src="/MaintainerOS.png" alt="MaintainerOS" width={32} height={32} className="h-8 w-auto" priority />
            <span className="text-[15px] font-semibold tracking-tight text-white">MaintainerOS</span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm transition-colors duration-150',
                  pathname === item.href || (item.href === '/#product' && pathname === '/')
                    ? 'bg-[#F9F7F7]/10 text-white'
                    : 'text-[#F9F7F7]/62 hover:bg-[#F9F7F7]/7 hover:text-white',
                )}>
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link href="/connect"
                className="inline-block rounded-md bg-[#3F72AF] px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-[#3F72AF]/20 transition-colors duration-150 hover:bg-[#F9F7F7]">
                Connect repo
              </Link>
            </motion.div>
          </div>

          <button
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md p-2 text-[#F9F7F7]/80 transition-colors hover:bg-[#F9F7F7]/7 hover:text-white lg:hidden">
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="mt-2 rounded-lg border border-[#F9F7F7]/12 bg-black/90 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl lg:hidden">
            {navItems.map((item) => (
              <Link key={item.name} href={item.href} onClick={() => setMenuOpen(false)}
                className="block rounded-md px-3 py-3 text-sm text-[#F9F7F7]/75 transition-colors hover:bg-[#F9F7F7]/7 hover:text-white">
                {item.name}
              </Link>
            ))}
            <div className="mt-2 border-t border-[#F9F7F7]/12 pt-2">
              <Link href="/connect" className="block rounded-md bg-[#3F72AF] py-2.5 text-center text-sm font-semibold text-black">
                Connect repo
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </header>
  );
}
