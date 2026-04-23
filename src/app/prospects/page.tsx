'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import {
  getProspectsPage, updateProspect, addProspect, deleteProspect,
  Prospect, Statut, NewProspect,
} from '@/lib/prospects'
import StatusBadge, { ALL_STATUTS, getStatutColor } from '@/components/StatusBadge'
import CallModal from '@/components/CallModal'
import AddProspectModal from '@/components/AddProspectModal'
import { useToast } from '@/components/ToastProvider'

const PAGE_SIZE = 50

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function Pagination({ page, total, limit, onChange }: {
  page: number
  total: number
  limit: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between py-3 px-1">
      <p className="text-xs text-gray-500">
        {from}–{to} sur {total} prospect{total > 1 ? 's' : ''}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← Précédent
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-lg">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Suivant →
        </button>
      </div>
    </div>
  )
}

function ProspectsInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const [prospects, setProspects] = useState<Prospect[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const filterStatut = (searchParams.get('statut') as Statut | null) ?? ''
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filterStatut, debouncedSearch])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getProspectsPage({
        page,
        limit: PAGE_SIZE,
        statut: filterStatut || undefined,
        search: debouncedSearch || undefined,
      })
      setProspects(result.data)
      setCount(result.count)
    } catch {
      toast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, filterStatut, debouncedSearch, toast])

  useEffect(() => { load() }, [load])

  function setStatutFilter(val: string) {
    router.push(val ? `/prospects?statut=${val}` : '/prospects')
  }

  async function handleSaveCall(id: string, statut: Statut, note: string, prochaine: string) {
    const current = prospects.find(p => p.id === id)
    await updateProspect(id, {
      statut,
      note: note || null,
      derniere_relance: new Date().toISOString(),
      prochaine_relance: prochaine ? new Date(prochaine).toISOString() : null,
      nb_tentatives: (current?.nb_tentatives ?? 0) + 1,
    })
    toast('Appel enregistre')
    await load()
  }

  async function handleAdd(data: NewProspect) {
    await addProspect(data)
    toast('Prospect ajoute')
    await load()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await deleteProspect(id)
      toast('Prospect supprime', 'info')
      await load()
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {count} prospect{count > 1 ? 's' : ''} au total
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + Ajouter
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom..."
            className="w-full bg-[#111827] border border-gray-700/50 rounded-xl pl-4 pr-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        <select
          value={filterStatut}
          onChange={e => setStatutFilter(e.target.value)}
          className="bg-[#111827] border border-gray-700/50 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]"
        >
          <option value="">Tous les statuts</option>
          {ALL_STATUTS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        {(filterStatut || search) && (
          <button
            onClick={() => { setSearch(''); setStatutFilter('') }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-300 border border-gray-700/50 rounded-xl transition-colors"
          >
            Reinitialiser
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <svg className="animate-spin w-6 h-6 text-gray-600" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : prospects.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg">Aucun prospect</p>
          <p className="text-sm mt-1">Modifiez vos filtres ou ajoutez un prospect</p>
        </div>
      ) : (
        <>
          <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden">
            <div className="grid grid-cols-[1fr_150px_110px_60px_100px_80px_90px] gap-3 px-5 py-3 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <span>Nom</span>
              <span>Telephone</span>
              <span>Statut</span>
              <span className="text-center">Appels</span>
              <span>Derniere</span>
              <span className="text-center">Fiche</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-gray-800/60">
              {prospects.map(p => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_150px_110px_60px_100px_80px_90px] gap-3 px-5 py-3.5 items-center hover:bg-gray-800/20 transition-colors group"
                  style={{ borderLeft: `3px solid ${getStatutColor(p.statut)}` }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{p.nom}</p>
                    {p.note && <p className="text-xs text-gray-600 truncate mt-0.5">{p.note}</p>}
                  </div>
                  <a
                    href={`tel:${p.telephone.replace(/\s/g, '')}`}
                    className="text-sm text-gray-400 hover:text-blue-400 transition-colors"
                    onClick={e => e.stopPropagation()}
                  >
                    {p.telephone}
                  </a>
                  <StatusBadge statut={p.statut} />
                  <span className="text-sm text-gray-500 text-center">{p.nb_tentatives}</span>
                  <span className="text-xs text-gray-600">{formatDate(p.derniere_relance)}</span>
                  <div className="flex justify-center">
                    {p.fiche_google ? (
                      <a
                        href={p.fiche_google}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1 px-2 py-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 text-xs font-medium rounded-lg transition-all"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Maps
                      </a>
                    ) : (
                      <span className="text-xs text-gray-700">—</span>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setSelected(p)}
                      className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Statut
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="p-1.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      title="Supprimer"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Pagination page={page} total={count} limit={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {/* Modals */}
      {selected && (
        <CallModal prospect={selected} onClose={() => setSelected(null)} onSave={handleSaveCall} />
      )}
      {showAdd && (
        <AddProspectModal onClose={() => setShowAdd(false)} onAdd={handleAdd} />
      )}
    </div>
  )
}

export default function ProspectsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full min-h-96 text-gray-600">
        Chargement...
      </div>
    }>
      <ProspectsInner />
    </Suspense>
  )
}
