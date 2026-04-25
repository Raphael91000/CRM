'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { getProspects, Prospect, Statut } from '@/lib/prospects'
import { getStatutConfig } from '@/components/StatusBadge'
import { useToast } from '@/components/ToastProvider'

// ── Period helpers ────────────────────────────────────────────────────────────

type Period = 'day' | 'week' | 'month' | 'year'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'day',   label: 'Jour' },
  { value: 'week',  label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'year',  label: 'Annee' },
]

function periodStart(period: Period): Date {
  const now = new Date()
  if (period === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  }
  if (period === 'week') {
    const d = new Date(now)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return new Date(now.getFullYear(), 0, 1)
}

// Statuts qui résultent d'un vrai appel cold call (pas d'une action post-RDV)
const CALL_STATUTS: Statut[] = ['nrp', 'a_rappeler', 'pas_interesse', 'deja_site', 'rdv']

function filterByPeriod(prospects: Prospect[], period: Period): Prospect[] {
  const start = periodStart(period)
  return prospects.filter(p => p.derniere_relance && new Date(p.derniere_relance) >= start)
}

type BarItem = { label: string; value: number; prospects: Prospect[] }

function buildBarData(prospects: Prospect[], period: Period): BarItem[] {
  const now = new Date()

  if (period === 'day') {
    return Array.from({ length: 24 }, (_, h) => {
      const ps = prospects.filter(p => p.derniere_relance && new Date(p.derniere_relance).getHours() === h)
      return { label: `${h}h`, value: ps.length, prospects: ps }
    })
  }

  if (period === 'week') {
    const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(periodStart('week'))
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().slice(0, 10)
      const ps = prospects.filter(p => p.derniere_relance?.startsWith(iso))
      return { label: DAY_NAMES[i], value: ps.length, prospects: ps }
    })
  }

  if (period === 'month') {
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${day}`
      const ps = prospects.filter(p => p.derniere_relance?.startsWith(prefix))
      return { label: String(i + 1), value: ps.length, prospects: ps }
    })
  }

  const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec']
  return Array.from({ length: 12 }, (_, m) => {
    const prefix = `${now.getFullYear()}-${String(m + 1).padStart(2, '0')}`
    const ps = prospects.filter(p => p.derniere_relance?.startsWith(prefix))
    return { label: MONTH_NAMES[m], value: ps.length, prospects: ps }
  })
}

// ── Charts ────────────────────────────────────────────────────────────────────

function BarChart({ data, onSelect, selectedLabel }: {
  data: BarItem[]
  onSelect: (item: BarItem) => void
  selectedLabel: string | null
}) {
  const max = Math.max(...data.map(d => d.value), 1)
  const showEvery = data.length > 15 ? Math.ceil(data.length / 12) : 1

  return (
    <div className="flex items-end justify-between gap-1 h-36">
      {data.map((d, i) => {
        const isSelected = selectedLabel === d.label
        return (
          <div
            key={d.label}
            onClick={() => d.value > 0 && onSelect(d)}
            className={`flex flex-col items-center gap-1 flex-1 h-full min-w-0 ${d.value > 0 ? 'cursor-pointer' : ''}`}
          >
            {d.value > 0 && (
              <span className={`text-[10px] ${isSelected ? 'text-blue-400 font-bold' : 'text-gray-500'}`}>{d.value}</span>
            )}
            <div className="w-full flex flex-col justify-end flex-1">
              <div
                className={`w-full rounded-t transition-colors ${
                  isSelected ? 'bg-blue-400' : d.value > 0 ? 'bg-blue-600/80 hover:bg-blue-500' : 'bg-transparent'
                }`}
                style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? '3px' : '0' }}
              />
            </div>
            {i % showEvery === 0 && (
              <span className={`text-[10px] truncate w-full text-center ${isSelected ? 'text-blue-400 font-semibold' : 'text-gray-600'}`}>
                {d.label}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

const DONUT_COLORS: Partial<Record<Statut, string>> = {
  nouveau:       '#3b82f6',
  nrp:           '#f97316',
  a_rappeler:    '#38bdf8',
  rdv:           '#10b981',
  demo_envoyee:  '#8b5cf6',
  pas_interesse: '#6b7280',
  deja_site:     '#52525b',
  close:         '#34d399',
}

function DonutChart({ data }: { data: { statut: Statut; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    return <div className="flex items-center justify-center w-36 h-36 text-gray-600 text-sm">Aucune donnee</div>
  }
  const r = 52, cx = 70, cy = 70
  const circ = 2 * Math.PI * r
  let offset = 0

  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      {data.filter(d => d.value > 0).map((d, i) => {
        const pct = d.value / total
        const dash = pct * circ
        const cur = offset
        offset += dash
        return (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={DONUT_COLORS[d.statut] ?? '#374151'}
            strokeWidth="18"
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeDashoffset={-cur}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )
      })}
      <text x={cx} y={cy - 5} textAnchor="middle" fontSize="20" fontWeight="700" fill="white">{total}</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="10" fill="#6b7280">appels</text>
    </svg>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      <p className="text-sm text-gray-300 mt-2">{label}</p>
      <p className="text-xs text-gray-600 mt-0.5">{sub}</p>
    </div>
  )
}

// ── Stats page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [all, setAll] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('week')
  const { toast } = useToast()

  const [selectedBar, setSelectedBar] = useState<BarItem | null>(null)

  const load = useCallback(async () => {
    try {
      setAll(await getProspects())
    } catch {
      toast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])
  useEffect(() => { setSelectedBar(null) }, [period])

  const periodProspects = useMemo(() => filterByPeriod(all, period), [all, period])
  const callProspects = useMemo(() => periodProspects.filter(p => CALL_STATUTS.includes(p.statut)), [periodProspects])
  const barData = useMemo(() => buildBarData(callProspects, period), [callProspects, period])

  const statusData = useMemo(() => {
    const counts: Partial<Record<Statut, number>> = {}
    for (const p of periodProspects) {
      counts[p.statut] = (counts[p.statut] ?? 0) + 1
    }
    return (Object.entries(counts) as [Statut, number][])
      .map(([s, v]) => ({ statut: s, value: v, label: getStatutConfig(s).label, color: DONUT_COLORS[s] ?? '#374151' }))
      .sort((a, b) => b.value - a.value)
  }, [periodProspects])

  const callCount = callProspects.length
  const rdvCount = periodProspects.filter(p => p.statut === 'rdv' || p.statut === 'no_show').length
  const noShowCount = periodProspects.filter(p => p.statut === 'no_show').length
  const closeCount = periodProspects.filter(p => p.statut === 'close').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <svg className="animate-spin w-5 h-5 text-gray-600" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header + tabs */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Statistiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de votre activite</p>
        </div>
        <div className="flex bg-[#111827] border border-gray-800 rounded-xl p-1 gap-0.5">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metriques */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Appels"
          value={String(callCount)}
          sub="vrais appels passes"
          color="text-white"
        />
        <StatCard
          label="RDV"
          value={String(rdvCount)}
          sub={callCount > 0 ? `${Math.round((rdvCount / callCount) * 100)}% des appels` : 'rendez-vous fixes'}
          color="text-green-400"
        />
        <StatCard
          label="No Show"
          value={String(noShowCount)}
          sub={rdvCount > 0 ? `${Math.round((noShowCount / rdvCount) * 100)}% des RDV` : '—'}
          color="text-red-400"
        />
        <StatCard
          label="Signatures"
          value={String(closeCount)}
          sub={rdvCount > 0 ? `${Math.round((closeCount / rdvCount) * 100)}% des RDV` : 'clients signes'}
          color="text-emerald-400"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white">Appels cold call</h2>
          <p className="text-xs text-gray-600 mb-6">
            {period === 'day' && "Aujourd'hui par heure"}
            {period === 'week' && 'Cette semaine par jour'}
            {period === 'month' && 'Ce mois par jour'}
            {period === 'year' && "Cette annee par mois"}
          </p>
          <BarChart data={barData} onSelect={b => setSelectedBar(prev => prev?.label === b.label ? null : b)} selectedLabel={selectedBar?.label ?? null} />

          {/* Détail barre sélectionnée */}
          {selectedBar && (
            <div className="mt-5 border-t border-gray-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">
                  {selectedBar.label} — <span className="text-blue-400">{selectedBar.value} appel{selectedBar.value > 1 ? 's' : ''}</span>
                </p>
                <button onClick={() => setSelectedBar(null)} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">✕ Fermer</button>
              </div>
              <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                {selectedBar.prospects.map(p => {
                  const color = DONUT_COLORS[p.statut] ?? '#374151'
                  const cfg = getStatutConfig(p.statut)
                  return (
                    <div key={p.id} className="flex items-center gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-gray-200 flex-1 truncate">{p.nom}</span>
                      <span className="text-xs font-medium shrink-0" style={{ color }}>{cfg.label}</span>
                      {p.derniere_relance && (
                        <span className="text-[10px] text-gray-600 shrink-0">
                          {new Date(p.derniere_relance).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Donut */}
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white">Repartition</h2>
          <p className="text-xs text-gray-600 mb-4">par statut sur la periode</p>
          <div className="flex flex-col items-center gap-4">
            <DonutChart data={statusData} />
            <div className="w-full space-y-1.5">
              {statusData.slice(0, 7).map(d => (
                <div key={d.statut} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-400 truncate max-w-28">{d.label}</span>
                  </div>
                  <span className="text-gray-300 font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tableau detaille */}
      <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Detail par statut — periode selectionnee</h2>
        </div>
        {statusData.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-600 text-center">Aucun appel sur cette periode.</p>
        ) : (
          <div className="divide-y divide-gray-800/60">
            {statusData.map(d => {
              const pct = periodProspects.length > 0 ? (d.value / periodProspects.length) * 100 : 0
              return (
                <div key={d.statut} className="flex items-center gap-4 px-6 py-3">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-sm text-gray-300 w-36 shrink-0">{d.label}</span>
                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: d.color }} />
                  </div>
                  <span className="text-sm font-semibold text-white w-8 text-right">{d.value}</span>
                  <span className="text-xs text-gray-600 w-10 text-right">{Math.round(pct)}%</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
