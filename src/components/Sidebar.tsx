'use client'

import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Statut } from '@/lib/prospects'
import { SIDEBAR_CATEGORIES, getStatutColor } from './StatusBadge'

type Counts = Record<string, number>

const BOTTOM_NAV = [
  { href: '/fichiers',  label: 'Fichiers' },
  { href: '/stats',    label: 'Stats' },
  { href: '/settings', label: 'Parametres' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [counts, setCounts] = useState<Counts>({})
  const [prospectsOpen, setProspectsOpen] = useState(pathname === '/prospects')

  useEffect(() => {
    if (pathname === '/prospects') setProspectsOpen(true)
  }, [pathname])

  useEffect(() => {
    async function fetchCounts() {
      const { data } = await supabase.from('prospects').select('statut')
      if (!data) return
      const c: Counts = { total: data.length }
      for (const row of data) {
        c[row.statut] = (c[row.statut] ?? 0) + 1
      }
      setCounts(c)
    }
    fetchCounts()
  }, [])

  const activeStatut = searchParams.get('statut')
  const isProspectsRoute = pathname === '/prospects'

  function navigate(statut: Statut | null) {
    if (statut) {
      router.push(`/prospects?statut=${statut}`)
    } else {
      router.push('/prospects')
    }
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col h-full bg-[#111827] border-r border-gray-800">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">CC</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Cold Call</p>
            <p className="text-xs text-gray-600 mt-0.5">CRM</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">

        {/* Dashboard */}
        <Link
          href="/"
          className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === '/'
              ? 'bg-blue-600/15 text-blue-400 font-medium'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
          }`}
        >
          Dashboard
        </Link>

        {/* Prospects dropdown */}
        <div>
          <button
            onClick={() => setProspectsOpen(o => !o)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
              isProspectsRoute
                ? 'bg-blue-600/15 text-blue-400 font-medium'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <span>Prospects</span>
            <span className="flex items-center gap-1.5">
              <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                isProspectsRoute ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-500'
              }`}>
                {counts.total ?? 0}
              </span>
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${prospectsOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </button>

          {prospectsOpen && (
            <div className="mt-0.5 ml-3 pl-2.5 border-l border-gray-800 space-y-0.5 py-0.5">
              {SIDEBAR_CATEGORIES.map(cat => {
                const count = cat.statut === null ? (counts.total ?? 0) : (counts[cat.statut] ?? 0)
                const isActive =
                  isProspectsRoute &&
                  (cat.statut === null ? !activeStatut : activeStatut === cat.statut)

                return (
                  <button
                    key={cat.statut ?? 'all'}
                    onClick={() => navigate(cat.statut)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 font-medium'
                        : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/60'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {cat.statut && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getStatutColor(cat.statut) }}
                        />
                      )}
                      {cat.label}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${
                      isActive ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-800 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Bottom nav */}
        <div className="pt-3">
          <p className="px-3 mb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
            Navigation
          </p>
          {BOTTOM_NAV.map(item => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-600/15 text-blue-400 font-medium'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-gray-800">
        <p className="text-xs text-gray-700">v1.0 · Supabase</p>
      </div>
    </aside>
  )
}
