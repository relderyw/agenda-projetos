import React, { useState, useMemo } from 'react';
import { Download, RefreshCw, Calendar, Trash2, Users, Clock, Tag, Plus, Edit2, X, Save, SaveAll } from 'lucide-react';
import type { User, Employee, AbsenteeismRecord, AbsenteeismStatus, OvertimeRecord } from '../types';

interface Props {
  currentUser: User | null;
  employees: Employee[];
  absenteeismRecords: AbsenteeismRecord[];
  overtimeRecords: OvertimeRecord[];
  onSaveAbsenteeism: (record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord) => Promise<void>;
  onDeleteAbsenteeism: (employeeId: string, date: string) => Promise<void>;
  onSaveEmployee: (emp: Employee) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onSaveOvertime: (record: Omit<OvertimeRecord, 'id'> | OvertimeRecord) => Promise<void>;
  onDeleteOvertime: (id: string) => Promise<void>;
}

const STATUS_LEGEND: { status: AbsenteeismStatus; label: string; color: string; bg: string }[] = [
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

export default function AbsenteismoTab({
  currentUser, employees, absenteeismRecords, overtimeRecords,
  onSaveAbsenteeism, onDeleteAbsenteeism,
  onSaveEmployee, onDeleteEmployee,
  onSaveOvertime, onDeleteOvertime
}: Props) {
  const [subTab, setSubTab] = useState<'absenteismo' | 'hora-extra' | 'funcionarios'>('absenteismo');
  const canEdit = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão';

  // State: Absenteísmo
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeStatus, setActiveStatus] = useState<AbsenteeismStatus | 'LIMPAR'>('P');
  const [isSaving, setIsSaving] = useState(false);

  // Memos globais
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Ativo').sort((a,b) => a.name.localeCompare(b.name)), [employees]);

  // -- Absenteismo Logic --
  const { year, monthIndex, daysInMonth, daysArray } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dInMonth = new Date(y, m, 0).getDate();
    const arr = Array.from({ length: dInMonth }, (_, i) => {
      const dateObj = new Date(y, m - 1, i + 1);
      const wd = dateObj.getDay();
      const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
      return { day: i + 1, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, weekDay: weekDays[wd] };
    });
    return { year: y, monthIndex: m - 1, daysInMonth: dInMonth, daysArray: arr };
  }, [selectedMonth]);

  const monthRecords = useMemo(() => absenteeismRecords.filter(r => r.date.startsWith(selectedMonth)), [absenteeismRecords, selectedMonth]);

  const getRecord = (employeeId: string, dateStr: string) => monthRecords.find(r => r.employeeId === employeeId && r.date === dateStr);

  const handleCellClick = async (employeeId: string, dateStr: string) => {
    if (!canEdit) return;
    setIsSaving(true);
    try {
      if (activeStatus === 'LIMPAR') {
        await onDeleteAbsenteeism(employeeId, dateStr);
      } else {
        const existing = getRecord(employeeId, dateStr);
        await onSaveAbsenteeism({
          id: existing?.id,
          employeeId,
          date: dateStr,
          status: activeStatus,
          updatedBy: currentUser.id
        });
      }
    } finally { setIsSaving(false); }
  };

  const { summaryTotals } = useMemo(() => {
    const totalsPerDay = new Array(daysInMonth).fill(0);
    monthRecords.forEach(r => {
      if (r.status !== 'P' && r.status !== 'FO' && r.status !== 'FE') {
        const day = parseInt(r.date.split('-')[2], 10);
        totalsPerDay[day - 1]++;
      }
    });
    return { summaryTotals: totalsPerDay };
  }, [monthRecords, daysInMonth]);

  const exportCSV = () => {
    const headers = ['Funcionário', ...daysArray.map(d => `${d.day} (${d.weekDay})`), 'Presenças', 'Faltas', 'Taxa Ausência'];
    const rows = activeEmployees.map(emp => {
      let calcP = 0, calcF = 0;
      const dayCells = daysArray.map(d => {
        const rec = getRecord(emp.id, d.dateStr);
        if (rec) {
          if (rec.status === 'P') calcP++;
          else if (['F','A','AR','PR','ER','EC','SA','AF'].includes(rec.status)) calcF++;
        }
        return rec ? rec.status : '';
      });
      const totalDays = calcP + calcF;
      const rate = totalDays > 0 ? ((calcF / totalDays) * 100).toFixed(1) + '%' : '0%';
      return [`"${emp.name}"`, ...dayCells, calcP, calcF, rate].join(';');
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Absenteismo_${selectedMonth}.csv`;
    link.click();
  };

  // -- Cadastro de Funcionários Logic --
  const [empModal, setEmpModal] = useState<{ open: boolean; editing: Employee | null }>({ open: false, editing: null });
  const [empForm, setEmpForm] = useState<Omit<Employee, 'id'>>({ name: '', status: 'Ativo', area: 'Projetos' });

  const openNewEmp = () => { setEmpForm({ name: '', status: 'Ativo', area: 'Projetos' }); setEmpModal({ open: true, editing: null }); };
  const openEditEmp = (emp: Employee) => { setEmpForm({ name: emp.name, status: emp.status, area: emp.area || 'Projetos' }); setEmpModal({ open: true, editing: emp }); };
  
  const saveEmployee = async () => {
    if (!empForm.name.trim()) return;
    setIsSaving(true);
    await onSaveEmployee({ ...empForm, id: empModal.editing?.id || crypto.randomUUID() } as Employee);
    setIsSaving(false);
    setEmpModal({ open: false, editing: null });
  };

  // -- Hora Extra Logic --
  const [heModal, setHeModal] = useState<{ open: boolean; editing: OvertimeRecord | null }>({ open: false, editing: null });
  const [heForm, setHeForm] = useState<Omit<OvertimeRecord, 'id'>>({ employeeId: '', date: '', startTime: '', endTime: '', costCenter: '', reason: '' });

  const filterHEMonth = useMemo(() => overtimeRecords.filter(r => r.date.startsWith(selectedMonth)).sort((a,b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)), [overtimeRecords, selectedMonth]);

  const calcDiff = (start: string, end: string) => {
    if (!start || !end) return '00:00';
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60; // crossed midnight
    const hh = Math.floor(diff / 60);
    const mm = diff % 60;
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
  };

  const openNewHE = () => { setHeForm({ employeeId: activeEmployees[0]?.id || '', date: new Date().toISOString().split('T')[0], startTime: '18:00', endTime: '20:00', costCenter: '', reason: '' }); setHeModal({ open: true, editing: null }); };
  const openEditHE = (rec: OvertimeRecord) => { setHeForm({ employeeId: rec.employeeId, date: rec.date, startTime: rec.startTime, endTime: rec.endTime, costCenter: rec.costCenter, reason: rec.reason }); setHeModal({ open: true, editing: rec }); };

  const saveHE = async () => {
    if (!heForm.employeeId || !heForm.date || !heForm.startTime || !heForm.endTime) return;
    setIsSaving(true);
    await onSaveOvertime({ ...heForm, id: heModal.editing?.id || crypto.randomUUID() } as OvertimeRecord);
    setIsSaving(false);
    setHeModal({ open: false, editing: null });
  };

  const exportHE = () => {
    const headers = ['Data', 'Funcionário', 'Início', 'Fim', 'Total Hrs', 'Centro de Custo', 'Motivo'];
    const rows = filterHEMonth.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return [r.date.split('-').reverse().join('/'), `"${emp?.name || '---'}"`, r.startTime, r.endTime, calcDiff(r.startTime, r.endTime), `"${r.costCenter}"`, `"${r.reason}"`].join(';');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `HorasExtras_${selectedMonth}.csv`;
    link.click();
  };

  const ptMonths = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* HEADER & MODULE TABS */}
      <div className="tab-header" style={{ paddingBottom: 0 }}>
        <div>
          <h1 className="tab-title">Painel de Ponto</h1>
          <p className="tab-subtitle">Absenteísmo, Horas Extras e Equipe</p>
        </div>
      </div>

      <div className="section-tabs">
        <button className={`sec-tab ${subTab === 'absenteismo' ? 'sec-active' : ''}`} onClick={() => setSubTab('absenteismo')}>
          <Calendar size={16} /> Absenteísmo
        </button>
        <button className={`sec-tab ${subTab === 'hora-extra' ? 'sec-active' : ''}`} onClick={() => setSubTab('hora-extra')}>
          <Clock size={16} /> Horas Extras
        </button>
        <button className={`sec-tab ${subTab === 'funcionarios' ? 'sec-active' : ''}`} onClick={() => setSubTab('funcionarios')}>
          <Users size={16} /> Equipe (Nomes)
        </button>
      </div>

      {subTab === 'absenteismo' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, padding: '1rem 0' }}>
        {/* LEGENDA */}
        <div className="table-card" style={{ padding: '1rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', fontWeight: 600 }}>Legenda</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {STATUS_LEGEND.map(leg => (
              <div key={leg.status} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '180px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: leg.bg, color: leg.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {leg.status}
                </div>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{leg.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CONTROLES */}
        <div className="table-card" style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Mês:</span>
                 <div className="input-icon-wrap" style={{ width: 'auto' }}>
                    <Calendar size={16} />
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                 </div>
              </div>

              {canEdit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Ferramenta:</span>
                 {/* Estilização específica no SELECT para resolver bug de visualização */}
                 <div className="select-wrap" style={{ width: '220px', background: 'var(--bg-layer)' }}>
                   <select 
                     value={activeStatus} 
                     onChange={e => setActiveStatus(e.target.value as AbsenteeismStatus | 'LIMPAR')}
                     style={{ fontWeight: 600, color: 'var(--text-primary)' }}
                   >
                      <option value="LIMPAR" style={{ color: '#ef4444' }}>Limpar Célula</option>
                      <optgroup label="Status">
                         {STATUS_LEGEND.map(s => <option key={s.status} value={s.status} style={{ color: '#000', fontWeight: 'bold' }}>{s.status} - {s.label}</option>)}
                      </optgroup>
                   </select>
                 </div>
              </div>)}
              {isSaving && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><RefreshCw size={14} className="spinner" /> Salvando...</div>}
            </div>

            {canEdit && (
              <button className="btn-ghost" onClick={exportCSV} title="Exportar para Excel">
                <Download size={16} /> Exportar Planilha
              </button>
            )}
          </div>

          {year && (
            <h4 style={{ marginBottom: '1rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
              Visão de {ptMonths[monthIndex]} de {year}
            </h4>
          )}

          {/* TABELA DE REGISTRO */}
          <div className="table-scroll custom-scroll" style={{ flex: 1, borderRadius: '8px', border: '1px solid var(--border-color)', borderBottom: 'none' }}>
            <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
               <thead>
                  <tr>
                     <th style={{ width: '250px', position: 'sticky', left: 0, zIndex: 2, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)' }}>Funcionário</th>
                     {daysArray.map(d => (
                       <th key={d.day} style={{ width: '45px', minWidth: '45px', textAlign: 'center', padding: '0.4rem 0.2rem', fontSize: '0.75rem', borderBottom: '2px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                             <b style={{ fontSize: '1rem' }}>{d.day}</b>
                             <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>{d.weekDay}</span>
                          </div>
                       </th>
                     ))}
                     <th style={{ width: '60px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>P</th>
                     <th style={{ width: '60px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>F/A</th>
                     <th style={{ width: '80px', textAlign: 'center', borderBottom: '2px solid var(--border-color)' }}>Ausência</th>
                  </tr>
               </thead>
               <tbody>
                  {activeEmployees.length === 0 && (
                    <tr><td colSpan={daysArray.length + 4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhum funcionário ativo cadastrado na equipe.</td></tr>
                  )}
                  {activeEmployees.map(emp => {
                     let calcP = 0; let calcF = 0;
                     return (
                       <tr key={emp.id} className="data-row hover-row">
                          <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-layer)', borderRight: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                             <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{emp.name}</span>
                          </td>
                          {daysArray.map(d => {
                             const rec = getRecord(emp.id, d.dateStr);
                             const leg = rec ? STATUS_LEGEND.find(l => l.status === rec.status) : null;
                             
                             if (rec) {
                                if (rec.status === 'P') calcP++;
                                else if (['F','A','AR','PR','ER','EC','SA','AF'].includes(rec.status)) calcF++;
                             }

                             return (
                               <td 
                                 key={d.day}
                                 onClick={() => handleCellClick(emp.id, d.dateStr)}
                                 style={{ 
                                   textAlign: 'center', cursor: canEdit ? 'crosshair' : 'default', padding: '3px',
                                   border: '1px solid var(--border-color)'
                                 }}
                               >
                                 {leg ? (
                                   <div style={{ 
                                     width: '100%', height: '100%', minHeight: '34px',
                                     background: leg.bg, color: leg.color, 
                                     display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                     fontWeight: 'bold', fontSize: '0.85rem', borderRadius: '4px',
                                     boxShadow: 'inset 0 0 2px rgba(0,0,0,0.2)'
                                   }} title={leg.label}>
                                      {rec?.status}
                                   </div>
                                 ) : (
                                   <div style={{ width: '100%', height: '100%', minHeight: '34px', background: 'transparent' }} />
                                 )}
                               </td>
                             )
                          })}
                          <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', background: 'rgba(34, 197, 94, 0.05)', color: '#22c55e' }}>{calcP}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' }}>{calcF}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.02)' }}>
                             {calcP + calcF > 0 ? ((calcF / (calcP + calcF)) * 100).toFixed(1) + '%' : '0%'}
                          </td>
                       </tr>
                     )
                  })}
                  {/* TOTAIS */}
                  <tr style={{ borderTop: '2px solid var(--border-color)' }}>
                     <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-layer)', fontWeight: 'bold', borderRight: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                        TOTAL GERAL MÊS
                     </td>
                     {summaryTotals.map((tot, idx) => (
                        <td key={idx} style={{ textAlign: 'center', fontWeight: 'bold', border: '1px solid var(--border-color)', background: tot > 0 ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-layer)', color: tot > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                           {tot}
                        </td>
                     ))}
                     <td colSpan={3} style={{ border: '1px solid var(--border-color)' }} />
                  </tr>
               </tbody>
            </table>
          </div>
        </div>
      </div>)}

      {/* HORAS EXTRAS */}
      {subTab === 'hora-extra' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, padding: '1rem 0' }}>
        <div className="cad-section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <span className="cad-count">Lançamentos de HE</span>
            <div className="input-icon-wrap" style={{ width: 'auto' }}>
               <Calendar size={16} />
               <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
            </div>
            {isSaving && <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}><RefreshCw size={14} className="spinner" /> Processando...</div>}
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn-ghost" onClick={exportHE}><Download size={16} /> Baixar Relatório</button>
              <button className="btn-primary" onClick={openNewHE}><Plus size={16} /> Novo Registro (HE)</button>
            </div>
          )}
        </div>
        <div className="table-card table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Funcionário</th>
                <th>Início</th>
                <th>Término</th>
                <th>Duração</th>
                <th>Centro de Custo</th>
                <th>Motivo/Atividade</th>
                {canEdit && <th style={{ width: 80, textAlign: 'right' }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filterHEMonth.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma hora extra lançada neste mês.</td></tr>
              )}
              {filterHEMonth.map(rec => {
                const emp = employees.find(e => e.id === rec.employeeId);
                return (
                  <tr key={rec.id} className="data-row">
                    <td style={{ fontWeight: 500 }}>{rec.date.split('-').reverse().join('/')}</td>
                    <td style={{ fontWeight: 600 }}>{emp?.name || '-- Inválido --'}</td>
                    <td>{rec.startTime}</td>
                    <td>{rec.endTime}</td>
                    <td style={{ fontWeight: 'bold' }}>{calcDiff(rec.startTime, rec.endTime)}</td>
                    <td>{rec.costCenter}</td>
                    <td>{rec.reason}</td>
                    {canEdit && (
                      <td style={{ textAlign: 'right' }}>
                        <button className="action-btn edit" onClick={() => openEditHE(rec)}><Edit2 size={14} /></button>
                        <button className="action-btn del" onClick={() => { if(confirm("Remover este registro?")) onDeleteOvertime(rec.id); }}><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>)}

      {/* FUNCIONÁRIOS */}
      {subTab === 'funcionarios' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1, padding: '1rem 0' }}>
         <div className="cad-section-header">
           <span className="cad-count">{employees.length} funcionários cadastrados</span>
           {canEdit && <button className="btn-primary" onClick={openNewEmp}><Plus size={16} /> Novo Funcionário</button>}
         </div>
         <div className="cad-grid">
           {employees.map(emp => (
             <div key={emp.id} className="cad-card">
               <div className="cad-card-left">
                  <span className="user-avatar lg" style={{ background: emp.status === 'Ativo' ? '#10b981' : '#64748b' }}>{emp.name[0]}</span>
                  <div className="cad-card-info">
                     <span className="cad-name" style={{ textDecoration: emp.status === 'Inativo' ? 'line-through' : 'none' }}>{emp.name}</span>
                     <span className="cad-meta">{emp.area}</span>
                  </div>
               </div>
               <div className="cad-card-actions">
                 {emp.status === 'Ativo' ? (
                   <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#10b981', background: '#10b98120', padding: '2px 8px', borderRadius: '12px' }}>Ativo</span>
                 ) : (
                   <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', background: '#64748b20', padding: '2px 8px', borderRadius: '12px' }}>Inativo</span>
                 )}
                 {canEdit && (
                   <>
                     <button className="action-btn edit" onClick={() => openEditEmp(emp)}><Edit2 size={14} /></button>
                     <button className="action-btn del" onClick={() => { if(confirm("Apagar funcionário definitivamente e perder histórico? Melhor apenas inativar.")) onDeleteEmployee(emp.id) }}><Trash2 size={14} /></button>
                   </>
                 )}
               </div>
             </div>
           ))}
         </div>
      </div>)}

      {/* MODAL HE */}
      {heModal.open && (
         <div className="modal-overlay" onClick={() => setHeModal({ open: false, editing: null })}>
           <div className="modal-box" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                 <h2>{heModal.editing ? 'Editar Horas Extras' : 'Lançar Horas Extras'}</h2>
                 <button className="modal-close" onClick={() => setHeModal({ open: false, editing: null })}><X size={20} /></button>
              </div>
              <div className="modal-body">
                 <div className="form-group full">
                    <label>Funcionário *</label>
                    <div className="select-wrap full-w">
                      <select value={heForm.employeeId} onChange={e => setHeForm(f => ({ ...f, employeeId: e.target.value }))}>
                         <option value="">Selecione...</option>
                         {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                    </div>
                 </div>
                 <div className="form-grid">
                    <div className="form-group">
                       <label>Data *</label>
                       <input type="date" value={heForm.date} onChange={e => setHeForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                       <div className="form-group">
                         <label>Início (HH:mm) *</label>
                         <input type="time" value={heForm.startTime} onChange={e => setHeForm(f => ({ ...f, startTime: e.target.value }))} />
                       </div>
                       <div className="form-group">
                         <label>Término (HH:mm) *</label>
                         <input type="time" value={heForm.endTime} onChange={e => setHeForm(f => ({ ...f, endTime: e.target.value }))} />
                       </div>
                    </div>
                    <div className="form-group">
                       <label>Centro de Custo</label>
                       <input type="text" placeholder="ex: Projeto XYZ" value={heForm.costCenter} onChange={e => setHeForm(f => ({ ...f, costCenter: e.target.value }))} />
                    </div>
                    <div className="form-group full">
                       <label>Razão / Atividade (Justificativa)</label>
                       <input type="text" placeholder="ex: Finalização urgente de deploy..." value={heForm.reason} onChange={e => setHeForm(f => ({ ...f, reason: e.target.value }))} />
                    </div>
                 </div>
              </div>
              <div className="modal-footer">
                 <button className="btn-ghost" onClick={() => setHeModal({ open: false, editing: null })}>Cancelar</button>
                 <button className="btn-primary" onClick={saveHE} disabled={isSaving || !heForm.employeeId || !heForm.date}><Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar HE'}</button>
              </div>
           </div>
         </div>
      )}

      {/* MODAL FUNCIONARIO */}
      {empModal.open && (
         <div className="modal-overlay" onClick={() => setEmpModal({ open: false, editing: null })}>
           <div className="modal-box sm" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                 <h2>{empModal.editing ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
                 <button className="modal-close" onClick={() => setEmpModal({ open: false, editing: null })}><X size={20} /></button>
              </div>
              <div className="modal-body">
                 <div className="form-group full">
                    <label>Nome Completo *</label>
                    <input type="text" placeholder="Nome na Grade" value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} />
                 </div>
                 <div className="form-group full">
                    <label>Área</label>
                    <input type="text" placeholder="ex: Equipe Operacional" value={empForm.area} onChange={e => setEmpForm(f => ({ ...f, area: e.target.value }))} />
                 </div>
                 <div className="form-group full">
                    <label>Status (Inativar remove o nome da lista de preenchimento, mas não perde histórico)</label>
                    <div className="select-wrap full-w">
                      <select value={empForm.status} onChange={e => setEmpForm(f => ({ ...f, status: e.target.value as any }))}>
                        <option value="Ativo">🟢 Ativo</option>
                        <option value="Inativo">🔴 Inativo (Demissão/Afastado)</option>
                      </select>
                    </div>
                 </div>
              </div>
              <div className="modal-footer">
                 <button className="btn-ghost" onClick={() => setEmpModal({ open: false, editing: null })}>Cancelar</button>
                 <button className="btn-primary" onClick={saveEmployee} disabled={isSaving || !empForm.name.trim()}><Save size={16} /> Salvar Funcionário</button>
              </div>
           </div>
         </div>
      )}

    </div>
  );
}
