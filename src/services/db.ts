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
    if (error) console.error("Save Theme Error", error)
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
    if (error) console.error("Save User Error", error)
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
    
    // Mapear de snake_case para camelCase
    return (data || []).map(row => {
      const act = { ...row } as any;
      if (act.data_prevista_finalizacao !== undefined) act.dataPrevistaFinalizacao = act.data_prevista_finalizacao;
      if (act.percentual_andamento !== undefined) act.percentualAndamento = act.percentual_andamento;
      if (act.data_finalizada !== undefined) act.dataFinalizada = act.data_finalizada;
      if (act.esforco_realizado !== undefined) act.esforcoRealizado = act.esforco_realizado;
      if (act.dias_esperados_conclusao !== undefined) act.diasEsperadosConclusao = act.dias_esperados_conclusao;

      delete act.data_prevista_finalizacao;
      delete act.percentual_andamento;
      delete act.data_finalizada;
      delete act.esforco_realizado;
      delete act.dias_esperados_conclusao;
      return act;
    });
  },
  async saveActivity(act: Omit<Activity, 'id'> | Activity) {
    if (!isCloudEnabled) return
    
    // Mapear camelCase para snake_case do Supabase
    const dbPayload = { ...act } as any;
    dbPayload.data_prevista_finalizacao = (act as any).dataPrevistaFinalizacao;
    dbPayload.percentual_andamento = (act as any).percentualAndamento;
    dbPayload.data_finalizada = (act as any).dataFinalizada;
    dbPayload.esforco_realizado = (act as any).esforcoRealizado;
    dbPayload.dias_esperados_conclusao = (act as any).diasEsperadosConclusao;
    
    // Remover chaves camelCase para não dar erro Schema no Supabase
    delete dbPayload.dataPrevistaFinalizacao;
    delete dbPayload.percentualAndamento;
    delete dbPayload.dataFinalizada;
    delete dbPayload.esforcoRealizado;
    delete dbPayload.diasEsperadosConclusao;

    const { data, error } = await supabase.from('activities').upsert(dbPayload).select()
    if (error) console.error("Save Activity Error", error)
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
    
    return (data || []).map(row => {
      const evt = { ...row } as any;
      if (evt.end_date !== undefined) evt.endDate = evt.end_date;
      if (evt.postponed_date !== undefined) evt.postponedDate = evt.postponed_date;
      
      delete evt.end_date;
      delete evt.postponed_date;
      return evt;
    });
  },
  async saveHenkaten(evt: Omit<HenkatenEvent, 'id'> | HenkatenEvent) {
    if (!isCloudEnabled) return
    
    const dbPayload = { ...evt } as any;
    if (dbPayload.endDate !== undefined) dbPayload.end_date = dbPayload.endDate;
    if (dbPayload.postponedDate !== undefined) dbPayload.postponed_date = dbPayload.postponedDate;
    
    delete dbPayload.endDate;
    delete dbPayload.postponedDate;

    const { data, error } = await supabase.from('henkatens').upsert(dbPayload).select()
    if (error) console.error("Save Henkaten Error", error)
    return { data, error }
  },
  async deleteHenkaten(id: string) {
    if (!isCloudEnabled) return
    return await supabase.from('henkatens').delete().eq('id', id)
  },
};
