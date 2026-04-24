'use client'

import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { getExistingPhones } from '@/lib/prospects'

export type ImportRow = {
  nom: string
  telephone: string
  departement: string
  statut?: string
  nb_tentatives?: number
  derniere_relance?: string | null
  prochaine_relance?: string | null
  note?: string | null
  fiche_google?: string | null
}

type Props = {
  onClose: () => void
  onImport: (rows: ImportRow[], fileName: string) => Promise<void>
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

const HEADER_MAP: Record<string, keyof ImportRow> = {
  nom:              'nom',
  name:             'nom',
  societe:          'nom',
  entreprise:       'nom',
  company:          'nom',
  raison:           'nom',
  telephone:        'telephone',
  tel:              'telephone',
  phone:            'telephone',
  mobile:           'telephone',
  portable:         'telephone',
  departement:      'departement',
  dept:             'departement',
  dep:              'departement',
  region:           'departement',
  ville:            'departement',
  city:             'departement',
  cp:               'departement',
  statut:           'statut',
  status:           'statut',
  etat:             'statut',
  nb_tentatives:    'nb_tentatives',
  tentatives:       'nb_tentatives',
  appels:           'nb_tentatives',
  nb_appels:        'nb_tentatives',
  derniere_relance: 'derniere_relance',
  derniere:         'derniere_relance',
  date_appel:       'derniere_relance',
  prochaine_relance:'prochaine_relance',
  prochaine:        'prochaine_relance',
  rappel:           'prochaine_relance',
  note:             'note',
  notes:            'note',
  commentaire:      'note',
  remarque:         'note',
  fiche_google:        'fiche_google',
  fiche:               'fiche_google',
  google:              'fiche_google',
  url:                 'fiche_google',
  lien:                'fiche_google',
  'fiche google':      'fiche_google',
  'fiche google maps': 'fiche_google',
  'google maps':       'fiche_google',
  'lien google':       'fiche_google',
  'lien maps':         'fiche_google',
  'lien google maps':  'fiche_google',
  maps:                'fiche_google',
  gmaps:               'fiche_google',
  site:                'fiche_google',
  place:               'fiche_google',
  maps_url:            'fiche_google',
  google_maps:         'fiche_google',
}

const STATUT_MAP: Record<string, string> = {
  nouveau:        'nouveau',
  new:            'nouveau',
  nrp:            'nrp',
  'ne repond pas':'nrp',
  'ne répond pas':'nrp',
  'a rappeler':   'a_rappeler',
  'à rappeler':   'a_rappeler',
  rappeler:       'a_rappeler',
  rdv:            'rdv',
  'rendez-vous':  'rdv',
  'rendez vous':  'rdv',
  demo:           'demo_envoyee',
  demo_envoyee:   'demo_envoyee',
  'demo envoyee': 'demo_envoyee',
  'démo envoyée': 'demo_envoyee',
  'pas interesse':'pas_interesse',
  'pas interessee':'pas_interesse',
  'pas intéressé':'pas_interesse',
  interesse:      'pas_interesse',
  non:            'pas_interesse',
  'deja site':    'deja_site',
  'déjà site':    'deja_site',
  'a deja site':  'deja_site',
  close:          'close',
  closé:          'close',
  signe:          'close',
  signé:          'close',
  client:         'close',
  'no show':      'no_show',
  no_show:        'no_show',
  'no-show':      'no_show',
  'en attente':   'en_attente',
  en_attente:     'en_attente',
  attente:        'en_attente',
  poubelle:       'poubelle',
  trash:          'poubelle',
  corbeille:      'poubelle',
}

function normalizeStatut(raw: string): string {
  const key = raw.toLowerCase().trim()
  return STATUT_MAP[key] ?? 'nouveau'
}

function parseDate(raw: string | number | null | undefined): string | null {
  if (!raw) return null
  if (typeof raw === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(raw)
    if (date) {
      const d = new Date(Date.UTC(date.y, date.m - 1, date.d))
      return d.toISOString()
    }
  }
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function parseFile(file: File): Promise<ImportRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = e.target?.result
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 }) as string[][]

        if (rows.length < 2) {
          resolve([])
          return
        }

        // Map headers
        const headers = rows[0].map(h => normalizeHeader(String(h ?? '')))
        const colMap: Partial<Record<keyof ImportRow, number>> = {}
        headers.forEach((h, i) => {
          const mapped = HEADER_MAP[h]
          if (mapped && colMap[mapped] === undefined) {
            colMap[mapped] = i
          }
        })

        const result: ImportRow[] = []
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i] as (string | number | null | undefined)[]
          const nom = String(row[colMap.nom ?? 0] ?? '').trim()
          const telephone = colMap.telephone !== undefined ? String(row[colMap.telephone] ?? '').trim() : ''
          const departement = colMap.departement !== undefined ? String(row[colMap.departement] ?? '').trim() : ''
          if (!nom && !telephone) continue

          const rawStatut = colMap.statut !== undefined ? row[colMap.statut] : undefined
          const rawNb = colMap.nb_tentatives !== undefined ? row[colMap.nb_tentatives] : undefined
          const rawDerniere = colMap.derniere_relance !== undefined ? row[colMap.derniere_relance] : undefined
          const rawProchaine = colMap.prochaine_relance !== undefined ? row[colMap.prochaine_relance] : undefined
          const rawNote = colMap.note !== undefined ? row[colMap.note] : undefined

          // Lire l'URL réelle du lien hypertexte Excel (cell.l.Target), pas le texte affiché
          let fiche: string | null = null
          if (colMap.fiche_google !== undefined) {
            const cellAddr = XLSX.utils.encode_cell({ r: i, c: colMap.fiche_google })
            const cell = sheet[cellAddr]
            if (cell?.l?.Target) {
              fiche = String(cell.l.Target).trim() || null
            } else if (cell?.v != null) {
              const v = String(cell.v).trim()
              fiche = v.startsWith('http') ? v : null
            }
          }

          result.push({
            nom,
            telephone,
            departement,
            statut: rawStatut != null ? normalizeStatut(String(rawStatut)) : undefined,
            nb_tentatives: rawNb != null && !isNaN(Number(rawNb)) ? Number(rawNb) : undefined,
            derniere_relance: parseDate(rawDerniere as string | number | null),
            prochaine_relance: parseDate(rawProchaine as string | number | null),
            note: rawNote != null ? String(rawNote).trim() || null : undefined,
            fiche_google: fiche,
          })
        }
        resolve(result)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export default function ImportModal({ onClose, onImport }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [duplicatePhones, setDuplicatePhones] = useState<Set<string>>(new Set())
  const [fileName, setFileName] = useState('')
  const [importing, setSaving] = useState(false)
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  async function handleFile(file: File) {
    setError('')
    setFileName(file.name)
    setDuplicatePhones(new Set())
    try {
      const [parsed, existingPhones] = await Promise.all([parseFile(file), getExistingPhones()])
      setRows(parsed)
      const dupes = new Set(
        parsed
          .map(r => r.telephone.replace(/\s/g, ''))
          .filter(tel => existingPhones.has(tel))
      )
      setDuplicatePhones(dupes)
    } catch {
      setError('Impossible de lire ce fichier. Vérifiez le format.')
      setRows([])
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  async function handleImport() {
    if (rows.length === 0) return
    setSaving(true)
    try {
      const toImport = skipDuplicates && duplicatePhones.size > 0
        ? rows.filter(r => !duplicatePhones.has(r.telephone.replace(/\s/g, '')))
        : rows
      await onImport(toImport, fileName)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const duplicateCount = duplicatePhones.size
  const importCount = skipDuplicates ? rows.length - duplicateCount : rows.length

  const preview = rows.slice(0, 5)

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#111827] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Importer des prospects</h2>
            <p className="text-xs text-gray-500 mt-0.5">Formats acceptes : .xlsx, .csv</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className={`border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-500 bg-blue-500/5'
              : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {fileName ? (
            <div>
              <p className="text-sm font-medium text-white">{fileName}</p>
              <p className="text-xs text-gray-500 mt-1">
                {rows.length > 0
                  ? `${rows.length} prospect${rows.length > 1 ? 's' : ''} detecte${rows.length > 1 ? 's' : ''}`
                  : 'Aucune donnee detectee'}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-400">Glissez un fichier ici ou cliquez pour parcourir</p>
              <p className="text-xs text-gray-600 mt-1">Colonnes attendues : nom, telephone, departement</p>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              Apercu ({rows.length} ligne{rows.length > 1 ? 's' : ''})
            </p>
            <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
              <div className={`grid px-4 py-2 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider ${preview.some(r => r.statut) ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <span>Nom</span>
                <span>Telephone</span>
                <span>Departement</span>
                {preview.some(r => r.statut) && <span>Statut</span>}
              </div>
              {preview.map((row, i) => (
                <div key={i} className={`grid px-4 py-2.5 border-b border-gray-800/50 last:border-0 text-sm ${preview.some(r => r.statut) ? 'grid-cols-4' : 'grid-cols-3'}`}>
                  <span className="text-gray-200 truncate">{row.nom || <span className="text-gray-600">—</span>}</span>
                  <span className="text-gray-300 truncate">{row.telephone || <span className="text-gray-600">—</span>}</span>
                  <span className="text-gray-400 truncate">{row.departement || <span className="text-gray-600">—</span>}</span>
                  {preview.some(r => r.statut) && (
                    <span className="text-gray-400 truncate">{row.statut || <span className="text-gray-600">nouveau</span>}</span>
                  )}
                </div>
              ))}
              {rows.length > 5 && (
                <div className="px-4 py-2 text-xs text-gray-600 border-t border-gray-800">
                  ... et {rows.length - 5} autre{rows.length - 5 > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Avertissement doublons */}
        {duplicateCount > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-orange-400">
              {duplicateCount} doublon{duplicateCount > 1 ? 's' : ''} détecté{duplicateCount > 1 ? 's' : ''} — numéro{duplicateCount > 1 ? 's' : ''} déjà en base
            </p>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="radio" checked={skipDuplicates} onChange={() => setSkipDuplicates(true)}
                  className="accent-blue-500" />
                Ignorer les doublons ({rows.length - duplicateCount} importés)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                <input type="radio" checked={!skipDuplicates} onChange={() => setSkipDuplicates(false)}
                  className="accent-blue-500" />
                Tout importer ({rows.length})
              </label>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleImport}
            disabled={importing || importCount === 0}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {importing
              ? 'Import en cours...'
              : importCount > 0
                ? `Importer ${importCount} prospect${importCount > 1 ? 's' : ''}`
                : 'Aucun prospect à importer'}
          </button>
        </div>
      </div>
    </div>
  )
}
