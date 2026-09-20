'use client';
import React, { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Podcast, Menu, X, Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import PeerTubeFiltersComp, { PeerTubeFiltersRef } from '@/components/PeerTube/PeerTubeFilters';
import SearchInput from '@/components/SearchInput';

export default function Navbar() {
  const t = useTranslations('navbar');
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const peertubeFiltersRef = useRef<PeerTubeFiltersRef | null>(null);
  const [isPeertubeFiltersOpen, setIsPeertubeFiltersOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 切换语言（保持当前路径，仅替换语言前缀）
  const switchLocale = (locale: string) => {
    router.replace(pathname, { locale });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const themeLabel = resolvedTheme === 'dark' ? t('switchToLight') : t('switchToDark');

  return (
    <nav className="bg-white dark:bg-gray-900 dark:border-b dark:border-gray-800 shadow-sm sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
<div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center">
                  <Podcast className="text-gray-600 dark:text-gray-400 text-2xl mr-2" aria-hidden="true" />
                  <span className="font-semibold text-xl">{t('brand')}</span>
                </Link>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                {[ 
                  { href: '/', key: 'browse', exact: true, label: t('browse') },
                  { href: '/live', key: 'live', exact: false, label: t('live') },
                  { href: '/peertube', key: 'peertube', exact: false, label: t('peertube') },
                  { href: '/favorites', key: 'favorites', exact: false, label: t('favorites') },
                ].map(({ href, key, exact, label }) => (
                  <Link 
                    key={key}
                    href={href}
                    className={`
                      ${exact ? (pathname === href ? 'border-indigo-500' : 'border-transparent') : 
                        (pathname?.startsWith(href) ? 'border-indigo-500' : 'border-transparent')}
                      text-gray-900 dark:text-gray-100 hover:border-gray-300 dark:hover:border-gray-700 hover:text-gray-700 dark:hover:text-gray-200 
                      inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium
                    `}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          {/* 桌面端右侧控件 */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-4">
            <SearchInput
              peertubeFiltersRef={peertubeFiltersRef}
              onPeertubeFiltersOpenChange={setIsPeertubeFiltersOpen}
            />

            {/* 主题切换 */}
            <button
              onClick={toggleTheme}
              aria-label={themeLabel}
              title={themeLabel}
              className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>

            {/* 语言切换 */}
            <div className="flex items-center space-x-1 text-sm font-medium">
              <button
                onClick={() => switchLocale('zh')}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                中
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={() => switchLocale('en')}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                EN
              </button>
            </div>
          </div>
          {/* 移动端汉堡菜单按钮 */}
          <div className="flex items-center sm:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* 移动端下拉菜单 */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-800">
          <div className="px-4 pt-2 pb-3 space-y-1">
            {[ 
              { href: '/', key: 'browse', exact: true, label: t('browse') },
              { href: '/live', key: 'live', exact: false, label: t('live') },
              { href: '/peertube', key: 'peertube', exact: false, label: t('peertube') },
              { href: '/favorites', key: 'favorites', exact: false, label: t('favorites') },
            ].map(({ href, key, exact, label }) => (
              <Link
                key={key}
                href={href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`
                  ${exact ? (pathname === href ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500' : 'border-transparent') :
                    (pathname?.startsWith(href) ? 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-500' : 'border-transparent')}
                  block pl-3 pr-4 py-2 border-l-4 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50
                `}
              >
                {label}
              </Link>
            ))}
          </div>
          <div className="px-4 pb-3 border-t border-gray-200 dark:border-gray-800 pt-3 space-y-3">
            <SearchInput
              peertubeFiltersRef={peertubeFiltersRef}
              onPeertubeFiltersOpenChange={setIsPeertubeFiltersOpen}
            />
            <div className="flex items-center space-x-1 text-sm font-medium">
              <button
                onClick={toggleTheme}
                aria-label={themeLabel}
                title={themeLabel}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                {resolvedTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button
                onClick={() => switchLocale('zh')}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                中
              </button>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <button
                onClick={() => switchLocale('en')}
                className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              >
                EN
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}