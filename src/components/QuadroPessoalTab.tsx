import React, { useState, useMemo } from 'react';
import { Plus, Trash2, Edit2, Download, Save, X, ChevronDown, Check, AlertCircle, RefreshCw, FileText } from 'lucide-react';
import type { User, StaffingBoard, StaffingColumn, StaffingRow, StaffingCell } from '../types';

interface Props {
  currentUser: User | null;
  boards: StaffingBoard[];
  columns: StaffingColumn[];
  rows: StaffingRows[];
  cells: StaffingCell[];
  onSaveBoard: (board: StaffingBoard) => Promise<void>;
  onDeleteBoard: (id: string) => Promise<void>;
  onSaveColumn: (col: StaffingColumn) => Promise<void>;
  onDeleteColumn: (id: string) => Promise<void>;
  onSaveRow: (row: StaffingRow) => Promise<void>;
  onDeleteRow: (id: string) => Promise<void>;
  onSaveCell: (cell: StaffingCell) => Promise<void>;
}

// Adjusting interface naming mismatch
type StaffingRows = StaffingRow;

export default function QuadroPessoalTab({
  currentUser,
  boards,
  columns,
  rows,
  cells,
  onSaveBoard,
  onDeleteBoard,
  onSaveColumn,
  onDeleteColumn,
  onSaveRow,
  onDeleteRow,
  onSaveCell
}: Props) {
  const [activeBoardId, setActiveBoardId] = useState<string>(() => {
    return boards[0]?.id || '';
  });

  // Ensure activeBoardId is set if boards change
  React.useEffect(() => {
    if (boards.length > 0 && !activeBoardId) {
      setActiveBoardId(boards[0].id);
    }
  }, [boards, activeBoardId]);

  const canEdit = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão' || !!currentUser?.permissions?.quadroPessoal?.edit;
  const canDelete = currentUser?.role === 'Administrador' || currentUser?.role === 'Gestão' || !!currentUser?.permissions?.quadroPessoal?.delete;

  // Filter components for the active board
  const boardColumns = useMemo(() => {
    return columns.filter(c => c.boardId === activeBoardId).sort((a, b) => a.order - b.order);
  }, [columns, activeBoardId]);

  const boardRows = useMemo(() => {
    return rows.filter(r => r.boardId === activeBoardId).sort((a, b) => a.order - b.order);
  }, [rows, activeBoardId]);

  // Index cells for quick lookup: rowId_columnId -> cell
  const cellMap = useMemo(() => {
    const map: Record<string, StaffingCell> = {};
    cells.forEach(c => {
      map[`${c.rowId}_${c.columnId}`] = c;
    });
    return map;
  }, [cells]);

  // Modal states
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [boardFormName, setBoardFormName] = useState('');

  const [colModalOpen, setColModalOpen] = useState(false);
  const [colForm, setColForm] = useState({ name: '', orcado: 0, real: 0 });

  const [rowModalOpen, setRowModalOpen] = useState(false);
  const [rowForm, setRowForm] = useState({ cargo: '', setor: 'Projetos' });

  const [cellEditModal, setCellEditModal] = useState<{
    open: boolean;
    rowId: string;
    columnId: string;
    value: string;
    status: 'ativo' | 'transferido' | 'afastado';
  } | null>(null);

  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize standard boards and columns if database is empty
  const handleInitializeDefaults = async () => {
    setIsInitializing(true);
    try {
      // 1. Create boards
      const board1: StaffingBoard = { id: 'board-p-1', name: 'TIME LINE - REESTRUTURAÇÃO QUADRO PROJETOS', order: 0 };
      const board2: StaffingBoard = { id: 'board-p-2', name: 'TIME LINE - REESTRUTURAÇÃO QUADRO NOVOS MODELOS', order: 1 };
      
      await onSaveBoard(board1);
      await onSaveBoard(board2);

      // 2. Create columns for board 1
      const colsBoard1 = [
        { id: 'col-p1-1', name: 'CENARIO 2023', orcado: 12, real: 19, order: 0 },
        { id: 'col-p1-2', name: 'CENARIO 2024 - 1 SEM', orcado: 12, real: 19, order: 1 },
        { id: 'col-p1-3', name: 'CENARIO 2024 - 2 SEM', orcado: 12, real: 19, order: 2 },
        { id: 'col-p1-4', name: 'CENARIO 2025 - 1 SEM', orcado: 20, real: 20, order: 3 },
        { id: 'col-p1-5', name: 'CENARIO 2025 - 2 SEM', orcado: 20, real: 21, order: 4 },
        { id: 'col-p1-6', name: 'CENARIO 2026 - 1 SEM', orcado: 20, real: 19, order: 5 },
        { id: 'col-p1-7', name: 'CENARIO 2026 - 2 SEM', orcado: 20, real: 19, order: 6 },
      ];

      for (const col of colsBoard1) {
        await onSaveColumn({ ...col, boardId: board1.id });
      }

      // Create columns for board 2
      const colsBoard2 = [
        { id: 'col-p2-1', name: 'CENARIO 2023', orcado: 6, real: 5, order: 0 },
        { id: 'col-p2-2', name: 'CENARIO 2024 - 1 SEM', orcado: 8, real: 7, order: 1 },
        { id: 'col-p2-3', name: 'CENARIO 2024 - 2 SEM', orcado: 10, real: 8, order: 2 },
        { id: 'col-p2-4', name: 'CENARIO 2025 - 1 SEM', orcado: 12, real: 11, order: 3 },
        { id: 'col-p2-5', name: 'CENARIO 2025 - 2 SEM', orcado: 12, real: 12, order: 4 },
      ];

      for (const col of colsBoard2) {
        await onSaveColumn({ ...col, boardId: board2.id });
      }

      // 3. Create rows for board 1
      const rowsBoard1 = [
        { id: 'row-p1-1', cargo: 'GERENTE', setor: 'Projetos', order: 0 },
        { id: 'row-p1-2', cargo: 'GERENTE', setor: 'Projetos', order: 1 },
        { id: 'row-p1-3', cargo: 'SUPERVISOR', setor: 'Projetos', order: 2 },
        { id: 'row-p1-4', cargo: 'SUPERVISOR', setor: 'Projetos', order: 3 },
        { id: 'row-p1-5', cargo: 'CHEFE', setor: 'Projetos', order: 4 },
        { id: 'row-p1-6', cargo: 'ANALISTA DE PROCESSO SR F11', setor: 'T&P', order: 5 },
        { id: 'row-p1-7', cargo: 'ANALISTA DE PROCESSO SR', setor: 'T&P', order: 6 },
        { id: 'row-p1-8', cargo: 'ESPECIALISTA', setor: 'Projetos', order: 7 },
        { id: 'row-p1-9', cargo: 'ANALISTAS', setor: 'Projetos', order: 8 },
        { id: 'row-p1-10', cargo: 'TECNICO DE PROCESSO', setor: 'T&P', order: 9 },
        { id: 'row-p1-11', cargo: 'ASSISTENTE', setor: 'Projetos', order: 10 },
        { id: 'row-p1-12', cargo: 'ASSISTENTE', setor: 'Projetos', order: 11 },
        { id: 'row-p1-13', cargo: 'ASSISTENTE', setor: 'Projetos', order: 12 },
        { id: 'row-p1-14', cargo: 'ASSISTENTE', setor: 'Projetos', order: 13 },
        { id: 'row-p1-15', cargo: 'ASSISTENTE', setor: 'T&P', order: 14 },
        { id: 'row-p1-16', cargo: 'ASSISTENTE', setor: 'Projetos', order: 15 },
        { id: 'row-p1-17', cargo: 'ANALISTAS', setor: 'Projetos', order: 16 },
        { id: 'row-p1-18', cargo: 'ANALISTAS', setor: 'Projetos', order: 17 },
        { id: 'row-p1-19', cargo: 'ANALISTAS', setor: 'Projetos', order: 18 },
        { id: 'row-p1-20', cargo: 'ANALISTAS', setor: 'Projetos', order: 19 },
        { id: 'row-p1-21', cargo: 'AUX. OPERADOR', setor: 'Projetos', order: 20 },
      ];

      for (const row of rowsBoard1) {
        await onSaveRow({ ...row, boardId: board1.id });
      }

      // Create rows for board 2
      const rowsBoard2 = [
        { id: 'row-p2-1', cargo: 'ANALISTA', setor: 'Projetos', order: 0 },
        { id: 'row-p2-2', cargo: 'OP. LOGÍSTICO ESP PL D6', setor: 'Projetos', order: 1 },
        { id: 'row-p2-3', cargo: 'OP. LOGÍSTICO A2', setor: 'Projetos', order: 2 },
        { id: 'row-p2-4', cargo: 'OP. LOGÍSTICO A2', setor: 'Projetos', order: 3 },
        { id: 'row-p2-5', cargo: 'OP. LOGÍSTICO A', setor: 'Projetos', order: 4 },
        { id: 'row-p2-6', cargo: 'OP. LOGÍSTICO A', setor: 'Projetos', order: 5 },
        { id: 'row-p2-7', cargo: 'CHEFE', setor: 'Projetos', order: 6 },
      ];

      for (const row of rowsBoard2) {
        await onSaveRow({ ...row, boardId: board2.id });
      }

      // 4. Seeding cells for board 1
      const cellsData = [
        { rowId: 'row-p1-1', colId: 'col-p1-1', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-2', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-3', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-4', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-5', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-6', val: 'EDER', stat: 'ativo' },
        { rowId: 'row-p1-1', colId: 'col-p1-7', val: 'EDER', stat: 'ativo' },

        { rowId: 'row-p1-2', colId: 'col-p1-1', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-2', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-3', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-4', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-5', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-6', val: 'FABIANO', stat: 'afastado' },
        { rowId: 'row-p1-2', colId: 'col-p1-7', val: 'FABIANO', stat: 'afastado' },

        { rowId: 'row-p1-3', colId: 'col-p1-1', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-2', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-3', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-4', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-5', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-6', val: 'MARCOS MORAES', stat: 'ativo' },
        { rowId: 'row-p1-3', colId: 'col-p1-7', val: 'MARCOS MORAES', stat: 'ativo' },

        { rowId: 'row-p1-4', colId: 'col-p1-1', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-2', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-3', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-4', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-5', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-6', val: 'REGINALDO', stat: 'ativo' },
        { rowId: 'row-p1-4', colId: 'col-p1-7', val: 'REGINALDO', stat: 'ativo' },

        { rowId: 'row-p1-5', colId: 'col-p1-1', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-2', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-3', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-4', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-5', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-6', val: 'RELDERY', stat: 'ativo' },
        { rowId: 'row-p1-5', colId: 'col-p1-7', val: 'RELDERY', stat: 'ativo' },

        { rowId: 'row-p1-6', colId: 'col-p1-1', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-2', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-3', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-4', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-5', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-6', val: 'LUCAS', stat: 'ativo' },
        { rowId: 'row-p1-6', colId: 'col-p1-7', val: 'LUCAS', stat: 'ativo' },

        { rowId: 'row-p1-7', colId: 'col-p1-1', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-2', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-3', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-4', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-5', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-6', val: 'JADERSON', stat: 'ativo' },
        { rowId: 'row-p1-7', colId: 'col-p1-7', val: 'JADERSON', stat: 'ativo' },

        { rowId: 'row-p1-8', colId: 'col-p1-1', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-2', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-3', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-4', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-5', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-6', val: 'DEOCLECIO', stat: 'ativo' },
        { rowId: 'row-p1-8', colId: 'col-p1-7', val: 'DEOCLECIO', stat: 'ativo' },

        { rowId: 'row-p1-9', colId: 'col-p1-1', val: 'GABRIEL', stat: 'ativo' },
        { rowId: 'row-p1-9', colId: 'col-p1-2', val: 'GABRIEL', stat: 'ativo' },
        { rowId: 'row-p1-9', colId: 'col-p1-3', val: 'GABRIEL', stat: 'ativo' },
        { rowId: 'row-p1-9', colId: 'col-p1-4', val: 'GABRIEL 07/04/25', stat: 'transferido' },
        { rowId: 'row-p1-9', colId: 'col-p1-5', val: 'JOAO PEDRO', stat: 'ativo' },
        { rowId: 'row-p1-9', colId: 'col-p1-6', val: 'JOAO PEDRO', stat: 'ativo' },
        { rowId: 'row-p1-9', colId: 'col-p1-7', val: 'JOAO PEDRO', stat: 'ativo' },

        { rowId: 'row-p1-10', colId: 'col-p1-1', val: 'IANCA', stat: 'ativo' },
        { rowId: 'row-p1-10', colId: 'col-p1-2', val: 'IANCA', stat: 'ativo' },
        { rowId: 'row-p1-10', colId: 'col-p1-3', val: 'IANCA-TRANS.SAO', stat: 'transferido' },
        { rowId: 'row-p1-10', colId: 'col-p1-4', val: 'EVELYN', stat: 'ativo' },
        { rowId: 'row-p1-10', colId: 'col-p1-5', val: 'EVELYN', stat: 'ativo' },
        { rowId: 'row-p1-10', colId: 'col-p1-6', val: 'EVELYN', stat: 'ativo' },
        { rowId: 'row-p1-10', colId: 'col-p1-7', val: 'EVELYN', stat: 'ativo' },

        { rowId: 'row-p1-11', colId: 'col-p1-1', val: 'ADRIANO - 02/12/23', stat: 'transferido' },
        { rowId: 'row-p1-11', colId: 'col-p1-2', val: 'MATEUS', stat: 'ativo' },
        { rowId: 'row-p1-11', colId: 'col-p1-3', val: 'MATEUS', stat: 'ativo' },
        { rowId: 'row-p1-11', colId: 'col-p1-4', val: 'MATEUS 20/11/25', stat: 'transferido' },
        { rowId: 'row-p1-11', colId: 'col-p1-5', val: 'MATEUS 20/11/25', stat: 'transferido' },
        { rowId: 'row-p1-11', colId: 'col-p1-6', val: 'MATEUS 20/11/25', stat: 'transferido' },
        { rowId: 'row-p1-11', colId: 'col-p1-7', val: 'ALEXANDRO THOMAS - 05/05', stat: 'ativo' },

        { rowId: 'row-p1-12', colId: 'col-p1-1', val: 'ELTON', stat: 'ativo' },
        { rowId: 'row-p1-12', colId: 'col-p1-2', val: 'ELTON', stat: 'ativo' },
        { rowId: 'row-p1-12', colId: 'col-p1-3', val: 'ELTON', stat: 'ativo' },
        { rowId: 'row-p1-12', colId: 'col-p1-4', val: 'ELTON 02/07/25', stat: 'transferido' },
        { rowId: 'row-p1-12', colId: 'col-p1-5', val: 'JOAO VICTOR', stat: 'ativo' },
        { rowId: 'row-p1-12', colId: 'col-p1-6', val: 'JOAO VICTOR', stat: 'ativo' },
        { rowId: 'row-p1-12', colId: 'col-p1-7', val: 'JOAO VICTOR', stat: 'ativo' },

        { rowId: 'row-p1-13', colId: 'col-p1-1', val: 'NOEMI', stat: 'ativo' },
        { rowId: 'row-p1-13', colId: 'col-p1-2', val: 'NOEMI', stat: 'ativo' },
        { rowId: 'row-p1-13', colId: 'col-p1-3', val: 'NOEMI', stat: 'ativo' },
        { rowId: 'row-p1-13', colId: 'col-p1-4', val: 'NOEMI 03/02/25', stat: 'transferido' },
        { rowId: 'row-p1-13', colId: 'col-p1-5', val: 'MARCOS VINICIUS', stat: 'ativo' },
        { rowId: 'row-p1-13', colId: 'col-p1-6', val: 'MARCOS VINICIUS', stat: 'ativo' },
        { rowId: 'row-p1-13', colId: 'col-p1-7', val: 'MARCOS VINICIUS', stat: 'ativo' },
      ];

      for (const cell of cellsData) {
        await onSaveCell({
          id: `${cell.rowId}_${cell.colId}`,
          rowId: cell.rowId,
          columnId: cell.colId,
          value: cell.val,
          status: cell.stat as any
        });
      }

      setActiveBoardId(board1.id);
      alert('Estrutura de dados padrão inicializada com sucesso!');
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Erro ao inicializar.');
    } finally {
      setIsInitializing(false);
    }
  };

  // CRUD actions
  const handleAddBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardFormName.trim()) return;
    const newBoard: StaffingBoard = {
      id: crypto.randomUUID(),
      name: boardFormName.trim().toUpperCase(),
      order: boards.length
    };
    await onSaveBoard(newBoard);
    setBoardFormName('');
    setBoardModalOpen(false);
    setActiveBoardId(newBoard.id);
  };

  const handleAddColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!colForm.name.trim()) return;
    const newCol: StaffingColumn = {
      id: crypto.randomUUID(),
      boardId: activeBoardId,
      name: colForm.name.trim().toUpperCase(),
      orcado: colForm.orcado,
      real: colForm.real,
      order: boardColumns.length
    };
    await onSaveColumn(newCol);
    setColModalOpen(false);
    setColForm({ name: '', orcado: 0, real: 0 });
  };

  const handleAddRow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowForm.cargo.trim()) return;
    const newRow: StaffingRow = {
      id: crypto.randomUUID(),
      boardId: activeBoardId,
      cargo: rowForm.cargo.trim().toUpperCase(),
      setor: rowForm.setor,
      order: boardRows.length
    };
    await onSaveRow(newRow);
    setRowModalOpen(false);
    setRowForm({ cargo: '', setor: 'Projetos' });
  };

  const handleCellClick = (rowId: string, colId: string) => {
    if (!canEdit) return;
    const key = `${rowId}_${colId}`;
    const cell = cellMap[key];
    setCellEditModal({
      open: true,
      rowId,
      columnId: colId,
      value: cell ? cell.value : '',
      status: cell ? cell.status : 'ativo'
    });
  };

  const handleSaveCell = async () => {
    if (!cellEditModal) return;
    const { rowId, columnId, value, status } = cellEditModal;
    const id = `${rowId}_${columnId}`;
    await onSaveCell({ id, rowId, columnId, value: value.trim(), status });
    setCellEditModal(null);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!canDelete) return;
    if (confirm('Tem certeza que deseja excluir esta coluna de cenário? Todas as atribuições serão removidas.')) {
      await onDeleteColumn(colId);
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!canDelete) return;
    if (confirm('Tem certeza que deseja excluir esta linha/cargo? Todos os dados vinculados a ela serão perdidos.')) {
      await onDeleteRow(rowId);
    }
  };

  const handleUpdateColumnMeta = async (col: StaffingColumn, field: 'name' | 'orcado' | 'real', value: any) => {
    if (!canEdit) return;
    const updated = {
      ...col,
      [field]: field === 'name' ? value : Number(value)
    };
    await onSaveColumn(updated);
  };

  const handleExportCSV = () => {
    if (boardColumns.length === 0) return;
    const activeBoard = boards.find(b => b.id === activeBoardId);
    const title = activeBoard ? activeBoard.name : 'QUADRO DE PESSOAL';

    const headers = ['CARGO', ...boardColumns.map(c => c.name), 'SETOR'];
    const orcadoRow = ['ORÇADO', ...boardColumns.map(c => c.orcado), ''];
    const realRow = ['QTD REAL', ...boardColumns.map(c => {
      // Auto calculation: count of cells in this column that are filled and not transferred
      const colCells = boardRows.map(r => cellMap[`${r.id}_${c.id}`]).filter(cell => cell && cell.value.trim() !== '' && cell.status !== 'transferido');
      return colCells.length;
    }), ''];

    const dataRows = boardRows.map(r => {
      const rowCols = boardColumns.map(c => {
        const cell = cellMap[`${r.id}_${c.id}`];
        if (!cell || cell.value.trim() === '') return '-';
        const statusLabel = cell.status === 'afastado' ? ' (Afastado INSS)' : cell.status === 'transferido' ? ' (Desligado)' : '';
        return `"${cell.value}${statusLabel}"`;
      });
      return [r.cargo, ...rowCols, r.setor];
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [
      title,
      '',
      headers.join(';'),
      orcadoRow.join(';'),
      realRow.join(';'),
      ...dataRows.map(row => row.join(';'))
    ].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `${title.replace(/\s+/g, '_')}.csv`;
    link.click();
  };

  // Helper to color names
  const getCellColor = (status: 'ativo' | 'transferido' | 'afastado') => {
    if (status === 'transferido') return '#ef4444'; // Red
    if (status === 'afastado') return '#f97316'; // Orange
    return 'var(--text-primary)'; // Regular black/white
  };

  // Welcome state if there are no boards
  if (boards.length === 0) {
    return (
      <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1.5rem' }}>
        <FileText size={64} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
        <h2 style={{ color: 'var(--text-primary)' }}>Nenhum Quadro de Pessoal Ativo</h2>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '500px' }}>
          Para começar a gerenciar o quadro de pessoal, você pode inicializar a estrutura padrão de cenários mostrada na documentação ou criar um novo quadro personalizado.
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={handleInitializeDefaults} disabled={isInitializing}>
            {isInitializing ? <RefreshCw size={16} className="spinner" /> : <Plus size={16} />}
            Inicializar Estrutura Padrão (2 Quadros)
          </button>
          <button className="btn-ghost" onClick={() => setBoardModalOpen(true)}>
            Criar Quadro em Branco
          </button>
        </div>

        {/* Board Modal */}
        {boardModalOpen && (
          <div className="modal-overlay" onClick={() => setBoardModalOpen(false)}>
            <div className="modal-box sm" onClick={e => e.stopPropagation()}>
              <form onSubmit={handleAddBoard}>
                <div className="modal-header">
                  <h2>Criar Novo Quadro</h2>
                  <button type="button" className="modal-close" onClick={() => setBoardModalOpen(false)}><X size={20} /></button>
                </div>
                <div className="modal-body">
                  <div className="form-group full">
                    <label>Nome do Quadro *</label>
                    <input
                      type="text"
                      placeholder="Ex: QUADRO PROJETOS 2026"
                      value={boardFormName}
                      onChange={e => setBoardFormName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn-ghost" onClick={() => setBoardModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn-primary">Criar Quadro</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="tab-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── HEADER ── */}
      <div className="tab-header" style={{ paddingBottom: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="tab-title">Quadro de Pessoal</h1>
            <p className="tab-subtitle">Linha do tempo e reestruturação de quadro</p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-ghost" onClick={handleExportCSV}>
              <Download size={16} /> Exportar Planilha
            </button>
            {canEdit && (
              <>
                <button className="btn-ghost" onClick={() => setBoardModalOpen(true)}>
                  <Plus size={16} /> Novo Quadro
                </button>
                <button className="btn-primary" onClick={() => setColModalOpen(true)}>
                  <Plus size={16} /> Novo Cenário (Coluna)
                </button>
                <button className="btn-primary" onClick={() => setRowModalOpen(true)}>
                  <Plus size={16} /> Novo Cargo (Linha)
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── BOARD SELECTOR TABS ── */}
      <div className="section-tabs" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
          {boards.map(b => (
            <button
              key={b.id}
              className={`sec-tab ${activeBoardId === b.id ? 'sec-active' : ''}`}
              onClick={() => setActiveBoardId(b.id)}
            >
              {b.name}
            </button>
          ))}
        </div>

        {canDelete && boards.length > 0 && (
          <button
            className="action-btn del"
            style={{ marginRight: '1rem', padding: '0.5rem' }}
            onClick={() => {
              if (confirm('Tem certeza que deseja excluir o quadro inteiro atual? Esta ação apagará todas as linhas, colunas e células.')) {
                onDeleteBoard(activeBoardId);
              }
            }}
            title="Excluir Quadro Atual"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* ── LEGENDA ── */}
      <div className="table-card" style={{ padding: '1rem', margin: '0.75rem 0' }}>
        <h3 style={{ fontSize: '0.85rem', marginBottom: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>LEGENDA:</h3>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>NOME PRETO</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>— COLABORADOR REGULAR/ATIVO</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#ef4444' }}>NOME VERMELHO</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>— TRANSFERIDO OUTRO SETOR / DESLIGADO</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#f97316' }}>NOME LARANJA</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>— AFASTADO INSS</span>
          </div>
        </div>
      </div>

      {/* ── GRID TABLE ── */}
      <div className="table-card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
        {boardColumns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
            Nenhum cenário cadastrado para este quadro. Clique em "Novo Cenário" para criar a primeira coluna.
          </div>
        ) : (
          <div className="table-scroll custom-scroll" style={{ flex: 1, borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <table className="data-table" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '900px' }}>
              <thead>
                {/* 1. Columns headers */}
                <tr style={{ background: 'var(--bg-layer)' }}>
                  <th style={{ width: '220px', position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)', fontWeight: 800 }}>
                    CARGO
                  </th>
                  {boardColumns.map(c => (
                    <th key={c.id} style={{ textAlign: 'center', padding: '0.75rem', position: 'relative' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}>
                        {canEdit ? (
                          <input
                            type="text"
                            value={c.name}
                            onChange={e => handleUpdateColumnMeta(c, 'name', e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: 'var(--text-primary)',
                              fontWeight: 800,
                              textAlign: 'center',
                              width: '100%',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          />
                        ) : (
                          <span>{c.name}</span>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => handleDeleteColumn(c.id)}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(239, 68, 68, 0.4)' }}
                            title="Deletar cenário"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th style={{ width: '110px', textAlign: 'center', fontWeight: 800 }}>SETOR</th>
                </tr>

                {/* 2. ORÇADO Row */}
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.01)' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)', fontWeight: 700, padding: '0.5rem 1rem' }}>
                    ORÇADO
                  </td>
                  {boardColumns.map(c => (
                    <td key={c.id} style={{ textAlign: 'center', padding: '0.4rem' }}>
                      {canEdit ? (
                        <input
                          type="number"
                          value={c.orcado}
                          min="0"
                          onChange={e => handleUpdateColumnMeta(c, 'orcado', e.target.value)}
                          style={{
                            background: 'var(--bg-layer)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '4px',
                            color: 'var(--text-primary)',
                            fontWeight: 'bold',
                            textAlign: 'center',
                            width: '60px',
                            padding: '2px'
                          }}
                        />
                      ) : (
                        <span style={{ fontWeight: 'bold' }}>{c.orcado}</span>
                      )}
                    </td>
                  ))}
                  <td style={{ background: 'var(--bg-card)' }} />
                </tr>

                {/* 3. QTD REAL Row */}
                <tr style={{ borderBottom: '2px solid var(--border-color)', background: 'rgba(255, 255, 255, 0.02)' }}>
                  <td style={{ position: 'sticky', left: 0, zIndex: 10, background: 'var(--bg-card)', borderRight: '2px solid var(--border-color)', fontWeight: 700, padding: '0.5rem 1rem' }}>
                    QTD REAL
                  </td>
                  {boardColumns.map(c => {
                    // Count filled cells in this scenario column that are not 'transferido'
                    const activeCount = boardRows.reduce((acc, r) => {
                      const cell = cellMap[`${r.id}_${c.id}`];
                      if (cell && cell.value.trim() !== '' && cell.status !== 'transferido') {
                        return acc + 1;
                      }
                      return acc;
                    }, 0);

                    return (
                      <td key={c.id} style={{ textAlign: 'center', padding: '0.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <span style={{
                          background: activeCount > c.orcado ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                          color: activeCount > c.orcado ? '#ef4444' : '#10b981',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.85rem'
                        }}>
                          {activeCount}
                        </span>
                      </td>
                    );
                  })}
                  <td style={{ background: 'var(--bg-card)' }} />
                </tr>
              </thead>
              <tbody>
                {boardRows.length === 0 ? (
                  <tr>
                    <td colSpan={boardColumns.length + 2} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      Nenhum cargo cadastrado. Clique em "Novo Cargo" para criar a primeira linha.
                    </td>
                  </tr>
                ) : (
                  boardRows.map((r, rowIndex) => (
                    <tr key={r.id} className="data-row hover-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      {/* Row cargo header */}
                      <td style={{
                        position: 'sticky',
                        left: 0,
                        zIndex: 10,
                        background: 'var(--bg-card)',
                        borderRight: '2px solid var(--border-color)',
                        padding: '0.6rem 1rem',
                        fontWeight: 600
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <span>{rowIndex + 1}. {r.cargo}</span>
                          {canDelete && (
                            <button
                              onClick={() => handleDeleteRow(r.id)}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(239, 68, 68, 0.4)' }}
                              className="action-btn-del-row"
                              title="Excluir cargo"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Row cells */}
                      {boardColumns.map(c => {
                        const cell = cellMap[`${r.id}_${c.id}`];
                        const textVal = cell && cell.value.trim() !== '' ? cell.value : '-';
                        const status = cell ? cell.status : 'ativo';

                        return (
                          <td
                            key={c.id}
                            onClick={() => handleCellClick(r.id, c.id)}
                            style={{
                              textAlign: 'center',
                              cursor: canEdit ? 'pointer' : 'default',
                              padding: '0.5rem',
                              fontWeight: textVal !== '-' ? 700 : 400,
                              color: getCellColor(status),
                              borderRight: '1px solid var(--border-color)',
                              background: textVal !== '-' ? 'rgba(255, 255, 255, 0.01)' : 'transparent',
                              transition: 'all 0.2s'
                            }}
                            className="staff-grid-cell"
                          >
                            {textVal}
                          </td>
                        );
                      })}

                      {/* Setor column */}
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)', padding: '0.6rem' }}>
                        {r.setor}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── NEW BOARD MODAL ── */}
      {boardModalOpen && (
        <div className="modal-overlay" onClick={() => setBoardModalOpen(false)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleAddBoard}>
              <div className="modal-header">
                <h2>Criar Novo Quadro</h2>
                <button type="button" className="modal-close" onClick={() => setBoardModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group full">
                  <label>Nome do Quadro *</label>
                  <input
                    type="text"
                    placeholder="Ex: QUADRO PROJETOS 2026"
                    value={boardFormName}
                    onChange={e => setBoardFormName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setBoardModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Criar Quadro</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NEW COLUMN MODAL ── */}
      {colModalOpen && (
        <div className="modal-overlay" onClick={() => setColModalOpen(false)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleAddColumn}>
              <div className="modal-header">
                <h2>Novo Cenário (Coluna)</h2>
                <button type="button" className="modal-close" onClick={() => setColModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group full">
                  <label>Nome do Cenário *</label>
                  <input
                    type="text"
                    placeholder="Ex: CENÁRIO 2027 - 1 SEM"
                    value={colForm.name}
                    onChange={e => setColForm(f => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group full">
                  <label>Meta Orçada (Headcount)</label>
                  <input
                    type="number"
                    min="0"
                    value={colForm.orcado}
                    onChange={e => setColForm(f => ({ ...f, orcado: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setColModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Adicionar Cenário</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── NEW ROW MODAL ── */}
      {rowModalOpen && (
        <div className="modal-overlay" onClick={() => setRowModalOpen(false)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <form onSubmit={handleAddRow}>
              <div className="modal-header">
                <h2>Novo Cargo (Linha)</h2>
                <button type="button" className="modal-close" onClick={() => setRowModalOpen(false)}><X size={20} /></button>
              </div>
              <div className="modal-body">
                <div className="form-group full">
                  <label>Título do Cargo *</label>
                  <input
                    type="text"
                    placeholder="Ex: COORDENADOR"
                    value={rowForm.cargo}
                    onChange={e => setRowForm(f => ({ ...f, cargo: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group full">
                  <label>Setor / Área de Atuação</label>
                  <div className="select-wrap full-w">
                    <select
                      value={rowForm.setor}
                      onChange={e => setRowForm(f => ({ ...f, setor: e.target.value }))}
                    >
                      <option value="Projetos">Projetos</option>
                      <option value="T&P">T&P</option>
                    </select>
                    <ChevronDown size={14} className="sel-icon" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-ghost" onClick={() => setRowModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn-primary">Adicionar Cargo</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CELL EDITING MODAL ── */}
      {cellEditModal && cellEditModal.open && (
        <div className="modal-overlay" onClick={() => setCellEditModal(null)}>
          <div className="modal-box sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Atribuir Colaborador</h2>
              <button className="modal-close" onClick={() => setCellEditModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group full">
                <label>Nome do Colaborador (Deixe vazio para "-")</label>
                <input
                  type="text"
                  placeholder="Nome e Sobrenome"
                  value={cellEditModal.value}
                  onChange={e => setCellEditModal(prev => prev ? { ...prev, value: e.target.value } : null)}
                  autoFocus
                />
              </div>

              <div className="form-group full">
                <label>Status do Colaborador</label>
                <div className="select-wrap full-w">
                  <select
                    value={cellEditModal.status}
                    onChange={e => setCellEditModal(prev => prev ? { ...prev, status: e.target.value as any } : null)}
                  >
                    <option value="ativo">Regular / Ativo (Cor: Preto)</option>
                    <option value="transferido">Transferido de Setor / Desligado (Cor: Vermelho)</option>
                    <option value="afastado">Afastado INSS (Cor: Laranja)</option>
                  </select>
                  <ChevronDown size={14} className="sel-icon" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setCellEditModal(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveCell}>
                <Check size={16} /> Confirmar Atribuição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
