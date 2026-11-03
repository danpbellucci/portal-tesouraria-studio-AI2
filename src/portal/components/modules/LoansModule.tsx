// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { BulkDeleteBar, CheckCell, useBulkSelect, useIsAdmin } from '../common/BulkDelete';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Search,
  Calculator,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  Layers,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  X,
  Edit2
} from 'lucide-react';
import { LoanContract, LoanEvent, Company, Bank, IndicatorVersion } from '../../types/treasury';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { formatDateBR } from '../../utils/date';

export const LoansModule: React.FC = () => {
  const { showToast } = useToast();
  const [contracts, setContracts] = useState<LoanContract[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [cdiVersions, setCdiVersions] = useState<IndicatorVersion[]>([]);
  const [kpis, setKpis] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Tab: 'CONTRACTS' | 'SIMULATOR'
  const [activeTab, setActiveTab] = useState<'CONTRACTS' | 'SIMULATOR'>('CONTRACTS');

  // Modals
  const [isContractFormOpen, setIsContractFormOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState<LoanContract | null>(null);
  const [isRealizeModalOpen, setIsRealizeModalOpen] = useState(false);
  const [targetEvent, setTargetEvent] = useState<{ contractId: string; event: LoanEvent } | null>(null);

  // Contract form states
  const [contractNumber, setContractNumber] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [bankId, setBankId] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [maturityDate, setMaturityDate] = useState('2027-01-15');
  const [contractedAmount, setContractedAmount] = useState('10000000.00');
  const [spreadAnnual, setSpreadAnnual] = useState('1.50');
  const [cdiVersionId, setCdiVersionId] = useState('default');
  const [notes, setNotes] = useState('');
  const [eventsList, setEventsList] = useState<Array<{
    plannedDate: string;
    type: 'INTEREST' | 'AMORTIZATION' | 'INTEREST_AND_AMORTIZATION';
    plannedAmortization: string;
  }>>([
    { plannedDate: '2026-06-15', type: 'INTEREST', plannedAmortization: '0.00' },
    { plannedDate: '2026-12-15', type: 'INTEREST_AND_AMORTIZATION', plannedAmortization: '10000000.00' }
  ]);

  // Realized event states
  const [actualDate, setActualDate] = useState('');
  const [actualInterest, setActualInterest] = useState('');
  const [actualAmortization, setActualAmortization] = useState('');
  const [realizeNotes, setRealizeNotes] = useState('');

  // Simulator states
  const [simName, setSimName] = useState('Simulação de Custo Financeiro');
  const [simCompanyId, setSimCompanyId] = useState('');
  const [simBankId, setSimBankId] = useState('');
  const [simStartDate, setSimStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [simMaturityDate, setSimMaturityDate] = useState('2027-01-15');
  const [simAmount, setSimAmount] = useState('20000000.00');
  const [simSpread, setSimSpread] = useState('1.75');
  const [simCdiVersionId, setSimCdiVersionId] = useState('default');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [contractsRes, compRes, bankRes, verRes, kpiRes] = await Promise.all([
        ApiClient.request('/api/loans'),
        ApiClient.request('/api/companies'),
        ApiClient.request('/api/banks'),
        ApiClient.request('/api/indicators/versions'),
        ApiClient.request('/api/loans/dashboard')
      ]);
      setContracts(contractsRes);
      setCompanies(compRes);
      setBanks(bankRes);
      setCdiVersions(verRes);
      setKpis(kpiRes);

      if (compRes.length > 0 && !companyId) {
        setCompanyId(compRes[0].id);
        setSimCompanyId(compRes[0].id);
      }
      if (bankRes.length > 0 && !bankId) {
        setBankId(bankRes[0].id);
        setSimBankId(bankRes[0].id);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatBRL = (val: string | number) => {
    const n = Number(val || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handleOpenCreateContract = () => {
    setContractNumber(`ELO-FIN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setContractedAmount('10000000.00');
    setSpreadAnnual('1.50');
    setStartDate(new Date().toISOString().split('T')[0]);
    setMaturityDate('2027-01-15');
    setNotes('');
    setEventsList([
      { plannedDate: '2026-06-15', type: 'INTEREST', plannedAmortization: '0.00' },
      { plannedDate: '2026-12-15', type: 'INTEREST_AND_AMORTIZATION', plannedAmortization: '10000000.00' }
    ]);
    setIsContractFormOpen(true);
  };

  const handleAddEventRow = () => {
    setEventsList((prev) => [
      ...prev,
      { plannedDate: maturityDate, type: 'INTEREST', plannedAmortization: '0.00' }
    ]);
  };

  const handleRemoveEventRow = (index: number) => {
    setEventsList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreateContract = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.request('/api/loans', {
        method: 'POST',
        body: JSON.stringify({
          contractNumber,
          companyId,
          bankId,
          startDate,
          maturityDate,
          contractedAmount,
          spreadAnnual,
          cdiVersionId,
          events: eventsList,
          notes
        })
      });
      showToast('Contrato de empréstimo cadastrado e cronograma calculado com sucesso.', 'success');
      setIsContractFormOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOpenRealizeModal = (contractId: string, event: LoanEvent) => {
    setTargetEvent({ contractId, event });
    setActualDate(event.actualDate || new Date().toISOString().split('T')[0]);
    setActualInterest(event.actualInterest || event.plannedInterest);
    setActualAmortization(event.actualAmortization || event.plannedAmortization);
    setRealizeNotes(event.notes || '');
    setIsRealizeModalOpen(true);
  };

  const handleConfirmRealize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetEvent) return;

    try {
      await ApiClient.request(`/api/loans/${targetEvent.contractId}/events/${targetEvent.event.id}/realize`, {
        method: 'POST',
        body: JSON.stringify({
          actualDate,
          actualInterest,
          actualAmortization,
          notes: realizeNotes
        })
      });
      showToast('Liquidação realizada registrada com sucesso. Saldo devedor atualizado.', 'success');
      setIsRealizeModalOpen(false);
      loadData();
      if (selectedContract && selectedContract.id === targetEvent.contractId) {
        const updated = await ApiClient.request(`/api/loans/${targetEvent.contractId}`);
        setSelectedContract(updated);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRunSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimulating(true);
    try {
      const simEvents = [
        { plannedDate: '2026-06-15', type: 'INTEREST', plannedAmortization: '0.00' },
        { plannedDate: '2026-12-15', type: 'INTEREST_AND_AMORTIZATION', plannedAmortization: simAmount }
      ];

      const res = await ApiClient.request('/api/loans/simulate', {
        method: 'POST',
        body: JSON.stringify({
          name: simName,
          companyId: simCompanyId,
          bankId: simBankId,
          startDate: simStartDate,
          maturityDate: simMaturityDate,
          principalAmount: simAmount,
          spreadAnnual: simSpread,
          cdiVersionId: simCdiVersionId,
          events: simEvents
        })
      });
      setSimResult(res);
      showToast('Simulação calculada com precisão decimal exata.', 'success');
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSimulating(false);
    }
  };

  const isAdmin = useIsAdmin();
  const sel = useBulkSelect(contracts.map((x) => x.id));

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Empréstimos Bancários & Simulações Financeiras</h1>
          <p className="text-xs text-slate-500 mt-1">
            Gestão de contratos atrelados ao CDI, cálculo de juros compostos em base 252 dias úteis, amortizações e projeções.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="p-1 bg-slate-100 rounded-lg flex items-center gap-1">
            <button
              onClick={() => setActiveTab('CONTRACTS')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'CONTRACTS' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Contratos Ativos
            </button>
            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'SIMULATOR' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Simulador de Custo CDI
            </button>
          </div>

          {activeTab === 'CONTRACTS' && (
            <button
              onClick={handleOpenCreateContract}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shadow-sm ml-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Novo Contrato</span>
            </button>
          )}
        </div>
      </div>

      {/* KPIs Summary Cards */}
      {kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 min-w-0 overflow-hidden">
            <span className="text-xs text-slate-500 block">Saldo Devedor Consolidado</span>
            <span className="block text-lg 2xl:text-xl leading-tight break-all font-bold font-mono tabular-nums text-slate-900">
              {formatBRL(kpis.totalOutstanding)}
            </span>
            <span className="text-[11px] text-slate-400 block">{kpis.activeContractsCount} contratos vigentes</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 min-w-0 overflow-hidden">
            <span className="text-xs text-slate-500 block">Total Contratado Original</span>
            <span className="block text-lg 2xl:text-xl leading-tight break-all font-bold font-mono tabular-nums text-slate-900">
              {formatBRL(kpis.totalContracted)}
            </span>
            <span className="text-[11px] text-slate-400 block">Principal captado</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 min-w-0 overflow-hidden">
            <span className="text-xs text-slate-500 block">Juros Projetados Acumulados</span>
            <span className="block text-lg 2xl:text-xl leading-tight break-all font-bold font-mono tabular-nums text-sky-700">
              {formatBRL(kpis.totalProjectedInterest)}
            </span>
            <span className="text-[11px] text-slate-400 block">CDI + Spread (252 d.u.)</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1 min-w-0 overflow-hidden">
            <span className="text-xs text-slate-500 block">Próximos Vencimentos</span>
            <span className="block text-lg 2xl:text-xl leading-tight break-all font-bold font-mono tabular-nums text-indigo-700">
              {kpis.upcomingEvents?.length || 0}
            </span>
            <span className="text-[11px] text-slate-400 block">Eventos nos próximos meses</span>
          </div>
        </div>
      )}

      {/* TAB 1: CONTRACTS */}
      {activeTab === 'CONTRACTS' && (
        <div className="space-y-6">
          {/* Contracts List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Contratos de Empréstimo em Andamento</h3>
              <span className="text-xs text-slate-500 font-mono">{contracts.length} contratos</span>
            </div>

            {isAdmin && <div className="px-4 pb-3"><BulkDeleteBar sel={sel} urlFor={(id) => `/api/loans/${id}`} onDone={async () => { setSelectedContract(null); await loadData(); }} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} /></div>}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    {isAdmin && <CheckCell header checked={sel.allChecked} onChange={sel.toggleAll} title="Selecionar todos" />}
                    <th className="py-3 px-4">Contrato</th>
                    <th className="py-3 px-4">Empresa</th>
                    <th className="py-3 px-4">Banco</th>
                    <th className="py-3 px-4 text-right font-mono">Valor Original</th>
                    <th className="py-3 px-4 text-right font-mono">Saldo Devedor Atual</th>
                    <th className="py-3 px-4 text-center">Taxa (Spread)</th>
                    <th className="py-3 px-4 font-mono">Vencimento</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">Carregando contratos...</td>
                    </tr>
                  ) : contracts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">Nenhum contrato cadastrado.</td>
                    </tr>
                  ) : (
                    contracts.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                        {isAdmin && <CheckCell checked={sel.isSelected(c.id)} onChange={() => sel.toggle(c.id)} title="Selecionar" />}
                        <td className="py-3 px-4 font-bold text-slate-900 font-mono">{c.contractNumber}</td>
                        <td className="py-3 px-4 text-slate-800 font-semibold">{c.company?.tradeName || c.companyId}</td>
                        <td className="py-3 px-4 text-slate-600">{c.bank ? `${c.bank.code} - ${c.bank.name}` : c.bankId}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">{formatBRL(c.contractedAmount)}</td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">{formatBRL(c.currentOutstandingBalance)}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-800 font-semibold">
                          CDI + {c.spreadAnnual}% a.a.
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{formatDateBR(c.maturityDate)}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedContract(c)}
                          className="px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-50 rounded transition-colors"
                        >
                          Ver Cronograma →
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </div>
          </div>

          {/* Detailed Contract Events Schedule */}
          {selectedContract && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-900">
                      Cronograma Financeiro — {selectedContract.contractNumber}
                    </span>
                    <span className="bg-sky-50 border border-sky-200 text-sky-800 text-[11px] font-semibold px-2 py-0.5 rounded">
                      CDI + {selectedContract.spreadAnnual}% a.a. (252 d.u.)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Empresa: <strong>{selectedContract.company?.tradeName}</strong> · Saldo Devedor Restante:{' '}
                    <strong className="text-slate-900 font-mono">{formatBRL(selectedContract.currentOutstandingBalance)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedContract(null)}
                  className="text-slate-400 hover:text-slate-700 text-xs font-medium"
                >
                  Fechar detalhes
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3 font-mono">Data Prevista</th>
                      <th className="py-2.5 px-3">Tipo de Evento</th>
                      <th className="py-2.5 px-3 text-right font-mono">Amortização Prevista</th>
                      <th className="py-2.5 px-3 text-right font-mono">Juros Previstos</th>
                      <th className="py-2.5 px-3 text-right font-mono">Saldo Devedor Projetado</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right font-mono">Realizado (Juros / Amort)</th>
                      <th className="py-2.5 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {selectedContract.events?.map((evt) => {
                      const isSettled = evt.status === 'SETTLED';
                      return (
                        <tr key={evt.id} className={isSettled ? 'bg-slate-50/50' : 'hover:bg-slate-50'}>
                          <td className="py-3 px-3 font-bold text-slate-900 whitespace-nowrap">{formatDateBR(evt.plannedDate)}</td>
                        <td className="py-3 px-3 font-sans text-slate-700">
                          {evt.type === 'INTEREST'
                            ? 'Pagamento de Juros'
                            : evt.type === 'AMORTIZATION'
                            ? 'Amortização de Principal'
                            : 'Juros + Amortização'}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-800">
                          {formatBRL(evt.plannedAmortization)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-sky-800 font-semibold">
                          {formatBRL(evt.plannedInterest)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold text-slate-900">
                          {formatBRL(evt.plannedOutstandingBalance)}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isSettled ? (
                            <span className="text-emerald-700 font-semibold inline-flex items-center gap-1 font-sans text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Liquidado
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold inline-flex items-center gap-1 font-sans text-[11px]">
                              <Clock className="w-3.5 h-3.5" /> A Vencer
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums text-slate-700">
                          {isSettled
                            ? `${formatBRL(evt.actualInterest || 0)} / ${formatBRL(evt.actualAmortization || 0)}`
                            : '—'}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleOpenRealizeModal(selectedContract.id, evt)}
                            className="px-2.5 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded shadow-sm hover:bg-slate-50 font-sans"
                          >
                            {isSettled ? 'Ajustar Realizado' : 'Registrar Liquidação'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SIMULATOR */}
      {activeTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Simulator Form */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-sky-600" />
              <h3 className="text-sm font-bold text-slate-900">Configuração da Simulação de Custo</h3>
            </div>
            <p className="text-xs text-slate-500">
              Projete o custo financeiro total selecionando diferentes versões de curva CDI e spreads sem impactar os contratos já contratados.
            </p>

            <form onSubmit={handleRunSimulation} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Nome da Simulação</label>
                <input
                  type="text"
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Empresa Proponente</label>
                  <select
                    value={simCompanyId}
                    onChange={(e) => setSimCompanyId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.tradeName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Banco Cotante</label>
                  <select
                    value={simBankId}
                    onChange={(e) => setSimBankId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Valor do Principal (R$) *</label>
                <input
                  type="text"
                  required
                  value={simAmount}
                  onChange={(e) => setSimAmount(e.target.value)}
                  placeholder="20000000.00"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Spread Anual (% a.a.) *</label>
                  <input
                    type="text"
                    required
                    value={simSpread}
                    onChange={(e) => setSimSpread(e.target.value)}
                    placeholder="1.75"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Versão da Curva CDI</label>
                  <select
                    value={simCdiVersionId}
                    onChange={(e) => setSimCdiVersionId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="default">Curva Vigente (Atualizada)</option>
                    {cdiVersions.map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Data Início</label>
                  <input
                    type="date"
                    value={simStartDate}
                    onChange={(e) => setSimStartDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Data Vencimento</label>
                  <input
                    type="date"
                    value={simMaturityDate}
                    onChange={(e) => setSimMaturityDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={simulating}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
              >
                <Calculator className="w-4 h-4" />
                <span>{simulating ? 'Calculando Juros Compostos...' : 'Calcular Simulação'}</span>
              </button>
            </form>
          </div>

          {/* Simulator Result */}
          <div className="space-y-4">
            {simResult ? (
              <div className="bg-white p-6 rounded-xl border border-sky-300 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-bold text-sky-950 uppercase tracking-wider">Resultado da Simulação</span>
                  <span className="text-xs font-mono text-slate-500">{simResult.name}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-lg min-w-0">
                    <span className="text-xs text-slate-500 block">Principal Financiado</span>
                    <span className="block text-base leading-tight break-all font-bold font-mono tabular-nums text-slate-900">
                      {formatBRL(simResult.principalAmount)}
                    </span>
                  </div>

                  <div className="p-3 bg-sky-50 rounded-lg min-w-0">
                    <span className="text-xs text-sky-800 block">Juros Totais Projetados</span>
                    <span className="block text-base leading-tight break-all font-bold font-mono tabular-nums text-sky-900">
                      {formatBRL(simResult.totalProjectedInterest)}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold">Custo Total da Operação (Principal + Juros):</span>
                  <span className="text-lg font-bold break-all font-mono tabular-nums">{formatBRL(simResult.totalCost)}</span>
                </div>

                {/* Event Schedule preview */}
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Cronograma de Eventos Projetado</div>
                  <table className="w-full text-left text-xs font-mono text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Data</th>
                        <th className="py-2 px-3 text-right">Amortização</th>
                        <th className="py-2 px-3 text-right">Juros Previstos</th>
                        <th className="py-2 px-3 text-right">Saldo Devedor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {simResult.events?.map((e: any, i: number) => (
                        <tr key={i}>
                          <td className="py-2 px-3 font-semibold text-slate-800 whitespace-nowrap">{formatDateBR(e.plannedDate)}</td>
                          <td className="py-2 px-3 text-right tabular-nums">{formatBRL(e.plannedAmortization)}</td>
                          <td className="py-2 px-3 text-right tabular-nums text-sky-700 font-bold">{formatBRL(e.plannedInterest)}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-bold text-slate-900">{formatBRL(e.plannedOutstandingBalance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-12 rounded-xl border border-dashed border-slate-300 text-center text-slate-500 text-xs">
                Preencha os parâmetros e clique em <strong>Calcular Simulação</strong> para visualizar o custo financeiro detalhado e o cronograma projetado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contract Creation Modal */}
      {isContractFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Cadastrar Contrato de Empréstimo</h3>
              <button onClick={() => setIsContractFormOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateContract} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Número do Contrato *</label>
                  <input
                    type="text"
                    required
                    value={contractNumber}
                    onChange={(e) => setContractNumber(e.target.value)}
                    placeholder="ELO-FIN-2026-001"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Valor Contratado (R$) *</label>
                  <input
                    type="text"
                    required
                    value={contractedAmount}
                    onChange={(e) => setContractedAmount(e.target.value)}
                    placeholder="10000000.00"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Empresa Contratante *</label>
                  <select
                    value={companyId}
                    onChange={(e) => setCompanyId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.tradeName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Banco Concessor *</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.code} - {b.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Data Início *</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Vencimento Final *</label>
                  <input
                    type="date"
                    required
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Spread (% a.a.) *</label>
                  <input
                    type="text"
                    required
                    value={spreadAnnual}
                    onChange={(e) => setSpreadAnnual(e.target.value)}
                    placeholder="1.50"
                    className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Event rows */}
              <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Cronograma de Eventos Financeiros</span>
                  <button
                    type="button"
                    onClick={handleAddEventRow}
                    className="text-xs font-semibold text-sky-700 hover:text-sky-800"
                  >
                    + Adicionar Evento
                  </button>
                </div>

                <div className="space-y-2">
                  {eventsList.map((evt, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-lg text-xs font-mono">
                      <input
                        type="date"
                        value={evt.plannedDate}
                        onChange={(e) => {
                          const updated = [...eventsList];
                          updated[idx].plannedDate = e.target.value;
                          setEventsList(updated);
                        }}
                        className="px-2 py-1 border border-slate-300 rounded"
                      />
                      <select
                        value={evt.type}
                        onChange={(e: any) => {
                          const updated = [...eventsList];
                          updated[idx].type = e.target.value;
                          setEventsList(updated);
                        }}
                        className="px-2 py-1 border border-slate-300 rounded font-sans text-xs"
                      >
                        <option value="INTEREST">Pagamento Juros</option>
                        <option value="AMORTIZATION">Amortização Principal</option>
                        <option value="INTEREST_AND_AMORTIZATION">Juros + Amortização</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Amortização R$"
                        value={evt.plannedAmortization}
                        onChange={(e) => {
                          const updated = [...eventsList];
                          updated[idx].plannedAmortization = e.target.value;
                          setEventsList(updated);
                        }}
                        className="px-2 py-1 border border-slate-300 rounded w-28 text-right"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveEventRow(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsContractFormOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Gravar Contrato e Gerar Cronograma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Realized Settlement Modal */}
      {isRealizeModalOpen && targetEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">Registrar Liquidação Realizada</h3>
              <button onClick={() => setIsRealizeModalOpen(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmRealize} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Data Efetiva da Liquidação *</label>
                <input
                  type="date"
                  required
                  value={actualDate}
                  onChange={(e) => setActualDate(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Juros Efetivamente Pagos (R$)</label>
                <input
                  type="text"
                  required
                  value={actualInterest}
                  onChange={(e) => setActualInterest(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Valor Efetivamente Amortizado (R$)</label>
                <input
                  type="text"
                  required
                  value={actualAmortization}
                  onChange={(e) => setActualAmortization(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Observações da Liquidação</label>
                <textarea
                  rows={2}
                  value={realizeNotes}
                  onChange={(e) => setRealizeNotes(e.target.value)}
                  placeholder="Ex: Débito em conta corrente efetuado conforme extrato"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRealizeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  Confirmar Realizado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
