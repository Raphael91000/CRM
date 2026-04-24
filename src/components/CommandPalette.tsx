'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getProspects, updateProspect, addAppel, Prospect, Statut } from '@/lib/prospects'
import { getStatutColor, getStatutConfig } from './StatusBadge'
import CallModal from './CallModal'
import { useToast } from './ToastProvider'

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const openPalette = useCallback(async () => {
    setOpen(true)
    setQuery('')
    setCursor(0)
    setLoading(true)
    setTimeout(() => inputRef.current?.focus(), 0)
    try {
      setProspects(await getProspects())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) setOpen(false)
        else openPalette()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, openPalette])

  const q = query.toLowerCase().trim()
  const results = q
    ? prospects.filter(p =>
        p.nom.toLowerCase().includes(q) ||
        p.telephone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      ).slice(0, 8)
    : prospects.slice(0, 8)

  useEffect(() => { setCursor(0) }, [query])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); return }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setCursor(c => Math.min(c + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setCursor(c => Math.max(c - 1, 0))
      }
      if (e.key === 'Enter' && results[cursor]) {
        setSelected(results[cursor])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, cursor, results])

  // Scroll focused item into view
  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  async function handleSaveCall(id: string, statut: Statut, note: string, prochaine: string) {
    const current = prospects.find(p => p.id === id)
    await Promise.all([
      updateProspect(id, {
        statut,
        note: note || null,
        derniere_relance: new Date().toISOString(),
        prochaine_relance: prochaine ? new Date(prochaine).toISOString() : null,
        nb_tentatives: statut === 'nrp' ? (current?.nb_tentatives ?? 0) + 1 : 0,
      }),
      addAppel({ prospectId: id, statut, note }),
    ])
    toast('Appel enregistré')
    // Refresh local list
    setProspects(prev => prev.map(p =>
      p.id === id ? { ...p, statut, nb_tentatives: (p.nb_tentatives ?? 0) + 1 } : p
    ))
    window.dispatchEvent(new CustomEvent('prospects-changed'))
  }

  if (!open && !selected) return null

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[15vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-[#111827] border border-gray-700/60 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-800">
              <svg className="w-4 h-4 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Rechercher un prospect..."
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
              />
              <kbd className="text-[10px] text-gray-600 font-mono border border-gray-700 rounded px-1.5 py-0.5">Échap</kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
              {loading ? (
                <p className="text-sm text-gray-600 text-center py-8">Chargement...</p>
              ) : results.length === 0 ? (
                <p className="text-sm text-gray-600 text-center py-8">Aucun résultat</p>
              ) : results.map((p, i) => {
                const color = getStatutColor(p.statut)
                const cfg = getStatutConfig(p.statut)
                const nb = p.nb_tentatives ?? 0
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelected(p); setOpen(false) }}
                    onMouseEnter={() => setCursor(i)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === cursor ? 'bg-gray-800/80' : 'hover:bg-gray-800/40'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{p.nom}</span>
                        {nb > 0 && (
                          <span className="text-[10px] font-bold text-orange-400 shrink-0">NRP×{nb}</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{p.telephone}</span>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0"
                      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                    >
                      {cfg.label}
                    </span>
                    {i === cursor && (
                      <kbd className="text-[10px] text-gray-600 font-mono border border-gray-700 rounded px-1 py-0.5 shrink-0">↵</kbd>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-4 text-[10px] text-gray-600">
              <span><kbd className="font-mono">↑↓</kbd> naviguer</span>
              <span><kbd className="font-mono">↵</kbd> ouvrir</span>
              <span><kbd className="font-mono">Échap</kbd> fermer</span>
              <span className="ml-auto">{results.length} résultat{results.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CallModal
          prospect={selected}
          onClose={() => setSelected(null)}
          onSave={handleSaveCall}
        />
      )}
    </>
  )
}
