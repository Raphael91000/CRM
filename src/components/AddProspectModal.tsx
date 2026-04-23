'use client'

import { useState } from 'react'
import { NewProspect } from '@/lib/prospects'

type Props = {
  onClose: () => void
  onAdd: (data: NewProspect) => Promise<void>
}

export default function AddProspectModal({ onClose, onAdd }: Props) {
  const [nom, setNom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [departement, setDepartement] = useState('')
  const [fiche_google, setFicheGoogle] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const canSave = nom.trim() !== '' && telephone.trim() !== ''

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      await onAdd({
        nom: nom.trim(),
        telephone: telephone.trim(),
        departement: departement.trim(),
        fiche_google: fiche_google.trim() || null,
        note: note.trim() || null,
        statut: 'nouveau',
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111827] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Nouveau prospect</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-3">
          {[
            { label: 'Nom / Societe', value: nom, set: setNom, placeholder: 'Boulangerie Martin', required: true },
            { label: 'Telephone', value: telephone, set: setTelephone, placeholder: '06 12 34 56 78', required: true },
            { label: 'Departement', value: departement, set: setDepartement, placeholder: 'Paris (75)', required: false },
            { label: 'Fiche Google Maps', value: fiche_google, set: setFicheGoogle, placeholder: 'https://maps.google.com/...', required: false },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                {f.label} {f.required && <span className="text-red-400">*</span>}
              </label>
              <input
                type="text"
                value={f.value}
                onChange={e => f.set(e.target.value)}
                placeholder={f.placeholder}
                className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">
              Note initiale
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder="Contexte, source du prospect..."
              className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Ajout...' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  )
}
