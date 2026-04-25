const TZ = 'Europe/Paris'

/** Formate une Date en string pour input datetime-local, en heure de Paris */
export function toParisInput(d: Date): string {
  return d.toLocaleString('sv-SE', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).replace(' ', 'T').slice(0, 16)
}

/** Convertit la valeur d'un input datetime-local (interprétée comme heure de Paris) en UTC ISO */
export function parisInputToISO(s: string): string | null {
  if (!s) return null
  const [datePart, timePart = '00:00'] = s.split('T')
  const [y, mo, d] = datePart.split('-').map(Number)
  const [h, min] = timePart.split(':').map(Number)

  // Offset Paris à midi ce jour-là (évite les cas limites DST à minuit)
  const noonUTC = new Date(Date.UTC(y, mo - 1, d, 12, 0))
  const parisOffset = parseInt(
    noonUTC.toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })
  ) - 12 // +1 (CET) ou +2 (CEST)

  return new Date(Date.UTC(y, mo - 1, d, h - parisOffset, min)).toISOString()
}

/** Heure courante à Paris (0-23) */
export function currentParisHour(): number {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: TZ, hour: 'numeric', hour12: false })
  )
}
