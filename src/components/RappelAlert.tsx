'use client'

import { useEffect, useRef, useState } from 'react'
import { getProspects, updateProspect, addAppel, Prospect, Statut } from '@/lib/prospects'
import { getStatutColor, getStatutConfig } from './StatusBadge'
import CallModal from './CallModal'
import { useToast } from './ToastProvider'

const WINDOW_MINUTES = 15

function minutesUntil(d: string): number {
  return (new Date(d).getTime() - Date.now()) / 60000
}

export default function RappelAlert() {
  const [alerts, setAlerts] = useState<Prospect[]>([])
  const [selected, setSelected] = useState<Prospect | null>(null)
  const dismissed = useRef<Set<string>>(new Set())
  const { toast } = useToast()

  useEffect(() => {
    async function check() {
      try {
        const all = await getProspects()
        const upcoming = all.filter(p => {
          if (!p.prochaine_relance) return false
          if (dismissed.current.has(p.id)) return false
          const min = minutesUntil(p.prochaine_relance)
          return min >= -2 && min <= WINDOW_MINUTES
        })
        setAlerts(upcoming)
      } catch {}
    }

    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [])

  function dismiss(id: string) {
    dismissed.current.add(id)
    setAlerts(prev => prev.filter(p => p.id !== id))
  }

  async function handleSaveCall(id: string, statut: Statut, note: string, prochaine: string) {
    const current = alerts.find(p => p.id === id)
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
    window.dispatchEvent(new CustomEvent('prospects-changed'))
    dismiss(id)
  }

  if (alerts.length === 0 && !selected) return null

  return (
    <>
      <div className="fixed bottom-5 right-5 z-40 flex flex-col gap-2 max-w-sm w-full">
        {alerts.map(p => {
          const min = Math.round(minutesUntil(p.prochaine_relance!))
          const color = getStatutColor(p.statut)
          const cfg = getStatutConfig(p.statut)
          const timeLabel = min <= 0 ? "Maintenant" : `Dans ${min} min`

          return (
            <div
              key={p.id}
              className="bg-[#111827] border border-gray-700 rounded-2xl shadow-2xl p-4 flex gap-3 items-start animate-in slide-in-from-right-4 duration-300"
              style={{ borderLeft: `3px solid ${color}` }}
            >
              {/* Bell */}
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${color}20` }}>
                  <svg className="w-4 h-4" fill="none" stroke={color} viewBox="0 0 24 24" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold" style={{ color }}>{timeLabel}</span>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border"
                    style={{ color, borderColor: `${color}40`, backgroundColor: `${color}15` }}
                  >
                    {cfg.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white truncate">{p.nom}</p>
                <p className="text-xs text-gray-500">{p.telephone}</p>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <button
                  onClick={() => { setSelected(p); dismiss(p.id) }}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white transition-colors"
                  style={{ backgroundColor: color }}
                >
                  Appeler
                </button>
                <button
                  onClick={() => dismiss(p.id)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors text-center"
                >
                  Ignorer
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <CallModal
          prospect={selected}
          onClose={() => setSelected(null)}
          onSave={handleSaveCall}
        />
      )}
    </>
  )
}
