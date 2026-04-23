'use client'

import { useEffect, useRef, useState } from 'react'
import { Prospect, Statut } from '@/lib/prospects'
import { getStatutColor, getStatutConfig } from './StatusBadge'

const NRP_MAX = 3

type Props = {
  prospect: Prospect
  onClose: () => void
  onSave: (id: string, statut: Statut, note: string, prochaine: string) => Promise<void>
}

const OTHER_STATUTS: Statut[] = ['a_rappeler', 'rdv', 'no_show', 'demo_envoyee', 'pas_interesse', 'deja_site', 'close', 'poubelle']

export default function CallModal({ prospect, onClose, onSave }: Props) {
  const [statut, setStatut] = useState<Statut>('nrp')
  const [note, setNote] = useState(prospect.note ?? '')
  const [prochaine, setProchaine] = useState(prospect.prochaine_relance?.slice(0, 16) ?? '')
  const [saving, setSaving] = useState(false)
  const noteRef = useRef<HTMLTextAreaElement>(null)

  const nextNrp = (prospect.nb_tentatives ?? 0) + 1
  const isLastNrp = nextNrp >= NRP_MAX
  const nrpLabel = nextNrp === 1
    ? 'NRP — 1er appel'
    : isLastNrp
      ? `NRP x${nextNrp} → Poubelle`
      : `NRP x${nextNrp}`

  useEffect(() => {
    noteRef.current?.focus()
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      await onSave(prospect.id, statut, note, prochaine)
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

          {/* Tel + Fiche côte à côte */}
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

          {prospect.nb_tentatives > 0 && (
            <p className="text-xs text-gray-600 mt-2">
              {prospect.nb_tentatives} appel{prospect.nb_tentatives > 1 ? 's' : ''} précédent{prospect.nb_tentatives > 1 ? 's' : ''}
              {prospect.derniere_relance && ` · dernier le ${new Date(prospect.derniere_relance).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`}
            </p>
          )}
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* NRP — action principale */}
          <button
            onClick={() => setStatut('nrp')}
            className="w-full py-3 rounded-xl text-sm font-bold border-2 transition-all"
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
            {nrpLabel}
          </button>

          {/* Autres statuts */}
          <div className="grid grid-cols-3 gap-2">
            {OTHER_STATUTS.map(s => {
              const { label } = getStatutConfig(s)
              const c = getStatutColor(s)
              const isSelected = statut === s
              return (
                <button
                  key={s}
                  onClick={() => setStatut(s)}
                  className="py-2 px-2 rounded-xl text-xs font-semibold border transition-all text-center"
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
                  {label}
                </button>
              )
            })}
          </div>

          {/* Note */}
          <textarea
            ref={noteRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="Note (optionnel)..."
            className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/40 resize-none transition-colors"
          />

          {/* Prochaine relance */}
          {statut === 'a_rappeler' && (
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
        <p className="text-center text-[11px] text-gray-700 pb-4">Ctrl+Entrée · Échap pour fermer</p>
      </div>
    </div>
  )
}
