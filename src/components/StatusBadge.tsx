import { Statut } from '@/lib/prospects'

type Config = { label: string; classes: string; color: string }

const CONFIG: Record<Statut, Config> = {
  nouveau:       { label: 'Nouveau',       color: '#3b82f6', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  nrp:           { label: 'NRP',           color: '#f97316', classes: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  a_rappeler:    { label: 'A rappeler',    color: '#06b6d4', classes: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  rdv:           { label: 'RDV',           color: '#22c55e', classes: 'bg-green-500/15 text-green-400 border-green-500/30' },
  no_show:       { label: 'No show',       color: '#eab308', classes: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  demo_envoyee:  { label: 'Demo envoyee',  color: '#8b5cf6', classes: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  pas_interesse: { label: 'Pas interesse', color: '#6b7280', classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
  deja_site:     { label: 'Deja site',     color: '#a78bfa', classes: 'bg-purple-400/10 text-purple-300 border-purple-400/20' },
  close:         { label: 'Close',         color: '#10b981', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  poubelle:      { label: 'Poubelle',      color: '#ef4444', classes: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

export function getStatutConfig(statut: Statut): Config {
  return CONFIG[statut] ?? { label: statut, color: '#6b7280', classes: 'bg-gray-500/15 text-gray-400 border-gray-500/30' }
}

export function getStatutColor(statut: Statut): string {
  return CONFIG[statut]?.color ?? '#6b7280'
}

export const CALL_STATUTS: Statut[] = ['nrp', 'a_rappeler', 'rdv', 'no_show', 'demo_envoyee', 'pas_interesse', 'deja_site', 'close']

export const ALL_STATUTS = Object.entries(CONFIG).map(([value, cfg]) => ({
  value: value as Statut,
  label: cfg.label,
}))

export const SIDEBAR_CATEGORIES: { statut: Statut | null; label: string }[] = [
  { statut: null,             label: 'Tout' },
  { statut: 'nouveau',       label: 'Nouveau' },
  { statut: 'nrp',           label: 'NRP' },
  { statut: 'a_rappeler',    label: 'A rappeler' },
  { statut: 'rdv',           label: 'RDV' },
  { statut: 'no_show',       label: 'No show' },
  { statut: 'demo_envoyee',  label: 'Demo envoyee' },
  { statut: 'pas_interesse', label: 'Pas interesse' },
  { statut: 'deja_site',     label: 'Deja site' },
  { statut: 'close',         label: 'Close' },
  { statut: 'poubelle',      label: 'Poubelle' },
]

type Props = { statut: Statut; size?: 'sm' | 'md' }

export default function StatusBadge({ statut, size = 'sm' }: Props) {
  const { label, classes } = getStatutConfig(statut)
  const padding = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${padding} ${classes}`}>
      {label}
    </span>
  )
}
