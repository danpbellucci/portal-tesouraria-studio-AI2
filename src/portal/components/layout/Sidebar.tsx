// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { canAccessModule } from '../../utils/access';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Handshake,
  KeyRound,
  TrendingUp,
  DollarSign,
  Cpu,
  FileText,
  CalendarDays,
  FileSpreadsheet,
  ShieldCheck,
  ClipboardList,
  Users,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Gavel,
  Phone,
  FileSignature,
  ScrollText,
  BookMarked,
  Calculator,
  ListChecks,
  Wallet,
  CheckSquare,
  Search,
  ChevronDown,
  X
} from 'lucide-react';

interface SidebarProps {
  currentModule: string;
  onSelectModule: (module: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onSelectModule,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile
}) => {
  const { user } = useAuth();
  const allSections = [
    {
      group: 'Visão Geral',
      items: [
        { id: 'dashboard', label: 'Dashboard Geral', icon: LayoutDashboard }
      ]
    },
    {
      group: 'Cadastros Bancários',
      items: [
        { id: 'companies', label: 'Empresas & Diretores', icon: Building2 },
        { id: 'current_accounts', label: 'Contas Correntes', icon: CreditCard },
        { id: 'agreements', label: 'Convênios Bancários', icon: Handshake },
        { id: 'accesses', label: 'Acessos Bancários', icon: KeyRound },
        { id: 'tariffs', label: 'Mapa de Tarifas', icon: Receipt },
        { id: 'bank_contacts', label: 'Contatos Bancários', icon: Phone }
      ]
    },
    {
      group: 'Operações de Caixa',
      items: [
        { id: 'cash_projections', label: 'Projeção de Caixa', icon: DollarSign },
        { id: 'tecban', label: 'Controle Tecban', icon: Cpu },
        { id: 'approvals', label: 'Aprovações', icon: CheckSquare },
        { id: 'dividends_jcp', label: 'Dividendos / JCP', icon: Wallet }
      ]
    },
    {
      group: 'Mercado & Finanças',
      items: [
        { id: 'indicators', label: 'Indicadores & Cotas', icon: TrendingUp },
        { id: 'loans', label: 'Empréstimos & Simulações', icon: FileText },
        { id: 'holidays', label: 'Calendário Financeiro', icon: CalendarDays }
      ]
    },
    {
      group: 'Jurídico & Contratos',
      items: [
        { id: 'judicial_blocks', label: 'Bloqueios Judiciais', icon: Gavel },
        { id: 'contracts', label: 'Contratos', icon: ScrollText },
        { id: 'powers', label: 'Procurações e Procuradores', icon: FileSignature }
      ]
    },
    {
      group: 'Documentos & Processos',
      items: [
        { id: 'policies', label: 'Políticas e Normativos', icon: BookMarked },
        { id: 'manuals', label: 'Manuais e Fluxos', icon: BookOpen },
        { id: 'accounting_routes', label: 'Roteiro Contábil', icon: Calculator },
        { id: 'activity_divisions', label: 'Divisão de Atividades', icon: ListChecks },
        { id: 'spreadsheets', label: 'Central de Planilhas', icon: FileSpreadsheet }
      ]
    },
    {
      group: 'Administração',
      items: [
        { id: 'users', label: 'Gestão de Usuários', icon: Users },
        { id: 'audit', label: 'Auditoria Global', icon: ClipboardList },
        { id: 'backups', label: 'Backups & Recuperação', icon: ShieldCheck },
        { id: 'docs', label: 'Manuais & Implantação', icon: BookOpen }
      ]
    }
  ];
  const navSections = allSections
    .map((s) => ({ ...s, items: s.items.filter((i) => canAccessModule(i.id, user)) }))
    .filter((s) => s.items.length);

  const [query, setQuery] = useState('');
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const expanded = !isCollapsed || isMobileOpen;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return navSections;
    return navSections
      .map((s) => ({ ...s, items: s.items.filter((i) => i.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q)) }))
      .filter((s) => s.items.length);
  }, [query, navSections]);
  const initials = (user?.name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const select = (id: string) => {
    onSelectModule(id);
    setQuery('');
    if (onCloseMobile) onCloseMobile();
  };

  return (
    <>
      {isMobileOpen && (
        <div onClick={onCloseMobile} className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 md:hidden" />
      )}

      <aside
        className={`portal-sidebar bg-slate-950 text-slate-300 flex flex-col transition-[width,transform] duration-300 select-none shrink-0 fixed md:static inset-y-0 left-0 z-50 bg-[linear-gradient(180deg,oklch(0.2_0.045_258),oklch(0.15_0.04_258))] ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'md:w-[72px] w-72' : 'w-72'}`}
      >
        {/* Brand */}
        <div className={`h-16 flex items-center gap-3 shrink-0 ${expanded ? 'px-5' : 'justify-center'}`}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-700 flex items-center justify-center text-white text-[13px] font-bold tracking-tight shadow-[0_6px_20px_-6px_oklch(0.56_0.17_262/0.8)] shrink-0">
            EP
          </div>
          {expanded && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-[13px] font-semibold tracking-tight text-white truncate">Tesouraria EloPar</span>
              <span className="text-[11px] text-slate-400 truncate">Elo Participações</span>
            </div>
          )}
          {isMobileOpen && (
            <button onClick={onCloseMobile} className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5" title="Fechar menu">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search */}
        {expanded && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && filtered[0]?.items[0]) select(filtered[0].items[0].id); }}
                placeholder="Buscar módulo…"
                className="!bg-white/5 !border-white/10 focus:!border-sky-400/60 !text-slate-100 placeholder:text-slate-500 w-full text-xs pl-8 pr-3 py-2 rounded-lg border"
              />
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
          {filtered.length === 0 && expanded && (
            <p className="px-3 py-6 text-xs text-slate-500 text-center">Nenhum módulo encontrado.</p>
          )}
          {filtered.map((section) => {
            const hasActive = section.items.some((i) => i.id === currentModule);
            const isClosed = !query && !hasActive && closed[section.group];
            return (
              <div key={section.group}>
                {expanded ? (
                  <button
                    onClick={() => setClosed((c) => ({ ...c, [section.group]: !c[section.group] }))}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300"
                  >
                    <span>{section.group}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isClosed ? '-rotate-90' : ''}`} />
                  </button>
                ) : (
                  <div className="mx-auto my-2 h-px w-6 bg-white/10" />
                )}
                {!isClosed && (
                  <div className="space-y-0.5 mt-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentModule === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => select(item.id)}
                          title={!expanded ? item.label : undefined}
                          className={`group relative w-full flex items-center gap-3 rounded-lg text-[13px] text-left ${expanded ? 'px-3 py-2' : 'justify-center py-2.5'} ${
                            isActive ? 'bg-white/10 text-white font-medium' : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'
                          }`}
                        >
                          {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-sky-400" />}
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-300' : 'text-slate-500 group-hover:text-slate-300'}`} strokeWidth={1.75} />
                          {expanded && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-white/5 shrink-0">
          <div className={`flex items-center gap-3 ${expanded ? '' : 'flex-col'}`}>
            <div className="w-8 h-8 rounded-full bg-white/10 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">{initials}</div>
            {expanded && (
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-slate-100 truncate">{user?.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
              </div>
            )}
            <button
              onClick={onToggleCollapse}
              className="hidden md:inline-flex p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5"
              title={isCollapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'}
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
