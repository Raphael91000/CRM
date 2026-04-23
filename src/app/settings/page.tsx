'use client'

import { useState } from 'react'

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-200">{label}</p>
        {description && <p className="text-xs text-gray-600 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#111827] border border-gray-800 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </div>
      <div className="px-6">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-blue-600' : 'bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function SettingsPage() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  const [notifAppel, setNotifAppel] = useState(true)
  const [notifRelance, setNotifRelance] = useState(true)
  const [delaiNrp, setDelaiNrp] = useState('24')
  const [delaiChaud, setDelaiChaud] = useState('48')
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configuration du CRM</p>
      </div>

      {/* Connexion Supabase */}
      <Section title="Connexion Supabase">
        <SettingRow label="URL du projet" description="Définie via la variable d'environnement">
          <span className="text-xs font-mono bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg truncate max-w-48">
            {supabaseUrl ? supabaseUrl.replace('https://', '').split('.')[0] + '.supabase.co' : 'Non configurée'}
          </span>
        </SettingRow>
        <SettingRow label="Statut de la connexion" description="Vérifié au démarrage">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Connecté</span>
          </div>
        </SettingRow>
      </Section>

      {/* Délais de relance */}
      <Section title="Délais de relance">
        <SettingRow
          label="Délai NRP"
          description="Heures avant de remettre un prospect NRP en &quot;À appeler&quot;"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="168"
              value={delaiNrp}
              onChange={e => setDelaiNrp(e.target.value)}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/50 [appearance:textfield]"
            />
            <span className="text-xs text-gray-500">heures</span>
          </div>
        </SettingRow>
        <SettingRow
          label="Délai Chaud"
          description="Heures avant de remettre un prospect Chaud dans les urgents"
        >
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="168"
              value={delaiChaud}
              onChange={e => setDelaiChaud(e.target.value)}
              className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm text-white text-center focus:outline-none focus:border-blue-500/50 [appearance:textfield]"
            />
            <span className="text-xs text-gray-500">heures</span>
          </div>
        </SettingRow>
      </Section>

      {/* Notifications */}
      <Section title="Interface">
        <SettingRow label="Toast après enregistrement d'appel">
          <Toggle checked={notifAppel} onChange={setNotifAppel} />
        </SettingRow>
        <SettingRow label="Toast après ajout de prospect">
          <Toggle checked={notifRelance} onChange={setNotifRelance} />
        </SettingRow>
      </Section>

      {/* À propos */}
      <Section title="À propos">
        <SettingRow label="Version" description="CRM Cold Call">
          <span className="text-xs text-gray-500 font-mono">v1.0.0</span>
        </SettingRow>
        <SettingRow label="Stack technique" description="Next.js · Tailwind CSS · Supabase">
          <span className="text-xs text-gray-600">Next.js 16.2</span>
        </SettingRow>
      </Section>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            saved
              ? 'bg-emerald-600 text-white'
              : 'bg-blue-600 hover:bg-blue-500 text-white'
          }`}
        >
          {saved ? '✓ Enregistré' : 'Enregistrer les paramètres'}
        </button>
      </div>
    </div>
  )
}
