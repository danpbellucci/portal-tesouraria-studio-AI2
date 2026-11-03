// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState } from 'react';
import { RefreshCw, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ApiClient } from '../../services/api';
import { useToast } from '../common/Toast';
import { QuickActionsMenu } from './QuickActionsMenu';

interface TopBarProps {
  currentModuleTitle: string;
  onRefreshIndicators?: () => void;
  onToggleMobileMenu?: () => void;
  onSelectModule?: (moduleId: string) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentModuleTitle,
  onRefreshIndicators,
  onToggleMobileMenu,
  onSelectModule
}) => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);

  const handleSyncBCB = async () => {
    setSyncing(true);
    try {
      const res = await ApiClient.request('/api/indicators/sync-official', { method: 'POST' });
      showToast(res.message, res.success ? 'success' : 'warning');
      if (onRefreshIndicators) onRefreshIndicators();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 md:px-8 flex items-center justify-between gap-4 shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-3 min-w-0">
        {onToggleMobileMenu && (
          <button onClick={onToggleMobileMenu} className="md:hidden p-1.5 -ml-1 text-slate-600 rounded-lg hover:bg-slate-100" title="Abrir menu de navegação">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-slate-400 leading-none mb-1 hidden sm:block">Portal Tesouraria</div>
          <h1 className="text-[15px] font-semibold tracking-tight text-slate-900 truncate leading-none">{currentModuleTitle}</h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Quick Actions Dropdown Menu */}
        <QuickActionsMenu onSelectModule={onSelectModule} />

        {/* Sync BCB Indicators */}
        <button
          onClick={handleSyncBCB}
          disabled={syncing}
          className="hidden md:inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-colors shadow-xs"
          title="Sincronizar indicadores oficiais com o Banco Central"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${syncing ? 'animate-spin text-sky-600' : ''}`} />
          <span>Sincronizar BCB</span>
        </button>

        {user && (
          <span className="hidden sm:inline-flex h-9 items-center px-3 text-[11px] font-medium text-slate-600 bg-slate-100 rounded-lg">
            {user.isSystemAdmin ? 'Administrador' : 'Analista'}
          </span>
        )}

        <button
          onClick={logout}
          className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-100 transition-colors"
          title="Encerrar sessão de trabalho"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
};
