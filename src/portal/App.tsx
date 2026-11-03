// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { SetupAdminView } from './components/auth/SetupAdminView';
import { LoginView } from './components/auth/LoginView';

// Modules
import { DashboardModule } from './components/modules/DashboardModule';
import { CompaniesModule } from './components/modules/CompaniesModule';
import { AccountsModule } from './components/modules/AccountsModule';
import { AgreementsModule } from './components/modules/AgreementsModule';
import { AccessesModule } from './components/modules/AccessesModule';
import { IndicatorsModule } from './components/modules/IndicatorsModule';
import { CashProjectionModule } from './components/modules/CashProjectionModule';
import { TecbanModule } from './components/modules/TecbanModule';
import { LoansModule } from './components/modules/LoansModule';
import { HolidaysModule } from './components/modules/HolidaysModule';
import { SpreadsheetsCentralModule } from './components/modules/SpreadsheetsCentralModule';
import { BackupsModule } from './components/modules/BackupsModule';
import { AuditModule } from './components/modules/AuditModule';
import { UsersModule } from './components/modules/UsersModule';
import { DocumentationModule } from './components/modules/DocumentationModule';
import { TreasuryRegistryModule } from './components/modules/TreasuryRegistryModule';
import { ApprovalsModule } from './components/modules/ApprovalsModule';
import { RefreshCw } from 'lucide-react';
import { canAccessModule } from './utils/access';

const MODULE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard Geral',
  companies: 'Gestão das Empresas & Diretores',
  current_accounts: 'Contas Correntes',
  agreements: 'Convênios Bancários',
  accesses: 'Acessos Bancários',
  indicators: 'Indicadores & Cotas',
  cash_projections: 'Projeção de Caixa',
  tecban: 'Controle Tecban',
  loans: 'Empréstimos & Simulações',
  holidays: 'Calendário Financeiro',
  spreadsheets: 'Central de Planilhas',
  backups: 'Backups & Recuperação',
  audit: 'Auditoria Global',
  users: 'Gestão de Usuários',
  docs: 'Manuais & Implantação',
  tariffs: 'Mapa de Tarifas', judicial_blocks: 'Bloqueios Judiciais', bank_contacts: 'Contatos Bancários', powers: 'Procurações e Procuradores', contracts: 'Contratos', policies: 'Políticas e Normativos', manuals: 'Manuais e Fluxos', accounting_routes: 'Roteiro Contábil', activity_divisions: 'Divisão de Atividades', dividends_jcp: 'Dividendos / JCP', approvals: 'Aprovações'
};

const MainLayout: React.FC = () => {
  const { isAuthenticated, isSetupRequired, isLoading, user } = useAuth();
  const [currentModule, setCurrentModule] = useState(() => {
    // Preserva a tela ativa em caso de recarregamento/remontagem da aplicação.
    const saved = localStorage.getItem('elo_treasury_current_module');
    return saved || 'dashboard';
  });
  React.useEffect(() => {
    localStorage.setItem('elo_treasury_current_module', currentModule);
  }, [currentModule]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="portal-ui min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
          <span className="text-sm font-semibold tracking-wide">Iniciando Portal Tesouraria...</span>
        </div>
      </div>
    );
  }

  if (isSetupRequired) {
    return <SetupAdminView />;
  }

  if (!isAuthenticated) {
    return <LoginView />;
  }

  const renderModule = () => {
    if (!canAccessModule(currentModule, user)) return <DashboardModule onNavigate={setCurrentModule} />;
    switch (currentModule) {
      case 'dashboard':
        return <DashboardModule onNavigate={setCurrentModule} />;
      case 'companies':
        return <CompaniesModule />;
      case 'current_accounts':
        return <AccountsModule />;
      case 'agreements':
        return <AgreementsModule />;
      case 'accesses':
        return <AccessesModule />;
      case 'indicators':
        return <IndicatorsModule />;
      case 'cash_projections':
        return <CashProjectionModule />;
      case 'tecban':
        return <TecbanModule />;
      case 'loans':
        return <LoansModule />;
      case 'holidays':
        return <HolidaysModule />;
      case 'spreadsheets':
        return <SpreadsheetsCentralModule />;
      case 'backups':
        return <BackupsModule />;
      case 'audit':
        return <AuditModule />;
      case 'users':
        return <UsersModule />;
      case 'docs':
        return <DocumentationModule />;
      case 'tariffs': case 'judicial_blocks': case 'bank_contacts': case 'powers': case 'contracts': case 'policies': case 'manuals': case 'accounting_routes': case 'activity_divisions': case 'dividends_jcp':
        return <TreasuryRegistryModule module={currentModule} />;
      case 'approvals':
        return <ApprovalsModule />;
      default:
        return <DashboardModule onNavigate={setCurrentModule} />;
    }
  };

  return (
    <div className="portal-ui flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Lateral Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Header */}
        <TopBar
          currentModuleTitle={MODULE_TITLES[currentModule] || 'Portal Tesouraria'}
          onSelectModule={setCurrentModule}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        />

        {/* Viewport content */}
        <main className="portal-main flex-1 overflow-y-auto">
          <div key={currentModule} className="portal-enter">{renderModule()}</div>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainLayout />
      </ToastProvider>
    </AuthProvider>
  );
}
