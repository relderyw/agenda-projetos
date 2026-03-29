import { supabase } from '../lib/supabase'
import { defaultActivities, defaultThemes, defaultUsers, defaultHenkatens } from '../data'
import type { Activity, Theme, User, HenkatenEvent } from '../types'

const isCloudEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const dbService = {
  // --- TEMAS ---
  async getThemes(): Promise<Theme[]> {
    if (!isCloudEnabled) return defaultThemes
    const { data, error } = await supabase.from('themes').select('*').order('name', { ascending: true })
    if (error) { console.error('GetThemes Error:', error); return defaultThemes }
    return data || []
  },
  async saveTheme(theme: Omit<Theme, 'id'> | Theme) {
    if (!isCloudEnabled) return
    const { data, error } = await supabase.from('themes').upsert(theme).select()
    return { data, error }
  },
  async deleteTheme(id: string) {
    if (!isCloudEnabled) return
    return await supabase.from('themes').delete().eq('id', id)
  },

  // --- USUÁRIOS ---
  async getUsers(): Promise<User[]> {
    if (!isCloudEnabled) return defaultUsers
    const { data, error } = await supabase.from('users').select('*').order('name', { ascending: true })
    if (error) { console.error('GetUsers Error:', error); return defaultUsers }
    return data || []
  },
  async saveUser(user: Omit<User, 'id'> | User) {
    if (!isCloudEnabled) return
    const { data, error } = await supabase.from('users').upsert(user).select()
    return { data, error }
  },
  async deleteUser(id: string) {
    if (!isCloudEnabled) return
    return await supabase.from('users').delete().eq('id', id)
  },

  // --- ATIVIDADES ---
  async getActivities(): Promise<Activity[]> {
    if (!isCloudEnabled) return defaultActivities
    const { data, error } = await supabase.from('activities').select('*').order('planejamento', { ascending: true })
    if (error) { console.error('GetActivities Error:', error); return defaultActivities }
    return data || []
  },
  async saveActivity(act: Omit<Activity, 'id'> | Activity) {
    if (!isCloudEnabled) return
    const { data, error } = await supabase.from('activities').upsert(act).select()
    return { data, error }
  },
  async deleteActivity(id: string) {
    if (!isCloudEnabled) return
    return await supabase.from('activities').delete().eq('id', id)
  },

  // --- HENKATENS ---
  async getHenkatens(): Promise<HenkatenEvent[]> {
    if (!isCloudEnabled) return defaultHenkatens
    const { data, error } = await supabase.from('henkatens').select('*').order('date', { ascending: true })
    if (error) { console.error('GetHenkatens Error:', error); return defaultHenkatens }
    return data || []
  },
  async saveHenkaten(evt: Omit<HenkatenEvent, 'id'> | HenkatenEvent) {
    if (!isCloudEnabled) return
    const { data, error } = await supabase.from('henkatens').upsert(evt).select()
    return { data, error }
  },
  async deleteHenkaten(id: string) {
    if (!isCloudEnabled) return
    return await supabase.from('henkatens').delete().eq('id', id)
  }
}
