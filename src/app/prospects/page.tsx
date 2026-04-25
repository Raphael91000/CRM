'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import {
  getProspectsPage, updateProspect, addProspect, addAppel, deleteProspect,
  bulkDeleteProspects, bulkUpdateStatut, getDepartements, exportProspects,
  Prospect, Statut, NewProspect,
} from '@/lib/prospects'
import StatusBadge, { ALL_STATUTS, getStatutColor } from '@/components/StatusBadge'
import CallModal from '@/components/CallModal'
import AddProspectModal from '@/components/AddProspectModal'
import { useToast } from '@/components/ToastProvider'

const PAGE_SIZE = 50

type SortCol = 'nom' | 'telephone' | 'departement' | 'statut' | 'nb_tentatives' | 'derniere_relance' | 'prochaine_relance' | 'date_creation'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function localInputToISO(s: string): string | null {
  if (!s) return null
  const [datePart, timePart = '00:00'] = s.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, h || 0, min || 0).toISOString()
}

function downloadCsv(prospects: Prospect[]) {
  const headers = ['Nom', 'Telephone', 'Departement', 'Statut', 'Appels', 'Derniere relance', 'Prochaine relance', 'Note', 'Fiche Google']
  const rows = prospects.map(p => [
    p.nom, p.telephone, p.departement, p.statut,
    String(p.nb_tentatives),
    p.derniere_relance ? new Date(p.derniere_relance).toLocaleDateString('fr-FR') : '',
    p.prochaine_relance ? new Date(p.prochaine_relance).toLocaleDateString('fr-FR') : '',
    p.note ?? '',
    p.fiche_google ?? '',
  ])
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `prospects_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function SortHeader({ label, col, sort, onSort, className = '' }: {
  label: string
  col: SortCol
  sort: { col: SortCol; dir: 'asc' | 'desc' }
  onSort: (col: SortCol) => void
  className?: string
}) {
  const active = sort.col === col
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors hover:text-gray-300 ${active ? 'text-blue-400' : 'text-gray-500'} ${className}`}
    >
      {label}
      <svg className={`w-3 h-3 shrink-0 ${active ? 'text-blue-400' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
        {active && sort.dir === 'asc'
          ? <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        }
      </svg>
    </button>
  )
}

function Pagination({ page, total, limit, onChange }: {
  page: number; total: number; limit: number; onChange: (p: number) => void
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  const from = (page - 1) * limit + 1
  const to = Math.min(page * limit, total)
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <p className="text-xs text-gray-500">{from}–{to} sur {total} prospect{total > 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1.5">
        <button onClick={() => onChange(page - 1)} disabled={page === 1}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
          ← Précédent
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-300 bg-gray-800/50 border border-gray-700/50 rounded-lg">
          {page} / {totalPages}
        </span>
        <button onClick={() => onChange(page + 1)} disabled={page === totalPages}
          className="px-3 py-1.5 text-sm text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
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
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'date_creation', dir: 'desc' })
  const [filterDept, setFilterDept] = useState('')
  const [departements, setDepartements] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [modalProspect, setModalProspect] = useState<Prospect | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [bulkStatus, setBulkStatus] = useState<Statut | ''>('')
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const filterStatut = (searchParams.get('statut') as Statut | null) ?? ''
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    getDepartements().then(setDepartements).catch(() => {})
  }, [])

  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current)
    searchDebounce.current = setTimeout(() => setDebouncedSearch(search), 300)
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current) }
  }, [search])

  useEffect(() => { setPage(1); setSelected(new Set()) }, [filterStatut, debouncedSearch, filterDept, sort])

  // Auto-sort by prochaine_relance asc when viewing NRP, RDV, or À rappeler
  useEffect(() => {
    if (filterStatut === 'nrp' || filterStatut === 'rdv' || filterStatut === 'a_rappeler') {
      setSort({ col: 'prochaine_relance', dir: 'asc' })
    } else {
      setSort({ col: 'date_creation', dir: 'desc' })
    }
  }, [filterStatut])

  // Auto-reset confirm delete after 4 seconds
  useEffect(() => {
    if (!confirmDelete) return
    const t = setTimeout(() => setConfirmDelete(null), 4000)
    return () => clearTimeout(t)
  }, [confirmDelete])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getProspectsPage({
        page, limit: PAGE_SIZE,
        statut: filterStatut || undefined,
        search: debouncedSearch || undefined,
        departement: filterDept || undefined,
        orderBy: sort.col,
        orderDir: sort.dir,
      })
      setProspects(result.data)
      setCount(result.count)
    } catch {
      toast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [page, filterStatut, debouncedSearch, filterDept, sort, toast])

  useEffect(() => { load() }, [load])

  function notifyChanged() {
    window.dispatchEvent(new CustomEvent('prospects-changed'))
  }

  function setStatutFilter(val: string) {
    router.push(val ? `/prospects?statut=${val}` : '/prospects')
  }

  function toggleSort(col: SortCol) {
    setSort(prev =>
      prev.col === col
        ? { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { col, dir: 'asc' }
    )
  }

  // Selection
  const allPageIds = prospects.map(p => p.id)
  const allSelected = allPageIds.length > 0 && allPageIds.every(id => selected.has(id))
  const someSelected = allPageIds.some(id => selected.has(id)) && !allSelected
  const selectedCount = selected.size

  function toggleSelectAll() {
    setSelected(prev => {
      const s = new Set(prev)
      if (allSelected) {
        allPageIds.forEach(id => s.delete(id))
      } else {
        allPageIds.forEach(id => s.add(id))
      }
      return s
    })
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  const selectedIds = [...selected]

  // Handlers
  async function handleSaveCall(id: string, statut: Statut, note: string, prochaine: string) {
    const current = prospects.find(p => p.id === id)
    try {
      await addAppel({ prospectId: id, statut, note })
      await updateProspect(id, {
        statut,
        note: note || null,
        derniere_relance: new Date().toISOString(),
        prochaine_relance: localInputToISO(prochaine),
        nb_tentatives: statut === 'nrp' ? (current?.nb_tentatives ?? 0) + 1 : 0,
      })
      toast('Appel enregistré')
      notifyChanged()
      await load()
    } catch (err) {
      toast(`Erreur : ${String(err)}`, 'error')
      throw err
    }
  }

  async function handleAdd(data: NewProspect) {
    await addProspect(data)
    toast('Prospect ajouté')
    notifyChanged()
    await load()
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) {
      setConfirmDelete(id)
      return
    }
    setConfirmDelete(null)
    setDeleting(id)
    try {
      await deleteProspect(id)
      toast('Prospect supprimé', 'info')
      notifyChanged()
      await load()
    } finally {
      setDeleting(null)
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      await bulkDeleteProspects(selectedIds)
      toast(`${selectedCount} prospect${selectedCount > 1 ? 's' : ''} supprimé${selectedCount > 1 ? 's' : ''}`, 'info')
      setSelected(new Set())
      notifyChanged()
      await load()
    } finally {
      setBulkDeleting(false)
    }
  }

  async function handleBulkStatus() {
    if (!bulkStatus) return
    await bulkUpdateStatut(selectedIds, bulkStatus as Statut)
    toast(`${selectedCount} prospect${selectedCount > 1 ? 's' : ''} mis à jour`)
    setSelected(new Set())
    setBulkStatus('')
    notifyChanged()
    await load()
  }

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportProspects({
        statut: filterStatut || undefined,
        search: debouncedSearch || undefined,
        departement: filterDept || undefined,
      })
      downloadCsv(data)
      toast(`${data.length} prospect${data.length > 1 ? 's' : ''} exporté${data.length > 1 ? 's' : ''}`)
    } catch {
      toast("Erreur lors de l'export", 'error')
    } finally {
      setExporting(false)
    }
  }

  const GRID = 'grid-cols-[32px_1fr_130px_80px_110px_50px_90px_110px]'

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Prospects</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count} prospect{count > 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-medium rounded-xl border border-gray-700 transition-colors disabled:opacity-50">
            {exporting ? 'Export...' : 'Exporter CSV'}
          </button>
          <button onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors">
            + Ajouter
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou téléphone..."
            className="w-full bg-[#111827] border border-gray-700/50 rounded-xl pl-4 pr-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <select value={filterStatut} onChange={e => setStatutFilter(e.target.value)}
          className="bg-[#111827] border border-gray-700/50 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]">
          <option value="">Tous les statuts</option>
          {ALL_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {departements.length > 0 && (
          <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
            className="bg-[#111827] border border-gray-700/50 rounded-xl px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500/50 transition-colors [color-scheme:dark]">
            <option value="">Tous les départements</option>
            {departements.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {(filterStatut || search || filterDept) && (
          <button onClick={() => { setSearch(''); setFilterDept(''); setStatutFilter('') }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-300 border border-gray-700/50 rounded-xl transition-colors">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Barre d'actions groupées */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 bg-blue-600/10 border border-blue-500/20 rounded-xl px-4 py-3">
          <span className="text-sm font-medium text-blue-400 shrink-0">
            {selectedCount} sélectionné{selectedCount > 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as Statut | '')}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none [color-scheme:dark]">
              <option value="">Changer le statut...</option>
              {ALL_STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {bulkStatus && (
              <button onClick={handleBulkStatus}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg transition-colors">
                Appliquer
              </button>
            )}
            <button onClick={handleBulkDelete} disabled={bulkDeleting}
              className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 text-red-400 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50">
              {bulkDeleting ? 'Suppression...' : `Supprimer (${selectedCount})`}
            </button>
            <button onClick={() => setSelected(new Set())}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors px-2">
              Annuler
            </button>
          </div>
        </div>
      )}

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
            {/* En-têtes */}
            <div className={`grid ${GRID} gap-3 px-5 py-3 border-b border-gray-800`}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected }}
                onChange={toggleSelectAll}
                className="w-4 h-4 mt-0.5 rounded border-gray-600 accent-blue-500 cursor-pointer"
              />
              <SortHeader label="Nom" col="nom" sort={sort} onSort={toggleSort} />
              <SortHeader label="Téléphone" col="telephone" sort={sort} onSort={toggleSort} />
              <SortHeader label="Dépt" col="departement" sort={sort} onSort={toggleSort} />
              <SortHeader label="Statut" col="statut" sort={sort} onSort={toggleSort} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Appels</span>
              {filterStatut === 'nrp' || filterStatut === 'rdv' || filterStatut === 'a_rappeler'
                ? <SortHeader label="Prochain appel" col="prochaine_relance" sort={sort} onSort={toggleSort} />
                : <SortHeader label="Dernière" col="derniere_relance" sort={sort} onSort={toggleSort} />
              }
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</span>
            </div>

            {/* Lignes */}
            <div className="divide-y divide-gray-800/60">
              {prospects.map(p => {
                const isSelected = selected.has(p.id)
                const isConfirming = confirmDelete === p.id
                return (
                  <div
                    key={p.id}
                    className={`grid ${GRID} gap-3 px-5 py-3.5 items-center transition-colors group ${isSelected ? 'bg-blue-600/5' : 'hover:bg-gray-800/20'}`}
                    style={{ borderLeft: `3px solid ${getStatutColor(p.statut)}` }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(p.id)}
                      className="w-4 h-4 rounded border-gray-600 accent-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-white truncate">{p.nom}</p>
                        {p.fiche_google && (
                          <a href={p.fiche_google} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-medium transition-colors">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Fiche
                          </a>
                        )}
                      </div>
                      {p.note && <p className="text-xs text-gray-600 truncate mt-0.5">{p.note}</p>}
                    </div>
                    <a href={`tel:${p.telephone.replace(/\s/g, '')}`}
                      className="text-sm text-gray-400 hover:text-blue-400 transition-colors truncate"
                      onClick={e => e.stopPropagation()}>
                      {p.telephone}
                    </a>
                    <span className="text-xs text-gray-500 truncate">{p.departement || '—'}</span>
                    <StatusBadge statut={p.statut} />
                    <span className="text-sm text-gray-500 text-center">{p.nb_tentatives}</span>
                    {(() => {
                      const showProchaine = p.statut === 'nrp' || p.statut === 'rdv' || p.statut === 'a_rappeler'
                      if (!showProchaine) return <span className="text-xs text-gray-600">{formatDate(p.derniere_relance)}</span>
                      if (!p.prochaine_relance) return <span className="text-xs text-gray-700">—</span>
                      const d = new Date(p.prochaine_relance)
                      const isToday = d.toDateString() === new Date().toDateString()
                      const isPast = d < new Date()
                      const color = p.statut === 'rdv'
                        ? (isPast ? 'text-orange-400' : isToday ? 'text-green-400' : 'text-green-500')
                        : p.statut === 'a_rappeler'
                          ? (isPast || isToday ? 'text-orange-400' : 'text-cyan-400')
                          : (isPast || isToday ? 'text-orange-400' : 'text-gray-400')
                      return (
                        <span className={`text-xs font-medium ${color}`}>
                          {isToday ? "Aujourd'hui " : ''}{d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )
                    })()}
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => setModalProspect(p)}
                        className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-lg transition-all shrink-0">
                        Statut
                      </button>
                      {isConfirming ? (
                        <div className="flex items-center gap-1 shrink-0">
                          <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                            className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
                            Oui
                          </button>
                          <button onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors">
                            Non
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                          className="p-1.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                          title="Supprimer">
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Pagination page={page} total={count} limit={PAGE_SIZE} onChange={setPage} />
        </>
      )}

      {modalProspect && (
        <CallModal prospect={modalProspect} onClose={() => setModalProspect(null)} onSave={handleSaveCall} />
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
