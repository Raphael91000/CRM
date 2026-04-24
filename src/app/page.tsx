'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getProspects, updateProspect, addProspect, addAppel, Prospect, Statut, NewProspect } from '@/lib/prospects'
import StatusBadge, { getStatutColor } from '@/components/StatusBadge'
import CallModal from '@/components/CallModal'
import AddProspectModal from '@/components/AddProspectModal'
import { useToast } from '@/components/ToastProvider'

const DEFAULT_DAILY_GOAL = 150
const GOAL_KEY = 'daily_goal'

function isToday(d: string | null) {
  if (!d) return false
  return new Date(d).toDateString() === new Date().toDateString()
}

function isDueToday(d: string | null) {
  if (!d) return false
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  return new Date(d) <= endOfDay
}

function fmtTime(d: string) {
  return new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function DailyProgress({ count, goal, onGoalChange }: { count: number; goal: number; onGoalChange: (g: number) => void }) {
  const pct = Math.min((count / goal) * 100, 100)
  const color =
    pct >= 100 ? 'bg-emerald-500' :
    pct >= 60  ? 'bg-blue-500' :
    pct >= 30  ? 'bg-orange-500' : 'bg-red-500'

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(goal))
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(goal))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n > 0) onGoalChange(n)
    setEditing(false)
  }

  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl p-5">
      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Objectif journalier</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-3xl font-bold text-white">{count}</span>
            <span className="text-lg text-gray-500 font-medium">/ </span>
            {editing ? (
              <input
                ref={inputRef}
                type="number"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
                className="w-20 text-lg font-medium bg-gray-800 border border-blue-500/50 rounded-lg px-2 py-0.5 text-white focus:outline-none"
              />
            ) : (
              <button
                onClick={startEdit}
                title="Modifier l'objectif"
                className="text-lg text-gray-500 font-medium hover:text-gray-300 transition-colors border-b border-dashed border-gray-700 hover:border-gray-500"
              >
                {goal}
              </button>
            )}
          </div>
        </div>
        <span className={`text-sm font-semibold ${pct >= 100 ? 'text-emerald-400' : 'text-gray-400'}`}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {pct >= 100 && (
        <p className="text-xs text-emerald-400 mt-2 font-medium">Objectif atteint !</p>
      )}
    </div>
  )
}

// ── Daily stat card ───────────────────────────────────────────────────────────

function DailyStat({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  )
}

// ── Prospect card ─────────────────────────────────────────────────────────────

function ProspectCard({
  prospect,
  onCall,
  onPoubelle,
  focused,
}: {
  prospect: Prospect
  onCall: (p: Prospect) => void
  onPoubelle?: (p: Prospect) => void
  focused?: boolean
}) {
  const nb = prospect.nb_tentatives ?? 0
  const color = getStatutColor(prospect.statut)

  function fmtDateTime(d: string | null) {
    if (!d) return null
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div
      className={`flex items-center gap-4 rounded-xl bg-[#111827] border cursor-pointer transition-all ${
        focused ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-gray-800 hover:border-gray-500'
      }`}
      style={{ borderLeft: `3px solid ${color}` }}
      onClick={() => onCall(prospect)}
    >
      <div className="flex-1 min-w-0 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white truncate">{prospect.nom}</span>
          {nb > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0 border bg-orange-500/15 text-orange-400 border-orange-500/30">
              NRP x{nb}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <a
            href={`tel:${prospect.telephone.replace(/\s/g, '')}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-blue-400 transition-colors"
          >
            <svg className="w-3.5 h-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
            </svg>
            {prospect.telephone}
          </a>
          {prospect.fiche_google && (
            <a
              href={prospect.fiche_google}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-md bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Fiche Google
            </a>
          )}
        </div>

        {prospect.derniere_relance && (
          <p className="text-xs text-gray-600 mt-1">
            {nb === 1 ? '1er appel' : `${nb}e appel`} · {fmtDateTime(prospect.derniere_relance)}
          </p>
        )}
        {prospect.note && (
          <p className="text-xs text-gray-700 mt-0.5 line-clamp-1">{prospect.note}</p>
        )}
      </div>

      <div className="pr-4 shrink-0 flex items-center gap-2">
        <StatusBadge statut={prospect.statut} />
        {onPoubelle && prospect.statut !== 'poubelle' && (
          <button
            onClick={e => { e.stopPropagation(); onPoubelle(prospect) }}
            title="Mettre en poubelle"
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  title, count, prospects, onCall, onPoubelle, emptyText, urgent, focusedId,
}: {
  title: string
  count: number
  prospects: Prospect[]
  onCall: (p: Prospect) => void
  onPoubelle?: (p: Prospect) => void
  emptyText: string
  urgent?: boolean
  focusedId?: string | null
}) {
  return (
    <section>
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
          count > 0 && urgent
            ? 'bg-orange-500/15 text-orange-400'
            : count > 0
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-gray-800 text-gray-600'
        }`}>
          {count}
        </span>
      </div>
      {prospects.length === 0 ? (
        <p className="text-sm text-gray-600 py-3">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {prospects.map(p => (
            <ProspectCard
              key={p.id}
              prospect={p}
              onCall={onCall}
              onPoubelle={onPoubelle}
              focused={focusedId === p.id}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Prospect | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [dailyGoal, setDailyGoal] = useState<number>(DEFAULT_DAILY_GOAL)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const saved = localStorage.getItem(GOAL_KEY)
    if (saved) {
      const n = parseInt(saved, 10)
      if (!isNaN(n) && n > 0) setDailyGoal(n)
    }
  }, [])

  function handleGoalChange(g: number) {
    setDailyGoal(g)
    localStorage.setItem(GOAL_KEY, String(g))
  }

  const load = useCallback(async () => {
    try {
      setProspects(await getProspects())
    } catch {
      toast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleSaveCall(id: string, statut: Statut, note: string, prochaine: string) {
    const current = prospects.find(p => p.id === id)
    await Promise.all([
      updateProspect(id, {
        statut,
        note: note || null,
        derniere_relance: new Date().toISOString(),
        prochaine_relance: prochaine ? new Date(prochaine).toISOString() : null,
        nb_tentatives: (current?.nb_tentatives ?? 0) + 1,
      }),
      addAppel({ prospectId: id, statut, note }),
    ])
    toast('Appel enregistré')
    await load()
  }

  async function handlePoubelle(prospect: Prospect) {
    await updateProspect(prospect.id, { statut: 'poubelle' })
    toast(`${prospect.nom} → Poubelle`, 'info')
    await load()
  }

  async function handleAdd(data: NewProspect) {
    await addProspect(data)
    toast('Prospect ajoute')
    await load()
  }

  // Daily stats
  const todayCalls = prospects.filter(p => isToday(p.derniere_relance))
  const appelsAujourdhui = todayCalls.length
  const nrpDuJour = todayCalls.filter(p => p.statut === 'nrp').length
  const decroches = appelsAujourdhui - nrpDuJour
  const interesses = todayCalls.filter(p => ['a_rappeler', 'rdv', 'demo_envoyee'].includes(p.statut)).length
  const tauxDecrochage = appelsAujourdhui > 0 ? Math.round((decroches / appelsAujourdhui) * 100) : 0

  const callTimes = todayCalls
    .filter(p => p.derniere_relance)
    .map(p => new Date(p.derniere_relance!).getTime())
  const premierAppel = callTimes.length > 0 ? fmtTime(new Date(Math.min(...callTimes)).toISOString()) : '—'
  const dernierAppel = callTimes.length > 0 ? fmtTime(new Date(Math.max(...callTimes)).toISOString()) : '—'

  // Sections
  const rdvAujourdhui = prospects.filter(p => p.statut === 'rdv' && isDueToday(p.prochaine_relance))
  const aRappeler     = prospects.filter(p => p.statut === 'a_rappeler' && isDueToday(p.prochaine_relance))
  const noShow        = prospects.filter(p => p.statut === 'no_show')
  const nouveaux      = prospects.filter(p => p.statut === 'nouveau')

  // Flat list for keyboard navigation (same order as sections)
  const allVisible = [...rdvAujourdhui, ...noShow, ...aRappeler, ...nouveaux]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (selected) return
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
      if (allVisible.length === 0) return
      e.preventDefault()
      if (e.key === 'Enter') {
        const p = allVisible.find(p => p.id === focusedId)
        if (p) setSelected(p)
        return
      }
      const idx = allVisible.findIndex(p => p.id === focusedId)
      if (e.key === 'ArrowDown') {
        const next = idx < allVisible.length - 1 ? allVisible[idx + 1] : allVisible[0]
        setFocusedId(next.id)
      } else {
        const prev = idx > 0 ? allVisible[idx - 1] : allVisible[allVisible.length - 1]
        setFocusedId(prev.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, focusedId, allVisible])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement...
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Objectif journalier */}
      <DailyProgress count={appelsAujourdhui} goal={dailyGoal} onGoalChange={handleGoalChange} />

      {/* Stats journalieres */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <DailyStat label="Appels ce jour"    value={appelsAujourdhui}       accent="text-white" />
        <DailyStat label="NRP du jour"       value={nrpDuJour}              accent="text-orange-400" />
        <DailyStat label="Taux decrochage"   value={`${tauxDecrochage}%`}   accent={tauxDecrochage >= 50 ? 'text-emerald-400' : tauxDecrochage >= 30 ? 'text-orange-400' : 'text-red-400'} />
        <DailyStat label="Interesses"        value={interesses}             accent="text-teal-400" />
        <DailyStat label="Premier appel"     value={premierAppel}           accent="text-gray-300" />
        <DailyStat label="Dernier appel"     value={dernierAppel}           accent="text-gray-300" />
      </div>

      {/* RDV aujourd'hui */}
      <Section
        title="RDV aujourd'hui"
        count={rdvAujourdhui.length}
        prospects={rdvAujourdhui}
        onCall={setSelected}
        onPoubelle={handlePoubelle}
        emptyText="Aucun RDV prevu aujourd'hui."
        urgent
        focusedId={focusedId}
      />

      {/* No show */}
      <Section
        title="No show — a relancer"
        count={noShow.length}
        prospects={noShow}
        onCall={setSelected}
        onPoubelle={handlePoubelle}
        emptyText="Aucun no show."
        focusedId={focusedId}
      />

      {/* A rappeler aujourd'hui */}
      <Section
        title="A rappeler aujourd'hui"
        count={aRappeler.length}
        prospects={aRappeler}
        onCall={setSelected}
        onPoubelle={handlePoubelle}
        emptyText="Aucun rappel prevu aujourd'hui."
        focusedId={focusedId}
      />

      {/* Nouveaux */}
      <Section
        title="Nouveaux"
        count={nouveaux.length}
        prospects={nouveaux}
        onCall={setSelected}
        onPoubelle={handlePoubelle}
        emptyText="Aucun nouveau prospect."
        focusedId={focusedId}
      />

      {/* Modals */}
      {selected && (
        <CallModal
          prospect={selected}
          onClose={() => setSelected(null)}
          onSave={handleSaveCall}
        />
      )}
      {showAdd && (
        <AddProspectModal
          onClose={() => setShowAdd(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
