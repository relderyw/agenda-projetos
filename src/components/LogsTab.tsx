import React, { useEffect, useState, useMemo } from 'react';
import { ShieldAlert, UserCheck, UserX, Activity as ActivityIcon } from 'lucide-react';
import type { Activity, User } from '../types';
import { supabase } from '../lib/supabase';

interface Props {
  currentUser: User | null;
  users: User[];
  activities: Activity[];
}

export default function LogsTab({ currentUser, users, activities }: Props) {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, { lastSeen: Date }>>({});

  useEffect(() => {
    if (!currentUser) return;
    
    // Conecta no canal de tracking de Presença
    const roomOne = supabase.channel('online-users');

    roomOne
      .on('presence', { event: 'sync' }, () => {
        const newState = roomOne.presenceState();
        const activeMap: Record<string, { lastSeen: Date }> = {};
        
        Object.keys(newState).forEach(key => {
          const presences = newState[key] as any[];
          presences.forEach(presence => {
            if (presence.userId) {
              activeMap[presence.userId] = { lastSeen: new Date() };
            }
          });
        });

        setOnlineUsers(activeMap);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          // Quando conectar, envia o estado da própria pessoa pro mundo
          await roomOne.track({
            userId: currentUser.id,
            onlineAt: new Date().toISOString(),
          });
        }
      });

    return () => {
      roomOne.unsubscribe();
    };
  }, [currentUser]);

  // Checa quem já atualizou a agenda hoje (Qualquer analista com Atividade onde planejamento === Hojé)
  const todayStr = new Date().toISOString().slice(0, 10);
  
  const analysts = useMemo(() => users.filter(u => u.role === 'Analista'), [users]);
  
  const analystsUpdateStatus = useMemo(() => {
    return analysts.map(analyst => {
      // Verifica se o analista tem ALGUMA atividade planejada para HOJE
      const hasUpdatesToday = activities.some(
        a => a.responsavel === analyst.id && a.planejamento === todayStr
      );
      return { 
        ...analyst, 
        hasUpdatesToday 
      };
    }).sort((a, b) => {
      // Ordenar pendentes primeiro
      if (a.hasUpdatesToday && !b.hasUpdatesToday) return 1;
      if (!a.hasUpdatesToday && b.hasUpdatesToday) return -1;
      return a.name.localeCompare(b.name);
    });
  }, [activities, analysts, todayStr]);

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
          <h1 className="tab-title">Logs e Monitoramento</h1>
          <p className="tab-subtitle">Conectividade e acompanhamento de agenda dia-a-dia da equipe de analistas.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '2rem', marginTop: '1rem' }}>
        
        {/* Painel de Atualização da Agenda (Analistas) */}
        <div className="dash-card">
          <div className="dash-card-header">
            <ActivityIcon size={18} />
            <h3>Agenda Preenchida ({todayStr.split('-').reverse().join('/')})</h3>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Alerta para saber se os analistas lançaram atividades com a data de planejamento de hoje.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {analystsUpdateStatus.length === 0 && <p className="empty-state-msg">Nenhum analista cadastrado.</p>}
            
            {analystsUpdateStatus.map(analista => (
              <div key={analista.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '12px',
                border: `1px solid ${analista.hasUpdatesToday ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div className="user-avatar" style={{ background: analista.color }}>{analista.name[0]}</div>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{analista.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {analista.hasUpdatesToday ? (
                    <span className="status-badge badge-green" style={{ background: 'rgba(16,185,129,0.1)' }}>
                      <UserCheck size={14} /> Atualizado
                    </span>
                  ) : (
                    <span className="status-badge badge-red" style={{ background: 'rgba(239,68,68,0.1)' }}>
                      <UserX size={14} /> Pendente
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Painel de Usuários Conectados Online */}
        <div className="dash-card">
          <div className="dash-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="cloud-dot pulse" style={{ display: 'inline-block' }} />
              <h3>Usuários Online Agora</h3>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Monitoramento de sessão ativa pelo banco da estrutura em nuvem. (Você e os demais conectados).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {users.map(u => {
              const isOnline = !!onlineUsers[u.id] || u.id === currentUser?.id; // Força online pro próprio user caso atrase socket
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'var(--bg-input)', padding: '0.75rem 1rem', borderRadius: '12px',
                  opacity: isOnline ? 1 : 0.6
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div className="user-avatar" style={{ background: u.color }}>{u.name[0]}</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{u.role}</span>
                    </div>
                  </div>
                  <div>
                    {isOnline ? (
                      <span className="status-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                        Online
                      </span>
                    ) : (
                      <span className="status-badge" style={{ background: 'var(--border-strong)', color: 'var(--text-muted)' }}>
                        Offline
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
