'use client'

import { useEffect, useRef, useState } from 'react'
import { Appel, Prospect, Statut, getAppels } from '@/lib/prospects'
import { getStatutColor, getStatutConfig } from './StatusBadge'

type Props = {
  prospect: Prospect
  onClose: () => void
  onSave: (id: string, statut: Statut, note: string, prochaine: string) => Promise<void>
}

const OTHER_STATUTS: Statut[] = ['a_rappeler', 'rdv', 'no_show', 'demo_envoyee', 'en_attente', 'pas_interesse', 'deja_site', 'close', 'poubelle']
// digit 1 = nrp, digits 2-0 = OTHER_STATUTS in order
const DIGIT_STATUTS: Statut[] = ['nrp', ...OTHER_STATUTS]
const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function skipWeekend(d: Date): Date {
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return d
}

function suggestNrpDate(nbTentatives: number): string {
  const now = new Date()
  const daysToAdd = nbTentatives === 0 ? 1 : nbTentatives === 1 ? 3 : 7
  const nextHour = now.getHours() < 12 ? 14 : 10
  const nextMinute = now.getHours() < 12 ? 30 : 0
  const next = new Date(now)
  next.setDate(next.getDate() + daysToAdd)
  next.setHours(nextHour, nextMinute, 0, 0)
  skipWeekend(next)
  return toLocalInput(next)
}

export default function CallModal({ prospect, onClose, onSave }: Props) {
  const initialStatut = (prospect.statut as Statut) ?? 'nrp'
  const [statut, setStatut] = useState<Statut>(initialStatut)
  const [note, setNote] = useState('')
  const [prochaine, setProchaine] = useState(
    prospect.prochaine_relance ? toLocalInput(new Date(prospect.prochaine_relance)) : suggestNrpDate(prospect.nb_tentatives ?? 0)
  )
  const [saving, setSaving] = useState(false)
  const [historique, setHistorique] = useState<Appel[]>([])
  const [showHistorique, setShowHistorique] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const prochainRef = useRef<HTMLInputElement>(null)

  const nextNrp = (prospect.nb_tentatives ?? 0) + 1
  const nrpLabel = nextNrp === 1 ? 'NRP — 1er appel' : `NRP x${nextNrp}`

  useEffect(() => {
    noteRef.current?.focus()
    getAppels(prospect.id).then(setHistorique).catch(() => {})
  }, [prospect.id])

  // Auto-suggest date only when switching TO nrp; clearing for terminal statuts
  const prevStatut = useRef<Statut>(initialStatut)
  useEffect(() => {
    const prev = prevStatut.current
    prevStatut.current = statut
    if (statut === prev) return
    if (statut === 'nrp') {
      setProchaine(suggestNrpDate(prospect.nb_tentatives ?? 0))
    } else if (!['a_rappeler', 'rdv', 'no_show', 'en_attente'].includes(statut)) {
      setProchaine('')
    }
    // for rdv/a_rappeler/no_show/en_attente: keep whatever is in the field
  }, [statut])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') handleSave()
      if (e.key === 'Enter' && e.ctrlKey && (e.target as HTMLElement).tagName === 'TEXTAREA') handleSave()
      if (e.key === 'g' && (e.ctrlKey || e.metaKey) && prospect.fiche_google) {
        e.preventDefault()
        window.open(prospect.fiche_google, '_blank')
        return
      }
      // digit shortcuts — skip if user is typing in a text field
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
    if (saving) return
    setSaving(true)
    // Read directly from DOM to avoid stale closure on prochaine state
    const prochainValue = prochainRef.current?.value ?? prochaine
    try {
      await onSave(prospect.id, statut, note, prochainValue)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const saveColor = getStatutColor(statut)

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0f172a] border border-gray-700/60 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-800">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{prospect.nom}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors ml-3 shrink-0 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <a
              href={`tel:${prospect.telephone.replace(/\s/g, '')}`}
              className="flex items-center gap-2 text-lg font-bold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
              {prospect.telephone}
            </a>
            {prospect.fiche_google && (
              <a
                href={prospect.fiche_google}
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

          {/* Résumé appels + bouton historique */}
          {prospect.nb_tentatives > 0 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-600">
                {prospect.nb_tentatives} appel{prospect.nb_tentatives > 1 ? 's' : ''} précédent{prospect.nb_tentatives > 1 ? 's' : ''}
                {prospect.derniere_relance && ` · dernier le ${new Date(prospect.derniere_relance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
              </p>
              {historique.length > 0 && (
                <button
                  onClick={() => setShowHistorique(h => !h)}
                  className="text-xs text-blue-500 hover:text-blue-400 transition-colors shrink-0 ml-2"
                >
                  {showHistorique ? 'Masquer' : 'Voir historique'}
                </button>
              )}
            </div>
          )}

          {/* Historique des appels */}
          {showHistorique && historique.length > 0 && (
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

          {/* Note de l'appel */}
          <textarea
            ref={noteRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Note pour cet appel (optionnel)..."
            className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 resize-none transition-colors"
          />

          {/* Prochaine relance */}
          {(statut === 'nrp' || statut === 'a_rappeler' || statut === 'rdv' || statut === 'no_show' || statut === 'en_attente') && (
            <div className="space-y-1.5">
              {prochaine && (() => {
                const d = new Date(prochaine)
                const days = Math.round((new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
                const label = days === 0 ? "Aujourd'hui" : days === 1 ? 'Demain' : days < 0 ? `Il y a ${Math.abs(days)}j` : `Dans ${days} jour${days > 1 ? 's' : ''}`
                const color = days <= 0 ? 'text-orange-400' : days <= 2 ? 'text-yellow-400' : 'text-gray-500'
                return <p className={`text-xs font-medium px-1 ${color}`}>{label}</p>
              })()}
              <input
                type="datetime-local"
                ref={prochainRef}
                value={prochaine}
                onChange={e => setProchaine(e.target.value)}
                className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-100 focus:outline-none focus:border-blue-500/40 transition-colors [color-scheme:dark]"
              />
              {statut === 'nrp' && (
                <p className="text-[11px] text-gray-600 px-1">
                  Suggestion : {nextNrp === 1 ? 'J+1' : nextNrp === 2 ? 'J+3' : 'J+7'}, créneau inversé · week-end ignoré
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-5 flex gap-3">
          <button
            onClick={onClose}
            className="py-2.5 px-5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            Annuler
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
        <p className="text-center text-[11px] text-gray-700 pb-4">1–0 statut · ⌘G fiche · Entrée enregistrer · Ctrl+Entrée depuis la note · Échap fermer</p>
      </div>
    </div>
  )
}
