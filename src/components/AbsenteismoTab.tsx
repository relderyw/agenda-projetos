import React, { useState, useMemo } from 'react';
import { Download, RefreshCw, Calendar, Trash2, Users, Clock, Tag, Plus, Edit2, X, Save, SaveAll } from 'lucide-react';
import type { User, Employee, AbsenteeismRecord, AbsenteeismStatus, OvertimeRecord, Holiday } from '../types';

interface HEGroup {
  key: string;
  records: OvertimeRecord[];
  date: string;
  formNumber?: string;
  startTime: string;
  endTime: string;
  costCenter: string;
  cause: string;
  motive?: string;
}

interface Props {
  currentUser: User | null;
  employees: Employee[];
  absenteeismRecords: AbsenteeismRecord[];
  overtimeRecords: OvertimeRecord[];
  holidays: Holiday[];
  onSaveAbsenteeism: (record: Omit<AbsenteeismRecord, 'id'> | AbsenteeismRecord) => Promise<void>;
  onDeleteAbsenteeism: (employeeId: string, date: string) => Promise<void>;
  onSaveEmployee: (emp: Employee) => Promise<void>;
  onDeleteEmployee: (id: string) => Promise<void>;
  onSaveOvertime: (record: Omit<OvertimeRecord, 'id'> | OvertimeRecord) => Promise<void>;
  onDeleteOvertime: (id: string) => Promise<void>;
}

// Helper: Verifica se a data é Sábado (dia de hora extra, não conta como presença regular)
const isSaturday = (dateStr: string) => {
  if (!dateStr) return false;
  const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const parts = clean.split('-').map(Number);
  if (parts.length < 3) return false;
  return new Date(parts[0], parts[1] - 1, parts[2]).getDay() === 6;
};

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
  currentUser, employees, absenteeismRecords, overtimeRecords, holidays,
  onSaveAbsenteeism, onDeleteAbsenteeism,
  onSaveEmployee, onDeleteEmployee,
  onSaveOvertime, onDeleteOvertime
}: Props) {
  const [subTab, setSubTab] = useState<'absenteismo' | 'hora-extra' | 'funcionarios'>('absenteismo');
  const canEdit = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin') || currentUser?.role === 'Gestão' || !!currentUser?.permissions?.absenteismo?.edit;
  const canDelete = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin') || currentUser?.role === 'Gestão' || !!currentUser?.permissions?.absenteismo?.delete;
  const canViewDashboards = (currentUser?.role === 'Administrador' || currentUser?.role === 'Super Admin') || currentUser?.role === 'Gestão' || !!currentUser?.permissions?.absenteismo?.edit || !!currentUser?.permissions?.absenteismo?.delete;

  // State: Absenteísmo
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [activeStatus, setActiveStatus] = useState<AbsenteeismStatus | 'LIMPAR'>('P');
  const [isSaving, setIsSaving] = useState(false);

  // Memos globais
  const activeEmployees = useMemo(() => employees.filter(e => e.status === 'Ativo').sort((a, b) => a.name.localeCompare(b.name)), [employees]);

  // -- Absenteismo Logic --
  const { year, monthIndex, daysInMonth, daysArray } = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const dInMonth = new Date(y, m, 0).getDate();
    const arr = Array.from({ length: dInMonth }, (_, i) => {
      const dateObj = new Date(y, m - 1, i + 1);
      const wd = dateObj.getDay();
      const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
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
      if (['F', 'A', 'PR', 'ER', 'EC', 'LM', 'SA', 'DE', 'AF'].includes(r.status)) {
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
          // Sábados não contam como presença
          if (rec.status === 'P' && d.weekDay !== 'Sáb') calcP++;
          else if (rec.status !== 'P') calcF++;
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
  const [empForm, setEmpForm] = useState<Omit<Employee, 'id'>>({ name: '', status: 'Ativo', registration: '', role: '' });

  const openNewEmp = () => { setEmpForm({ name: '', status: 'Ativo', registration: '', role: '' }); setEmpModal({ open: true, editing: null }); };
  const openEditEmp = (emp: Employee) => { setEmpForm({ name: emp.name, status: emp.status, registration: emp.registration || '', role: emp.role || '' }); setEmpModal({ open: true, editing: emp }); };

  const saveEmployee = async () => {
    if (!empForm.name.trim()) return;
    setIsSaving(true);
    await onSaveEmployee({ ...empForm, id: empModal.editing?.id || crypto.randomUUID() } as Employee);
    setIsSaving(false);
    setEmpModal({ open: false, editing: null });
  };

  // -- Hora Extra Logic --
  const [heModal, setHeModal] = useState<{ open: boolean; editingGroup: HEGroup | null }>({ open: false, editingGroup: null });
  const [heForm, setHeForm] = useState<{ employeeIds: string[], date: string, startTime: string, endTime: string, costCenter: string, cause: string, motive: string, formNumber: string }>({ employeeIds: [], date: '', startTime: '', endTime: '', costCenter: 'Honda', cause: '', motive: '', formNumber: '' });

  const filterHEMonth = useMemo(() => overtimeRecords.filter(r => r.date.startsWith(selectedMonth)).sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)), [overtimeRecords, selectedMonth]);

  const heGroups = useMemo(() => {
    const groups: Record<string, HEGroup> = {};
    filterHEMonth.forEach(rec => {
      // Chave de agrupamento NÃO inclui motive/cause para evitar quebra de grupos
      // quando registros do mesmo formulário tiverem pequenas variações nesses campos
      const key = `${rec.date}|${rec.formNumber || ''}|${rec.startTime}|${rec.endTime}|${rec.costCenter}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          records: [],
          date: rec.date,
          formNumber: rec.formNumber,
          startTime: rec.startTime,
          endTime: rec.endTime,
          costCenter: rec.costCenter,
          cause: rec.cause,
          motive: rec.motive
        };
      }
      groups[key].records.push(rec);
    });
    return Object.values(groups);
  }, [filterHEMonth]);

  const calcDiff = (start: string, end: string) => {
    if (!start || !end) return '00:00';
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 24 * 60; // crossed midnight
    const hh = Math.floor(diff / 60);
    const mm = diff % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const openNewHE = () => {
    const now = new Date();
    const startT = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const endNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const endT = `${String(endNow.getHours()).padStart(2, '0')}:${String(endNow.getMinutes()).padStart(2, '0')}`;
    setHeForm({ employeeIds: [], date: now.toISOString().split('T')[0], startTime: startT, endTime: endT, costCenter: 'Honda', cause: '', motive: '', formNumber: '' });
    setHeModal({ open: true, editingGroup: null });
  };
  const openEditGroup = (grp: HEGroup) => { setHeForm({ employeeIds: grp.records.map(r => r.employeeId), date: grp.date, startTime: grp.startTime, endTime: grp.endTime, costCenter: grp.costCenter, cause: grp.cause, motive: grp.motive || '', formNumber: grp.formNumber || '' }); setHeModal({ open: true, editingGroup: grp }); };

  const saveHE = async () => {
    if (heForm.employeeIds.length === 0 || !heForm.date || !heForm.startTime || !heForm.endTime) return;
    setIsSaving(true);
    if (heModal.editingGroup) {
      const oldRecords = heModal.editingGroup.records;
      const oldIds = oldRecords.map(r => r.employeeId);

      for (const oldId of oldIds) {
        if (!heForm.employeeIds.includes(oldId)) {
          const recToDel = oldRecords.find(r => r.employeeId === oldId);
          if (recToDel) await onDeleteOvertime(recToDel.id);
        }
      }

      for (const empId of heForm.employeeIds) {
        const oldRec = oldRecords.find(r => r.employeeId === empId);
        if (oldRec) {
          await onSaveOvertime({ ...heForm, employeeId: empId, id: oldRec.id } as OvertimeRecord);
        } else {
          await onSaveOvertime({ ...heForm, employeeId: empId, id: crypto.randomUUID() } as OvertimeRecord);
        }
      }
    } else {
      for (const empId of heForm.employeeIds) {
        await onSaveOvertime({ ...heForm, employeeId: empId, id: crypto.randomUUID() } as OvertimeRecord);
      }
    }
    setIsSaving(false);
    setHeModal({ open: false, editingGroup: null });
  };

  const exportHE = () => {
    const headers = ['Data', 'Funcionário', 'Início', 'Fim', 'Total Hrs', 'Nº Formulário', 'Custo', 'Causa', 'Motivo'];
    const rows = filterHEMonth.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return [r.date.split('-').reverse().join('/'), `"${emp?.name || '---'}"`, r.startTime, r.endTime, calcDiff(r.startTime, r.endTime), `"${r.formNumber || ''}"`, `"${r.costCenter}"`, `"${r.cause}"`, `"${r.motive || ''}"`].join(';');
    });
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(';'), ...rows].join('\n');
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `HorasExtras_${selectedMonth}.csv`;
    link.click();
  };

  const ptMonths = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

  // Dashboards Analytics
  const [indicatorPeriod, setIndicatorPeriod] = useState<string>('selected_month');

  const getPeriodRecords = (records: any[]) => {
    return records.filter(r => {
      if (indicatorPeriod === 'selected_month') return r.date.startsWith(selectedMonth);
      if (indicatorPeriod === 'all') return true;
      const [yr, mr] = r.date.split('-').map(Number);
      const diffMonths = (new Date().getFullYear() - yr) * 12 + (new Date().getMonth() - (mr - 1));
      if (indicatorPeriod === 'last_3') return diffMonths >= 0 && diffMonths < 3;
      if (indicatorPeriod === 'last_6') return diffMonths >= 0 && diffMonths < 6;
      if (indicatorPeriod === 'last_12') return diffMonths >= 0 && diffMonths < 12;
      return false;
    });
  };

  const absStats = useMemo(() => {
    let mostAbsent = { name: '--', count: 0 };
    let allStats: { emp: Employee, p: number, f: number, total: number, rate: number }[] = [];

    const periodRecords = getPeriodRecords(absenteeismRecords);
    const absenceCounts: Record<string, number> = {};
    let totalAbsences = 0;
    let totalPresence = 0;

    activeEmployees.forEach(emp => {
      let calcP = 0, calcF = 0;
      const empRecords = periodRecords.filter(r => r.employeeId === emp.id);

      const processedDates = new Set();
      empRecords.forEach(rec => {
        if (!processedDates.has(rec.date)) {
          processedDates.add(rec.date);
          const isSat = isSaturday(rec.date);
          if (rec.status === 'P') {
            // Sábados NÃO contam como presença
            if (!isSat) {
              calcP++;
              totalPresence++;
            }
          } else {
            calcF++;
            totalAbsences++;
            absenceCounts[rec.status] = (absenceCounts[rec.status] || 0) + 1;
          }
        }
      });

      if (calcF > mostAbsent.count) mostAbsent = { name: emp.name, count: calcF };

      const total = calcP + calcF;
      const rate = total > 0 ? (calcP / total) : 0;
      if (total > 0) allStats.push({ emp, p: calcP, f: calcF, total, rate });
    });

    const top3 = [...allStats].sort((a, b) => b.rate - a.rate || b.p - a.p).slice(0, 3);
    const totalGeneral = totalPresence + totalAbsences;

    const absenceTypeBreakdown = STATUS_LEGEND
      .filter(l => l.status !== 'P')
      .map(l => {
        const count = absenceCounts[l.status] || 0;
        const pctOfAbsences = totalAbsences > 0 ? (count / totalAbsences) * 100 : 0;
        const pctOfGeneral = totalGeneral > 0 ? (count / totalGeneral) * 100 : 0;
        return {
          ...l,
          count,
          pctOfAbsences,
          pctOfGeneral
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      mostAbsent,
      top3,
      totalAbsences,
      totalPresence,
      totalGeneral,
      absenceTypeBreakdown,
      overallAbsenceRate: totalGeneral > 0 ? (totalAbsences / totalGeneral) * 100 : 0
    };
  }, [activeEmployees, absenteeismRecords, selectedMonth, indicatorPeriod]);

  const heStats = useMemo(() => {
    const totals: Record<string, number> = {};
    const periodRecords = getPeriodRecords(overtimeRecords);

    periodRecords.forEach(rec => {
      if (!rec.startTime || !rec.endTime) return;
      const [h1, m1] = rec.startTime.split(':').map(Number);
      const [h2, m2] = rec.endTime.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff < 0) diff += 24 * 60;
      totals[rec.employeeId] = (totals[rec.employeeId] || 0) + diff;
    });

    let maxVal = 0, maxEmpId = '';
    for (const id in totals) { if (totals[id] > maxVal) { maxVal = totals[id]; maxEmpId = id; } }

    const emp = employees.find(e => e.id === maxEmpId);
    const hh = Math.floor(maxVal / 60);
    const mm = maxVal % 60;
    return { emp, hoursText: maxVal > 0 ? `${hh}h ${mm}m` : '--' };
  }, [overtimeRecords, employees, selectedMonth, indicatorPeriod]);

  // Reusable Select Filter for Indicators
  const IndicatorFilter = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '1rem', width: '100%', background: 'var(--bg-card)', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtro do Resumo:</span>
      <div className="select-wrap" style={{ minWidth: '220px', background: 'var(--bg-layer)' }}>
        <select
          value={indicatorPeriod}
          onChange={e => setIndicatorPeriod(e.target.value)}
          style={{ fontWeight: 600, color: 'var(--text-primary)' }}
        >
          <option value="selected_month" style={{ color: '#000', fontWeight: 500 }}>Mês Selecionado na Grade</option>
          <option value="last_3" style={{ color: '#000', fontWeight: 500 }}>Últimos 3 Meses</option>
          <option value="last_6" style={{ color: '#000', fontWeight: 500 }}>Últimos 6 Meses</option>
          <option value="last_12" style={{ color: '#000', fontWeight: 500 }}>Últimos 12 Meses</option>
          <option value="all" style={{ color: '#000', fontWeight: 500 }}>Todo o Período</option>
        </select>
      </div>
    </div>
  );

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
          {/* INDICADORES ABSENTEISMO */}
          {canViewDashboards && (
            <>
              <IndicatorFilter />

              {/* KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginTop: '-0.5rem' }}>
                <div className="table-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.06) 0%, rgba(239, 68, 68, 0.12) 100%)', border: '1px solid rgba(239, 68, 68, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Taxa Geral de Absenteísmo</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{absStats.overallAbsenceRate.toFixed(1)}%</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{absStats.totalAbsences} ausências em {absStats.totalGeneral} apontamentos</span>
                </div>

                <div className="table-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.06) 0%, rgba(249, 115, 22, 0.12) 100%)', border: '1px solid rgba(249, 115, 22, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total de Ausências</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{absStats.totalAbsences}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ocorrências no período selecionado</span>
                </div>

                <div className="table-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.06) 0%, rgba(34, 197, 94, 0.12) 100%)', border: '1px solid rgba(34, 197, 94, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Presenças Computadas</span>
                  <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{absStats.totalPresence}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sábados excluídos (Horas extras)</span>
                </div>

                <div className="table-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.06) 0%, rgba(139, 92, 246, 0.12) 100%)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Maior Ausência Individual</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={absStats.mostAbsent.name}>{absStats.mostAbsent.name}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{absStats.mostAbsent.count > 0 ? `${absStats.mostAbsent.count} ocorrência(s)` : 'Nenhuma ausência'}</span>
                </div>
              </div>

              {/* DETALHAMENTO DE AUSÊNCIAS POR TIPO & TOP ASSIDUIDADES */}
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: '1rem', flexWrap: 'wrap' }}>
                {/* Resumo de Ausências por Tipo */}
                <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                        Resumo de Ausências por Tipo
                      </h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Percentual em relação ao total de ausências e em relação ao geral no período
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: 'var(--bg-layer)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                      Total: {absStats.totalAbsences} ocorrência(s)
                    </span>
                  </div>

                  {/* Barra empilhada visual proporcional */}
                  {absStats.totalAbsences > 0 ? (
                    <div>
                      <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: 'var(--bg-layer)', border: '1px solid var(--border-color)' }}>
                        {absStats.absenceTypeBreakdown.filter(t => t.count > 0).map(t => (
                          <div
                            key={t.status}
                            style={{
                              width: `${t.pctOfAbsences}%`,
                              background: t.bg,
                              transition: 'width 0.3s ease'
                            }}
                            title={`${t.label}: ${t.count} (${t.pctOfAbsences.toFixed(1)}% das ausências)`}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Lista com percentuais */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto' }} className="custom-scroll">
                    {absStats.totalAbsences === 0 ? (
                      <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Nenhuma ausência registrada para o período selecionado.
                      </div>
                    ) : (
                      absStats.absenceTypeBreakdown.filter(t => t.count > 0).map(t => (
                        <div
                          key={t.status}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.5rem 0.75rem',
                            borderRadius: '8px',
                            background: 'var(--bg-layer)',
                            border: '1px solid var(--border-color)',
                            gap: '0.75rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', minWidth: '160px', flex: 1 }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: t.bg, color: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold', flexShrink: 0 }}>
                              {t.status}
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{t.label}</span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '50px', textAlign: 'right' }}>
                              {t.count} {t.count === 1 ? 'reg.' : 'reg.'}
                            </span>
                            
                            {/* % do Total de Ausências */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '95px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#dc2626' }}>
                                {t.pctOfAbsences.toFixed(1)}%
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>das ausências</span>
                            </div>

                            {/* % do Geral */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', minWidth: '85px' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                {t.pctOfGeneral.toFixed(1)}%
                              </span>
                              <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>do geral ({absStats.totalGeneral})</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Top 3 Assiduidades */}
                <div className="table-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top 3 Assiduidades do Período</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.2rem 0 0' }}>Baseado em presenças regulares (segunda a sexta)</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                    {absStats.top3.length === 0 ? <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Nenhum dado calculado para o período.</span> : null}
                    {absStats.top3.map((st, i) => (
                      <div key={st.emp.id} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', padding: '0.6rem 0.8rem', background: 'var(--bg-layer)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10b98118', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0 }}>#{i + 1}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={st.emp.name}>{st.emp.name}</span>
                          <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>{(st.rate * 100).toFixed(1)}% assiduidade ({st.p} Presenças)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

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
                    <th style={{ width: '250px', position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)' }}>Funcionário</th>
                    {daysArray.map(d => {
                      const cleanHDate = (h: Holiday) => (h.date.includes('T') ? h.date.split('T')[0] : h.date);
                      const isHoliday = holidays.some(h => cleanHDate(h) === d.dateStr);
                      const isSunday = d.weekDay === 'Dom';
                      const isSaturdayDay = d.weekDay === 'Sáb';
                      const isSundayOrHoliday = isSunday || isHoliday;
                      return (
                        <th key={d.day} style={{
                          width: '45px', minWidth: '45px', textAlign: 'center', padding: '0.4rem 0.2rem', fontSize: '0.75rem',
                          borderBottom: '2px solid var(--border-color)',
                          ...(isSundayOrHoliday ? { background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444' } : isSaturdayDay ? { background: 'rgba(245, 158, 11, 0.08)', color: '#d97706' } : {})
                        }} title={isSaturdayDay ? 'Sábado: Horas Extras (não computado na presença regular)' : isSundayOrHoliday ? 'Descanso Semanal / Feriado' : undefined}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <b style={{ fontSize: '1rem' }}>{d.day}</b>
                            <span style={{ color: isSundayOrHoliday ? '#ef4444' : isSaturdayDay ? '#d97706' : 'var(--text-muted)', fontSize: '0.65rem' }}>{d.weekDay}</span>
                          </div>
                        </th>
                      )
                    })}
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
                        <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{emp.name}</span>
                        </td>
                        {daysArray.map(d => {
                          const rec = getRecord(emp.id, d.dateStr);
                          const leg = rec ? STATUS_LEGEND.find(l => l.status === rec.status) : null;
                          const cleanHDate = (h: Holiday) => (h.date.includes('T') ? h.date.split('T')[0] : h.date);
                          const isHoliday = holidays.some(h => cleanHDate(h) === d.dateStr);
                          const isSunday = d.weekDay === 'Dom';
                          const isSaturdayDay = d.weekDay === 'Sáb';
                          const isSundayOrHoliday = isSunday || isHoliday;

                          if (rec) {
                            // Sábados não contam como presença
                            if (rec.status === 'P' && !isSaturdayDay) calcP++;
                            else if (rec.status !== 'P') calcF++;
                          }

                          return (
                            <td
                              key={d.day}
                              onClick={() => handleCellClick(emp.id, d.dateStr)}
                              style={{
                                textAlign: 'center', cursor: canEdit ? 'crosshair' : 'default', padding: '3px',
                                border: '1px solid var(--border-color)',
                                ...(isSundayOrHoliday && !rec ? { background: 'rgba(239, 68, 68, 0.05)' } : isSaturdayDay && !rec ? { background: 'rgba(245, 158, 11, 0.04)' } : {})
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
                    <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', fontWeight: 'bold', borderRight: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
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

          {/* INDICADOR HORA EXTRA */}
          {canViewDashboards && (
            <>
              <IndicatorFilter />
              <div className="table-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, rgba(59, 130, 246, 0.1) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)', marginTop: '-0.5rem' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>DESTAQUE DO PERÍODO: MAIOR CARGA EXTRA</span>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{heStats.emp?.name || '--'}</span>
                </div>
                <span style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 600 }}>Carga acumulada de {heStats.hoursText}</span>
              </div>
            </>
          )}

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
                  <th>Formulário</th>
                  <th>Funcionário</th>
                  <th>Início</th>
                  <th>Término</th>
                  <th>Duração</th>
                  <th>Custo</th>
                  <th>Causa</th>
                  <th>Motivo</th>
                  {(canEdit || canDelete) && <th style={{ width: 80, textAlign: 'right' }}>Ações</th>}
                </tr>
              </thead>
              <tbody>
                {heGroups.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Nenhuma hora extra lançada neste mês.</td></tr>
                )}
                {heGroups.map(grp => {
                  const names = grp.records.map(r => {
                    const emp = employees.find(e => e.id === r.employeeId);
                    return emp?.name || '---';
                  }).join(', ');

                  return (
                    <tr key={grp.key} className="data-row">
                      <td style={{ fontWeight: 500 }}>{grp.date.split('-').reverse().join('/')}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{grp.formNumber || '--'}</td>
                      <td style={{ fontWeight: 600, maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={names}>
                        {grp.records.length > 1 ? `${grp.records.length} Colaboradores` : names}
                      </td>
                      <td>{grp.startTime}</td>
                      <td>{grp.endTime}</td>
                      <td style={{ fontWeight: 'bold' }}>{calcDiff(grp.startTime, grp.endTime)}</td>
                      <td>{grp.costCenter}</td>
                      <td>{grp.cause}</td>
                      <td>{grp.motive || ''}</td>
                      {(canEdit || canDelete) && (
                        <td style={{ textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                          {canEdit && <button className="action-btn edit" onClick={() => openEditGroup(grp)}><Edit2 size={14} /></button>}
                          {canDelete && <button className="action-btn del" onClick={() => { if (confirm("Remover TODAS as horas (de " + grp.records.length + " funcionários) deste grupo?")) grp.records.forEach(r => onDeleteOvertime(r.id)); }}><Trash2 size={14} /></button>}
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
                    <span className="cad-name" style={{ textDecoration: emp.status === 'Inativo' ? 'line-through' : 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                    <span className="cad-meta" style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.registration && <span>Mat: {emp.registration}</span>}
                      {emp.registration && emp.role && <span style={{ margin: '0 0.4rem' }}>|</span>}
                      {emp.role && <span>{emp.role}</span>}
                    </span>
                  </div>
                </div>
                <div className="cad-card-actions">
                  {emp.status === 'Ativo' ? (
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#10b981', background: '#10b98120', padding: '2px 8px', borderRadius: '12px' }}>Ativo</span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', fontWeight: 'bold', color: '#64748b', background: '#64748b20', padding: '2px 8px', borderRadius: '12px' }}>Inativo</span>
                  )}
                  {canEdit && (
                    <div className="cad-actions">
                      {canEdit && <button className="action-btn edit" onClick={() => openEditEmp(emp)}><Edit2 size={16} /></button>}
                      {canDelete && <button className="action-btn del" onClick={() => window.confirm('Excluir ' + emp.name + '?') && onDeleteEmployee(emp.id)}><Trash2 size={16} /></button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>)}

      {/* MODAL HE */}
      {heModal.open && (
        <div className="modal-overlay" onClick={() => setHeModal({ open: false, editingGroup: null })}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{heModal.editingGroup ? 'Editar Grupo de Horas Extras' : 'Lançar Horas Extras'}</h2>
              <button className="modal-close" onClick={() => setHeModal({ open: false, editingGroup: null })}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group full">
                <label>Funcionário(s) *</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {heForm.employeeIds.map(id => {
                    const emp = activeEmployees.find(e => e.id === id);
                    return (
                      <div key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', background: 'var(--bg-layer)', padding: '0.3rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        {emp?.name}
                        <X size={12} style={{ cursor: 'pointer', color: '#ef4444' }} onClick={() => setHeForm(f => ({ ...f, employeeIds: f.employeeIds.filter(x => x !== id) }))} />
                      </div>
                    )
                  })}
                </div>
                <div className="select-wrap full-w">
                  <select value="" onChange={e => {
                    if (e.target.value && !heForm.employeeIds.includes(e.target.value)) {
                      setHeForm(f => ({ ...f, employeeIds: [...f.employeeIds, e.target.value] }));
                    }
                  }}>
                    <option value="">Adicionar funcionário...</option>
                    {activeEmployees.filter(e => !heForm.employeeIds.includes(e.id)).map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group full">
                <label>Nº do Formulário</label>
                <input type="text" placeholder="ex: FRM-202611" value={heForm.formNumber} onChange={e => setHeForm(f => ({ ...f, formNumber: e.target.value }))} />
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
                <div className="form-group full">
                  <label>Custo *</label>
                  <div className="select-wrap full-w">
                    <select value={heForm.costCenter} onChange={e => setHeForm(f => ({ ...f, costCenter: e.target.value }))}>
                      <option value="Honda">Honda</option>
                      <option value="LSL">LSL</option>
                    </select>
                  </div>
                </div>
                <div className="form-group full">
                  <label>Causa</label>
                  <input type="text" placeholder="ex: Estratégia Hines, Demanda cliente..." value={heForm.cause} onChange={e => setHeForm(f => ({ ...f, cause: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Motivo</label>
                  <input type="text" placeholder="ex: Descrição detalhada da atividade realizada..." value={heForm.motive} onChange={e => setHeForm(f => ({ ...f, motive: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setHeModal({ open: false, editingGroup: null })}>Cancelar</button>
              <button className="btn-primary" onClick={saveHE} disabled={isSaving || heForm.employeeIds.length === 0 || !heForm.date}><Save size={16} /> {isSaving ? 'Salvando...' : 'Salvar HE'}</button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Matrícula</label>
                  <input type="text" placeholder="ex: 12345" value={empForm.registration} onChange={e => setEmpForm(f => ({ ...f, registration: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Cargo</label>
                  <input type="text" placeholder="ex: Analista" value={empForm.role} onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))} />
                </div>
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
