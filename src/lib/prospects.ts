import { supabase } from './supabase'

export type Statut =
  | 'nouveau'
  | 'nrp'
  | 'a_rappeler'
  | 'rdv'
  | 'no_show'
  | 'demo_envoyee'
  | 'en_attente'
  | 'pas_interesse'
  | 'deja_site'
  | 'close'
  | 'poubelle'

export type Prospect = {
  id: string
  nom: string
  telephone: string
  departement: string
  statut: Statut
  nb_tentatives: number
  derniere_relance: string | null
  prochaine_relance: string | null
  note: string | null
  fiche_google: string | null
  import_id: string | null
  date_creation: string
}

export type NewProspect = {
  nom: string
  telephone: string
  departement: string
  statut: Statut
  note?: string | null
  fiche_google?: string | null
  nb_tentatives?: number
  derniere_relance?: string | null
  prochaine_relance?: string | null
}

export type Appel = {
  id: string
  prospect_id: string
  date: string
  statut: string
  note: string | null
}

export type Import = {
  id: string
  nom_fichier: string
  date_import: string
  nb_prospects: number
}

export async function getProspects(): Promise<Prospect[]> {
  const { data, error } = await supabase
    .from('prospects')
    .select('*')
    .order('date_creation', { ascending: false })
  if (error) throw error
  return data as Prospect[]
}

export async function getProspectsPage(params: {
  page: number
  limit: number
  statut?: string
  search?: string
  departement?: string
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}): Promise<{ data: Prospect[]; count: number }> {
  const { page, limit, statut, search, departement, orderBy = 'date_creation', orderDir = 'desc' } = params
  const from = (page - 1) * limit
  const to = from + limit - 1

  let query = supabase
    .from('prospects')
    .select('*', { count: 'exact' })
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (statut) query = query.eq('statut', statut)
  if (departement) query = query.eq('departement', departement)
  if (search) query = query.or(`nom.ilike.%${search}%,telephone.ilike.%${search}%`)

  const { data, error, count } = await query
  if (error) throw error
  return { data: data as Prospect[], count: count ?? 0 }
}

export async function exportProspects(params: {
  statut?: string
  search?: string
  departement?: string
}): Promise<Prospect[]> {
  let query = supabase
    .from('prospects')
    .select('*')
    .order('date_creation', { ascending: false })

  if (params.statut) query = query.eq('statut', params.statut)
  if (params.departement) query = query.eq('departement', params.departement)
  if (params.search) query = query.or(`nom.ilike.%${params.search}%,telephone.ilike.%${params.search}%`)

  const { data, error } = await query
  if (error) throw error
  return data as Prospect[]
}

export async function getDepartements(): Promise<string[]> {
  const { data, error } = await supabase.from('prospects').select('departement')
  if (error) return []
  const unique = [...new Set((data ?? []).map(r => r.departement).filter(Boolean))] as string[]
  return unique.sort()
}

export async function getExistingPhones(): Promise<Set<string>> {
  const { data } = await supabase.from('prospects').select('telephone')
  const phones = new Set((data ?? []).map(r => r.telephone.replace(/\s/g, '')))
  return phones
}

export async function getAppels(prospectId: string): Promise<Appel[]> {
  const { data, error } = await supabase
    .from('appels')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('date', { ascending: false })
  if (error) throw error
  return data as Appel[]
}

export async function addAppel(params: {
  prospectId: string
  statut: Statut
  note: string
}): Promise<void> {
  await supabase.from('appels').insert({
    prospect_id: params.prospectId,
    statut: params.statut,
    note: params.note || null,
  })
}

export async function updateProspect(
  id: string,
  updates: Partial<Omit<Prospect, 'id' | 'date_creation'>>
): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Prospect
}

export async function bulkDeleteProspects(ids: string[]): Promise<void> {
  const { error } = await supabase.from('prospects').delete().in('id', ids)
  if (error) throw error
}

export async function bulkUpdateStatut(ids: string[], statut: Statut): Promise<void> {
  const { error } = await supabase.from('prospects').update({ statut }).in('id', ids)
  if (error) throw error
}

export async function addProspect(prospect: NewProspect): Promise<Prospect> {
  const { data, error } = await supabase
    .from('prospects')
    .insert({
      nom: prospect.nom,
      telephone: prospect.telephone,
      departement: prospect.departement,
      statut: prospect.statut,
      note: prospect.note ?? null,
      fiche_google: prospect.fiche_google ?? null,
      nb_tentatives: prospect.nb_tentatives ?? 0,
      derniere_relance: prospect.derniere_relance ?? null,
      prochaine_relance: prospect.prochaine_relance ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data as Prospect
}

export async function bulkAddProspects(
  rows: NewProspect[],
  fileName: string
): Promise<number> {
  const { data: imp, error: impErr } = await supabase
    .from('imports')
    .insert({ nom_fichier: fileName, nb_prospects: rows.length })
    .select('id')
    .single()
  if (impErr) throw impErr

  const importId = imp.id

  const { data, error } = await supabase
    .from('prospects')
    .insert(
      rows.map(r => ({
        nom: r.nom,
        telephone: r.telephone,
        departement: r.departement ?? '',
        statut: r.statut ?? 'nouveau',
        note: r.note ?? null,
        fiche_google: r.fiche_google ?? null,
        nb_tentatives: r.nb_tentatives ?? 0,
        derniere_relance: r.derniere_relance ?? null,
        prochaine_relance: r.prochaine_relance ?? null,
        import_id: importId,
      }))
    )
    .select('id')
  if (error) throw error
  return data?.length ?? 0
}

export async function deleteProspect(id: string): Promise<void> {
  const { error } = await supabase.from('prospects').delete().eq('id', id)
  if (error) throw error
}

export async function getImports(): Promise<Import[]> {
  const { data, error } = await supabase
    .from('imports')
    .select('*')
    .order('date_import', { ascending: false })
  if (error) throw error
  return data as Import[]
}

export async function deleteImport(id: string): Promise<void> {
  await supabase.from('prospects').delete().eq('import_id', id)
  const { error } = await supabase.from('imports').delete().eq('id', id)
  if (error) throw error
}
