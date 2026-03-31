import React, { useEffect, useState, useMemo } from 'react';
import { ShieldAlert, UserCheck, UserX, Activity as ActivityIcon, Clock } from 'lucide-react';
import type { Activity, User, LogEntry } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  currentUser: User | null;
  users: User[];
  activities: Activity[];
  logs: LogEntry[];
  onlineUsers: Record<string, boolean>;
  realtimeStatus: 'connecting' | 'connected' | 'error';
}

export default function LogsTab({ currentUser, users, activities, logs, onlineUsers, realtimeStatus }: Props) {
  // Checa quem já atualizou a agenda hoje baseada nos LOGS REAIS
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const analysts = useMemo(() => users.filter(u => u.role === 'Analista'), [users]);
  
  const analystsUpdateStatus = useMemo(() => {
    return analysts.map(analyst => {
      // Filtra logs deste analista hoje
      const userLogsToday = logs.filter(l => l.userId === analyst.id);
      const hasUpdatesToday = userLogsToday.length > 0;
      const lastUpdate = hasUpdatesToday ? userLogsToday[0].timestamp : null;
      
      return { 
        ...analyst, 
        hasUpdatesToday,
        updateCount: userLogsToday.length,
        lastUpdateTime: lastUpdate ? new Date(lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null
      };
    }).sort((a, b) => {
      // Ordenar quem atualizou por último no topo, depois pendentes
      if (a.hasUpdatesToday && !b.hasUpdatesToday) return -1;
      if (!a.hasUpdatesToday && b.hasUpdatesToday) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [logs, analysts]);

  if (currentUser?.role !== 'Administrador') {
    return (
      <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
        <ShieldAlert size={64} style={{ marginBottom: '1rem', color: 'var(--text-muted)' }} />
        <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Acesso Restrito</h2>
        <p style={{ color: 'var(--text-muted)' }}>Apenas administradores podem visualizar os logs de conectividade.</p>
      </div>
    );
  }

  return (
    <div className="tab-content logs-tab">
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Relatório de Atividade Real</h1>
          <p className="tab-subtitle">Resumo de quem realmente interagiu com o sistema no dia de hoje.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {realtimeStatus === 'connected' ? (
            <span style={{ fontSize: '0.7rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(16,185,129,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
              <div className="cloud-dot pulse" style={{ width: 6, height: 6 }} /> Monitoramento Ativo
            </span>
          ) : realtimeStatus === 'error' ? (
            <span style={{ fontSize: '0.7rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: '6px' }}>
              Falha no Sincronismo
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'var(--bg-input)', padding: '4px 8px', borderRadius: '6px' }}>
              Sincronizando...
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.2fr) minmax(0,0.8fr)', gap: '2rem', marginTop: '1rem' }}>
        
        {/* Painel de Atualização da Agenda (Analistas) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <ActivityIcon size={18} />
            <h3>Ações Realizadas ({todayStr.split('-').reverse().join('/')})</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Baseado em cliques reais nos botões de salvar, editar e excluir do sistema.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {analystsUpdateStatus.length === 0 && <p className="empty-state-msg">Nenhum analista cadastrado.</p>}
            
            {analystsUpdateStatus.map(analista => (
              <div key={analista.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-input)', padding: '1rem', borderRadius: '16px',
                border: `1px solid ${analista.hasUpdatesToday ? 'rgba(16,185,129,0.1)' : 'transparent'}`,
                boxShadow: analista.hasUpdatesToday ? '0 4px 12px rgba(16,185,129,0.05)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="user-avatar" style={{ background: analista.color, width: 40, height: 40, fontSize: '1.1rem' }}>{analista.name[0]}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{analista.name}</span>
                    {analista.hasUpdatesToday ? (
                      <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 500 }}>
                         {analista.updateCount} {analista.updateCount === 1 ? 'alteração realizada' : 'alterações realizadas'}
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Nenhuma ação detectada hoje</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  {analista.hasUpdatesToday ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        <Clock size={12} />
                        <span>{analista.lastUpdateTime}</span>
                      </div>
                      <span className="status-badge badge-green" style={{ background: 'rgba(16,185,129,0.1)', fontSize: '0.7rem' }}>
                        <UserCheck size={12} /> ATIVO
                      </span>
                    </>
                  ) : (
                    <span className="status-badge badge-red" style={{ background: 'rgba(239,68,68,0.1)', fontSize: '0.7rem', opacity: 0.7 }}>
                      <UserX size={12} /> INATIVO
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Últimas Ações Globais (Feed de Log) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <ShieldAlert size={18} />
            <h3>Feed de Alterações</h3>
          </div>
          <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scroll">
            {logs.length === 0 && <p className="empty-state-msg">Sem atividades registradas no momento.</p>}
            {logs.slice(0, 15).map((log) => (
              <div key={log.id} style={{ 
                padding: '0.75rem', 
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{log.userName}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {log.action} <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}> - {log.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
