import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  TrendingUp,
  CheckCircle2,
  CreditCard,
  Landmark,
  FileSpreadsheet,
  Building2,
  LineChart,
  ChevronDown,
  ExternalLink,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

interface QuickActionsMenuProps {
  onSelectModule?: (moduleId: string) => void;
}

interface ActionItem {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const PRIMARY_ACTIONS: ActionItem[] = [
  {
    id: 'cash_projections',
    label: 'Projeção de Caixa',
    description: 'Entradas, saídas e saldo diário consolidado',
    icon: TrendingUp,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50 hover:bg-emerald-100/70',
  },
  {
    id: 'approvals',
    label: 'Aprovações',
    description: 'Aprovar ou solicitar pagamentos e aplicações',
    icon: CheckCircle2,
    color: 'text-sky-700',
    bgColor: 'bg-sky-50 hover:bg-sky-100/70',
  },
  {
    id: 'tecban',
    label: 'Controle Tecban',
    description: 'Acompanhamento de saques, recargas e caixas',
    icon: CreditCard,
    color: 'text-indigo-700',
    bgColor: 'bg-indigo-50 hover:bg-indigo-100/70',
  },
  {
    id: 'loans',
    label: 'Empréstimos & Simulações',
    description: 'Cálculo de juros CDI + spread e amortizações',
    icon: Landmark,
    color: 'text-violet-700',
    bgColor: 'bg-violet-50 hover:bg-violet-100/70',
  },
  {
    id: 'spreadsheets',
    label: 'Central de Planilhas',
    description: 'Importações em lote e modelos padronizados',
    icon: FileSpreadsheet,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50 hover:bg-amber-100/70',
  },
  {
    id: 'indicators',
    label: 'Indicadores & Cotas',
    description: 'Séries do CDI a.a. e rentabilidade de fundos',
    icon: LineChart,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50 hover:bg-blue-100/70',
  },
  {
    id: 'current_accounts',
    label: 'Contas Correntes',
    description: 'Saldos, limites intraday e tombamentos',
    icon: Building2,
    color: 'text-slate-700',
    bgColor: 'bg-slate-100 hover:bg-slate-200/70',
  },
];

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ onSelectModule }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (moduleId: string) => {
    setIsOpen(false);
    if (onSelectModule) {
      onSelectModule(moduleId);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-2 h-9 px-3.5 text-xs font-semibold rounded-lg transition-all duration-150 border ${
          isOpen
            ? 'bg-[#0F2744] text-white border-[#0F2744] shadow-sm'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900 shadow-sm'
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Acesso rápido aos módulos mais utilizados"
      >
        <Zap className={`w-3.5 h-3.5 ${isOpen ? 'text-amber-300' : 'text-amber-500'}`} />
        <span className="whitespace-nowrap">Ações Rápidas</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-150 ${
            isOpen ? 'rotate-180 text-white' : 'text-slate-400'
          }`}
        />
      </button>

      {/* Dropdown Menu Panel */}
      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white border border-slate-200 shadow-xl z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150"
          role="menu"
          aria-orientation="vertical"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-slate-50/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Módulos Frequentes
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Navegação direta</span>
            </div>
          </div>

          {/* Module Action Items */}
          <div className="p-1.5 space-y-0.5 max-h-[360px] overflow-y-auto">
            {PRIMARY_ACTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className="w-full flex items-start gap-3 p-2.5 rounded-lg text-left hover:bg-slate-50 transition-colors group cursor-pointer"
                  role="menuitem"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${item.bgColor} ${item.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-[#0F2744] flex items-center justify-between">
                      <span>{item.label}</span>
                      <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-slate-600 transition-transform group-hover:translate-x-0.5" />
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Bank Links Footer */}
          <div className="p-2.5 bg-slate-50/80 space-y-1">
            <div className="px-2 pt-1 pb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Internet Banking Corporativo
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <a
                href="https://autoatendimento.bb.com.br/apf-apj-acesso/index.html?origemLogin=bbdigital"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-900 transition-all shadow-xs"
              >
                <span className="truncate">BB Digital PJ</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
              </a>
              <a
                href="https://www.ne12.bradesconetempresa.b.br/ibpjlogin/login.jsf"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium text-slate-700 bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50/50 hover:text-red-900 transition-all shadow-xs"
              >
                <span className="truncate">Bradesco Net</span>
                <ExternalLink className="w-3 h-3 text-slate-400 shrink-0 ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
