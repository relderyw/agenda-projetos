import React, { useState, useMemo } from 'react';
import { Download, RefreshCw, Calendar, Trash2 } from 'lucide-react';
import type { User, AbsenteeismRecord, AbsenteeismStatus } from '../types';

interface Props {
  currentUser: User | null;
  users: User[];
  records: AbsenteeismRecord[];
  onSaveRecord: (record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord) => Promise<void>;
  onDeleteRecord: (userId: string, date: string) => Promise<void>;
}

const STATUS_LEGEND: { status: AbsenteeismStatus; label: string; color: string; bg: string } = [
  { status: 'P', label: 'Presente', color: '#fff', bg: '#22c55e' },
  { status: 'F', label: 'Falta', color: '#fff', bg: '#ef4444' },
  { status: 'A', label: 'Atraso', color: '#000', bg: '#eab308' },
  { status: 'AR', label: 'Atraso da rota', color: '#fff', bg: '#f97316' },
  { status: 'PR', label: 'Perda da rota', color: '#fff', bg: '#c2410c' },
  { status: 'ER', label: 'Esquecimento do registro do ponto', color: '#fff', bg: '#ec4899' },
  { status: 'EC', label: 'Esquecimento de Crachá', color: '#000', bg: '#fca5a5' },
  { status: 'LM', label: 'Licença Médica', color: '#fff', bg: '#3b82f6' },
  { status: 'SA', label: 'Saída Antecipada', color: '#000', bg: '#86efac' },
  { status: 'TR', label: 'Treinamento', color: '#fff', bg: '#ca8a04' },
  { status: 'FE', label: 'Férias', color: '#000', bg: '#7dd3fc' },
  { status: 'FO', label: 'Folga', color: '#fff', bg: '#c084fc' },
  { status: 'DE', label: 'Declaração', color: '#fff', bg: '#a855f7' },
  { status: 'LP', label: 'Licença Paternidade', color: '#000', bg: '#93c5fd' },
  { status: 'AF', label: 'AFASTAMENTO', color: '#fff', bg: '#991b1b' },
];

export default function AbsenteismoTab({ currentUser, users, records, onSaveRecord, onDeleteRecord }: Props) {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeStatus, setActiveStatus] = useState<AbsenteeismStatus | 'LIMPAR'>('P');
  const [isSaving, setIsSaving] = useState(false);

  // Consider as "analistas" (or everyone if we want to track everyone)
  // According to standard behavior, only Analistas typically get tracked, or maybe everyone. 
  // Let's filter management and admins if not needed or show everyone.
  const trackableUsers = useMemo(() => users.filter(u => u.role === 'Analista' || u.role === 'Gestão'), [users]);

  // Extract year and month, compute days in month
  const { year, monthIndex, daysInMonth, daysArray } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dInMonth = new Date(y, m, 0).getDate(); // last day of month
    const arr = Array.from({ length: dInMonth }, (_, i) => {
      const dateObj = new Date(y, m - 1, i + 1);
      const wd = dateObj.getDay();
      const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      return { day: i + 1, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, weekDay: weekDays[wd] };
    });
    return { year: y, monthIndex: m - 1, daysInMonth: dInMonth, daysArray: arr };
  }, [selectedMonth]);

  const monthRecords = useMemo(() => {
    return records.filter(r => r.date.startsWith(selectedMonth));
  }, [records, selectedMonth]);

  const getRecord = (userId: string, dateStr: string) => {
    return monthRecords.find(r => r.userId === userId && r.date === dateStr);
  };

  const handleCellClick = async (userId: string, dateStr: string) => {
    // Only Gestão or Admin can edit (or if we allow users, check permissions). Let's restrict to Admin/Gestão
    if (currentUser?.role !== 'Administrador' && currentUser?.role !== 'Gestão') {
      return;
    }

    setIsSaving(true);
    try {
      if (activeStatus === 'LIMPAR') {
        await onDeleteRecord(userId, dateStr);
      } else {
        const existing = getRecord(userId, dateStr);
        await onSaveRecord({
          id: existing?.id, // se já existe, envia para fazer update
          userId,
          date: dateStr,
          status: activeStatus,
          updatedBy: currentUser.id
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Funcionário', ...daysArray.map(d => `${d.day} (${d.weekDay})`), 'Presenças', 'Faltas', 'Taxa Ausência'];
    const rows = trackableUsers.map(u => {
      let calcP = 0;
      let calcF = 0;
      let calcOther = 0;
      
      const dayCells = daysArray.map(d => {
        const rec = getRecord(u.id, d.dateStr);
        if (rec) {
          if (rec.status === 'P') calcP++;
          else if (['F','A','AR','PR','ER','EC','SA','AF'].includes(rec.status)) calcF++;
          else calcOther++;
        }
        return rec ? rec.status : '';
      });

      const totalDays = calcP + calcF;
      const rate = totalDays > 0 ? ((calcF / totalDays) * 100).toFixed(1) + '%' : '0%';
      return [`"${u.name}"`, ...dayCells, calcP, calcF, rate].join(';');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encodedUri;
    link.download = `Absenteismo_${selectedMonth}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Summarize the month for the bottom "Total" row and charts
  const { summaryTotals, codeCounts } = useMemo(() => {
    const totalsPerDay = new Array(daysInMonth).fill(0);
    const codeMap: Record<string, number> = {};
    let totalAbsenceFlagged = 0;

    monthRecords.forEach(r => {
      if (r.status !== 'P' && r.status !== 'FO' && r.status !== 'FE') {
        const day = parseInt(r.date.split('-')[2], 10);
        totalsPerDay[day - 1]++;
        codeMap[r.status] = (codeMap[r.status] || 0) + 1;
        totalAbsenceFlagged++;
      }
    });

    return { summaryTotals: totalsPerDay, codeCounts: codeMap, totalAbsenceFlagged };
  }, [monthRecords, daysInMonth]);

  const ptMonths = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%' }}>
      {/* HEADER */}
      <div className="tab-header">
        <div>
          <h1 className="tab-title">Absenteísmo</h1>
          <p className="tab-subtitle">Controle de presença e ponto dos funcionários</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {(currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão') && (
            <button className="btn-ghost" onClick={exportCSV} title="Exportar para Excel (CSV)">
              <Download size={18} /> Exportar Excel
            </button>
          )}
        </div>
      </div>

      {/* LEGENDA */}
      <div className="table-card" style={{ padding: '1rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Legenda</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {STATUS_LEGEND.map(leg => (
            <div key={leg.status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '200px' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: leg.bg, color: leg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {leg.status}
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{leg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CONTROLES */}
      <div className="table-card" style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Registro de Presença</h3>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Mês:</span>
               <div className="input-icon-wrap" style={{ width: 'auto' }}>
                  <Calendar size={16} />
                  <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
               </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Ferramenta (Pincel):</span>
               <select 
                 value={activeStatus} 
                 onChange={e => setActiveStatus(e.target.value as AbsenteeismStatus | 'LIMPAR')}
                 style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-layer)', color: 'var(--text-primary)' }}
               >
                  <option value="LIMPAR">Limpar Célula</option>
                  <optgroup label="Status">
                     {STATUS_LEGEND.map(s => <option key={s.status} value={s.status}>{s.status} - {s.label}</option>)}
                  </optgroup>
               </select>
            </div>
            {isSaving && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><RefreshCw size={14} className="spinner" /> Salvando...</div>}
          </div>
        </div>

        {/* MÊS TÍTULO */}
        {year && (
          <h4 style={{ marginBottom: '1rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
            Visão de {ptMonths[monthIndex]} de {year}
          </h4>
        )}

        {/* TABELA DE REGISTRO */}
        <div className="table-scroll custom-scroll" style={{ flex: 1 }}>
          <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
             <thead>
                <tr>
                   <th style={{ width: '250px', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-card)' }}>Funcionário</th>
                   {daysArray.map(d => (
                     <th key={d.day} style={{ width: '40px', minWidth: '40px', textAlign: 'center', padding: '0.2rem', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                           <b style={{ fontSize: '0.9rem' }}>{d.day}</b>
                           <span style={{ color: 'var(--text-muted)' }}>{d.weekDay}</span>
                        </div>
                     </th>
                   ))}
                   <th style={{ width: '60px', textAlign: 'center' }}>P</th>
                   <th style={{ width: '60px', textAlign: 'center' }}>F/A</th>
                   <th style={{ width: '80px', textAlign: 'center' }}>Taxa Ausência</th>
                </tr>
             </thead>
             <tbody>
                {trackableUsers.map(user => {
                   let calcP = 0;
                   let calcF = 0;

                   return (
                     <tr key={user.id} className="data-row">
                        <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-layer)' }}>
                           <span style={{ fontWeight: 500 }}>{user.name}</span>
                        </td>
                        {daysArray.map(d => {
                           const rec = getRecord(user.id, d.dateStr);
                           const leg = rec ? STATUS_LEGEND.find(l => l.status === rec.status) : null;
                           
                           if (rec) {
                              if (rec.status === 'P') calcP++;
                              else if (['F','A','AR','PR','ER','EC','SA','AF'].includes(rec.status)) calcF++;
                           }

                           return (
                             <td 
                               key={d.day}
                               onClick={() => handleCellClick(user.id, d.dateStr)}
                               style={{ 
                                 textAlign: 'center', 
                                 cursor: 'pointer',
                                 padding: '2px',
                                 border: '1px solid var(--border-color)'
                               }}
                             >
                               {leg ? (
                                 <div style={{ 
                                   width: '100%', height: '100%', minHeight: '30px',
                                   background: leg.bg, color: leg.color, 
                                   display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                   fontWeight: 'bold', fontSize: '0.8rem', borderRadius: '4px'
                                 }}>
                                    {rec.status}
                                 </div>
                               ) : (
                                 <div style={{ width: '100%', height: '100%', minHeight: '30px', background: 'transparent' }} />
                               )}
                             </td>
                           )
                        })}
                        {/* Totals per user */}
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#22c55e' }}>{calcP}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#ef4444' }}>{calcF}</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                           {calcP + calcF > 0 ? ((calcF / (calcP + calcF)) * 100).toFixed(1) + '%' : '0%'}
                        </td>
                     </tr>
                   )
                })}
                {/* LINHA DE TOTAIS GERAIS */}
                <tr style={{ background: 'var(--bg-layer)', borderTop: '2px solid var(--border-color)' }}>
                   <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-layer)', fontWeight: 'bold', borderRight: '1px solid var(--border-color)' }}>
                      Total Absenteísmo
                   </td>
                   {summaryTotals.map((tot, idx) => (
                      <td key={idx} style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', color: tot > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                         {tot}
                      </td>
                   ))}
                   <td colSpan={3} />
                </tr>
             </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}
