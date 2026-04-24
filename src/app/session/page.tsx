'use client'

import { useCallback, useEffect, useState } from 'react'
import { getProspects, updateProspect, addAppel, Prospect, Statut, Appel, getAppels } from '@/lib/prospects'
import { getStatutColor, getStatutConfig } from '@/components/StatusBadge'
import { useToast } from '@/components/ToastProvider'
import Link from 'next/link'

const SESSION_STATUTS: Statut[] = ['nouveau', 'nrp', 'no_show']
const OTHER_STATUTS: Statut[] = ['a_rappeler', 'rdv', 'no_show', 'demo_envoyee', 'en_attente', 'pas_interesse', 'deja_site', 'close', 'poubelle']
const DIGIT_STATUTS: Statut[] = ['nrp', ...OTHER_STATUTS]
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function isDueToday(d: string | null) {
  if (!d) return false
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  return new Date(d) <= endOfDay
}

export default function SessionPage() {
  const [queue, setQueue] = useState<Prospect[]>([])
  const [index, setIndex] = useState(0)
  const [done, setDone] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statut, setStatut] = useState<Statut>('nrp')
  const [note, setNote] = useState('')
  const [prochaine, setProchaine] = useState('')
  const [saving, setSaving] = useState(false)
  const [historique, setHistorique] = useState<Appel[]>([])
  const [showHisto, setShowHisto] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const all = await getProspects()
      const q = all.filter(p =>
        SESSION_STATUTS.includes(p.statut) ||
        (p.statut === 'a_rappeler' && isDueToday(p.prochaine_relance))
      )
      q.sort((a, b) => {
        const order = ['rdv', 'a_rappeler', 'no_show', 'nouveau', 'nrp']
        return order.indexOf(a.statut) - order.indexOf(b.statut)
      })
      setQueue(q)
      setIndex(0)
      setDone(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const current = queue[index] ?? null

  useEffect(() => {
    if (!current) return
    setStatut('nrp')
    setNote('')
    setProchaine(current.prochaine_relance?.slice(0, 16) ?? '')
    setShowHisto(false)
    getAppels(current.id).then(setHistorique).catch(() => {})
  }, [current?.id])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') return
      const di = DIGITS.indexOf(e.key)
      if (di >= 0 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setStatut(DIGIT_STATUTS[di])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleSave() {
    if (!current || saving) return
    setSaving(true)
    try {
      await Promise.all([
        updateProspect(current.id, {
          statut,
          note: note || null,
          derniere_relance: new Date().toISOString(),
          prochaine_relance: prochaine ? new Date(prochaine).toISOString() : null,
          nb_tentatives: (current.nb_tentatives ?? 0) + 1,
        }),
        addAppel({ prospectId: current.id, statut, note }),
      ])
      toast('Appel enregistré')
      setDone(d => d + 1)
      if (index + 1 >= queue.length) {
        setIndex(queue.length)
      } else {
        setIndex(i => i + 1)
      }
    } finally {
      setSaving(false)
    }
  }

  function handleSkip() {
    if (index + 1 >= queue.length) {
      setIndex(queue.length)
    } else {
      setIndex(i => i + 1)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-96">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Chargement de la session...
        </div>
      </div>
    )
  }

  // End of queue
  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-96 gap-6 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Session terminée</h2>
          <p className="text-gray-400 mt-1">
            {done} appel{done !== 1 ? 's' : ''} passé{done !== 1 ? 's' : ''} · {queue.length - done} ignoré{queue.length - done !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={load}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
          >
            Nouvelle session
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 text-sm font-medium transition-colors"
          >
            Retour dashboard
          </Link>
        </div>
      </div>
    )
  }

  const nb = current.nb_tentatives ?? 0
  const nrpLabel = nb === 0 ? 'NRP — 1er appel' : `NRP x${nb + 1}`
  const saveColor = getStatutColor(statut)
  const progress = queue.length > 0 ? (index / queue.length) * 100 : 0

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Mode session</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {index + 1} / {queue.length} · {done} appelé{done !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/"
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Quitter
        </Link>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Prospect card */}
      <div className="bg-[#0f172a] border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{current.nom}</h2>
              {current.departement && (
                <p className="text-xs text-gray-500 mt-0.5">{current.departement}</p>
              )}
            </div>
            <span
              className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border"
              style={{
                color: getStatutColor(current.statut),
                borderColor: `${getStatutColor(current.statut)}40`,
                backgroundColor: `${getStatutColor(current.statut)}15`,
              }}
            >
              {getStatutConfig(current.statut).label}
            </span>
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <a
              href={`tel:${current.telephone.replace(/\s/g, '')}`}
              className="flex items-center gap-2 text-xl font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
              {current.telephone}
            </a>
            {current.fiche_google && (
              <a
                href={current.fiche_google}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400 text-sm font-semibold rounded-lg transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Fiche Google
              </a>
            )}
          </div>

          {nb > 0 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-600">
                {nb} appel{nb > 1 ? 's' : ''} précédent{nb > 1 ? 's' : ''}
                {current.derniere_relance && ` · dernier le ${new Date(current.derniere_relance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
              </p>
              {historique.length > 0 && (
                <button
                  onClick={() => setShowHisto(h => !h)}
                  className="text-xs text-blue-500 hover:text-blue-400 transition-colors shrink-0 ml-2"
                >
                  {showHisto ? 'Masquer' : 'Voir historique'}
                </button>
              )}
            </div>
          )}

          {showHisto && historique.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {historique.map(a => {
                const cfg = getStatutConfig(a.statut as Statut)
                const c = getStatutColor(a.statut as Statut)
                return (
                  <div key={a.id} className="flex items-start gap-2 bg-gray-800/40 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-600 shrink-0 mt-0.5 w-28">{fmtDate(a.date)}</span>
                    <span
                      className="text-xs font-semibold shrink-0 px-1.5 py-0.5 rounded-full border"
                      style={{ color: c, borderColor: `${c}40`, backgroundColor: `${c}15` }}
                    >
                      {cfg.label}
                    </span>
                    {a.note && <p className="text-xs text-gray-400 truncate">{a.note}</p>}
                  </div>
                )
              })}
            </div>
          )}

          {current.note && (
            <p className="text-xs text-gray-500 mt-2 bg-gray-800/40 rounded-lg px-3 py-2">{current.note}</p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* NRP */}
          <button
            onClick={() => setStatut('nrp')}
            className="w-full py-3 rounded-xl text-sm font-bold border-2 transition-all flex items-center justify-center gap-2"
            style={statut === 'nrp' ? {
              backgroundColor: `${getStatutColor('nrp')}20`,
              borderColor: getStatutColor('nrp'),
              color: getStatutColor('nrp'),
            } : {
              backgroundColor: 'transparent',
              borderColor: '#374151',
              color: '#6b7280',
            }}
          >
            <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/30 border border-current opacity-60">1</kbd>
            {nrpLabel}
          </button>

          {/* Autres statuts */}
          <div className="grid grid-cols-3 gap-2">
            {OTHER_STATUTS.map((s, i) => {
              const { label } = getStatutConfig(s)
              const c = getStatutColor(s)
              const isSelected = statut === s
              const digit = DIGITS[i + 1]
              return (
                <button
                  key={s}
                  onClick={() => setStatut(s)}
                  className="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center flex flex-col items-center gap-0.5"
                  style={isSelected ? {
                    backgroundColor: `${c}20`,
                    borderColor: `${c}80`,
                    color: c,
                  } : {
                    backgroundColor: 'transparent',
                    borderColor: '#374151',
                    color: '#6b7280',
                  }}
                >
                  <span className="text-[9px] font-mono opacity-50">{digit}</span>
                  {label}
                </button>
              )
            })}
          </div>

          {/* Note */}
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Note pour cet appel (optionnel)..."
            className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 resize-none transition-colors"
          />

          {/* Prochaine relance */}
          {(statut === 'a_rappeler' || statut === 'rdv' || statut === 'no_show' || statut === 'en_attente') && (
            <input
              type="datetime-local"
              value={prochaine}
              onChange={e => setProchaine(e.target.value)}
              className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-100 focus:outline-none focus:border-blue-500/40 transition-colors [color-scheme:dark]"
            />
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={handleSkip}
            className="py-2.5 px-5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            Passer
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
            style={{ backgroundColor: saveColor }}
          >
            {saving ? 'Enregistrement...' : `Enregistrer — ${getStatutConfig(statut).label}`}
          </button>
        </div>
        <p className="text-center text-[11px] text-gray-700 pb-4">1–0 statut · Ctrl+Entrée enregistrer</p>
      </div>
    </div>
  )
}
