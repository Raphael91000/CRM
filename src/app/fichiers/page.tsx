'use client'

import { useCallback, useEffect, useState } from 'react'
import { getImports, deleteImport, bulkAddProspects, Import, Statut, NewProspect } from '@/lib/prospects'
import ImportModal, { ImportRow } from '@/components/ImportModal'
import { useToast } from '@/components/ToastProvider'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function FichiersPage() {
  const [imports, setImports] = useState<Import[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const { toast } = useToast()

  const load = useCallback(async () => {
    try {
      setImports(await getImports())
    } catch {
      toast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleImport(rows: ImportRow[], fileName: string) {
    const count = await bulkAddProspects(rows.map(r => ({
      nom: r.nom,
      telephone: r.telephone,
      departement: r.departement,
      statut: (r.statut as Statut) ?? 'nouveau',
      note: r.note ?? null,
      fiche_google: r.fiche_google ?? null,
      nb_tentatives: r.nb_tentatives ?? 0,
      derniere_relance: r.derniere_relance ?? null,
      prochaine_relance: r.prochaine_relance ?? null,
    } satisfies NewProspect)), fileName)
    toast(`${count} prospect${count > 1 ? 's' : ''} importe${count > 1 ? 's' : ''}`)
    await load()
  }

  async function handleDelete(imp: Import) {
    if (confirm !== imp.id) {
      setConfirm(imp.id)
      return
    }
    setDeleting(imp.id)
    setConfirm(null)
    try {
      await deleteImport(imp.id)
      toast(`"${imp.nom_fichier}" supprime avec ses ${imp.nb_prospects} prospect${imp.nb_prospects > 1 ? 's' : ''}`, 'info')
      await load()
    } catch {
      toast('Erreur lors de la suppression', 'error')
    } finally {
      setDeleting(null)
    }
  }

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
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fichiers importes</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {imports.length} import{imports.length > 1 ? 's' : ''} · Supprimer un fichier supprime aussi tous ses prospects
          </p>
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          Importer
        </button>
      </div>

      {imports.length === 0 ? (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl p-12 text-center">
          <p className="text-gray-600 text-sm">Aucun fichier importe.</p>
          <p className="text-gray-700 text-xs mt-1">
            Cliquez sur "Importer" pour ajouter un fichier Excel ou CSV.
          </p>
        </div>
      ) : (
        <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-[1fr_120px_100px_120px] gap-4 px-5 py-3 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase tracking-wider">
            <span>Fichier</span>
            <span>Prospects</span>
            <span>Date</span>
            <span className="text-right">Action</span>
          </div>
          <div className="divide-y divide-gray-800/60">
            {imports.map(imp => (
              <div
                key={imp.id}
                className="grid grid-cols-[1fr_120px_100px_120px] gap-4 px-5 py-3.5 items-center"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{imp.nom_fichier}</p>
                </div>
                <span className="text-sm text-gray-400">
                  {imp.nb_prospects} prospect{imp.nb_prospects > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-gray-600">{fmtDate(imp.date_import)}</span>
                <div className="flex justify-end">
                  {confirm === imp.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-orange-400">Confirmer ?</span>
                      <button
                        onClick={() => handleDelete(imp)}
                        disabled={deleting === imp.id}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                      >
                        Oui
                      </button>
                      <button
                        onClick={() => setConfirm(null)}
                        className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs font-medium rounded-lg transition-colors"
                      >
                        Non
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(imp)}
                      disabled={deleting === imp.id}
                      className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 border border-red-900/30 hover:border-red-800/50 text-red-400 hover:text-red-300 text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                    >
                      {deleting === imp.id ? 'Suppression...' : 'Supprimer'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onImport={handleImport} />
      )}
    </div>
  )
}
