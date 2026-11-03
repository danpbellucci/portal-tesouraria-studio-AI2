// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
export type SystemModule = 
  | 'companies'
  | 'current_accounts'
  | 'agreements'
  | 'accesses'
  | 'indicators'
  | 'cash_projections'
  | 'tecban'
  | 'loans'
  | 'holidays'
  | 'users'
  | 'backups'
  | 'audit'
  | 'tariffs' | 'judicial_blocks' | 'bank_contacts' | 'powers' | 'procurators' | 'contracts' | 'policies' | 'manuals' | 'accounting_routes' | 'activity_divisions' | 'dividends_jcp';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'import' | 'export' | 'admin';

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  roleId: string;
  isSystemAdmin: boolean;
  permissions: Record<string, PermissionAction[]>;
}

export interface Company {
  id: string;
  tradeName: string;
  legalName: string;
  cnpj: string;
  state?: string;
  city?: string;
  active: boolean;
  directors?: Director[];
  createdAt: string;
  updatedAt: string;
}

export interface Director {
  id: string;
  name: string;
  active: boolean;
}

export interface Bank {
  id: string;
  code: string;
  name: string;
}

export interface CurrentAccount {
  id: string;
  companyId: string;
  bankId: string;
  agency: string;
  accountNumber: string;
  hasIntradayLimit: boolean;
  intradayLimitAmount?: string;
  hasAutoInvestment: boolean;
  hasSweeping: boolean;
  sweepingDestinationAccount?: string;
  active: boolean;
  notes?: string;
  company?: Company;
  bank?: Bank;
  createdAt: string;
  updatedAt: string;
}

export interface BankAgreement {
  id: string;
  bankId: string;
  companyId: string;
  agreementType: 'PAGFOR' | 'COBRANCA' | 'OUTROS';
  currentAccountId?: string;
  currentAccount?: CurrentAccount;
  agreementCode: string;
  managerName: string;
  active: boolean;
  notes?: string;
  company?: Company;
  bank?: Bank;
  createdAt: string;
  updatedAt: string;
}

export interface BankAccess {
  id: string;
  companyId: string;
  bankId: string;
  accessProfile: string;
  userName: string;
  managerName: string;
  active: boolean;
  notes?: string;
  company?: Company;
  bank?: Bank;
  createdAt: string;
  updatedAt: string;
}

export interface IndicatorRecord {
  id: string;
  date: string;
  cdiRealizedAnnual: string;
  cdiProjectedAnnual: string;
  quotaBarauna: string;
  quotaCarnauba: string;
  quotaJacaranda: string;
  quotaCaliandra: string;
  quotaBBCorporateFacil: string;
  versionId: string;
}

export interface IndicatorVersion {
  id: string;
  versionNumber: number;
  label: string;
  importedBy: string;
  fileName?: string;
  recordCount: number;
  validations: string[];
  notes?: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface CashProjection {
  id: string;
  companyId: string;
  date: string;
  actualBalance: string;
  actualInflow: string;
  actualOutflow: string;
  projectedBalance: string;
  projectedInflow: string;
  projectedOutflow: string;
  company?: Company;
  variance?: {
    diffBalance: string;
    diffBalancePercent: string;
    diffInflow: string;
    diffOutflow: string;
  };
}

export interface TecbanRecord {
  id: string;
  date: string;
  actualBalance: string;
  actualWithdrawals: string;
  actualReloads: string;
  projectedBalance: string;
  projectedWithdrawals: string;
  projectedReloads: string;
  variance?: {
    diffBalance: string;
    diffBalancePercent: string;
    diffWithdrawals: string;
    diffWithdrawalsPercent: string;
    diffReloads: string;
    diffReloadsPercent: string;
  };
}

export interface LoanEvent {
  id: string;
  plannedDate: string;
  type: 'INTEREST' | 'AMORTIZATION' | 'INTEREST_AND_AMORTIZATION';
  plannedAmortization: string;
  plannedInterest: string;
  plannedOutstandingBalance: string;
  actualDate?: string;
  actualInterest?: string;
  actualAmortization?: string;
  status: 'PENDING' | 'SETTLED' | 'CANCELLED';
  notes?: string;
}

export interface LoanContract {
  id: string;
  contractNumber: string;
  companyId: string;
  bankId: string;
  startDate: string;
  maturityDate: string;
  contractedAmount: string;
  spreadAnnual: string;
  indexer: 'CDI';
  cdiVersionId: string;
  dayCountConvention: 'BUS_252';
  currentOutstandingBalance: string;
  events: LoanEvent[];
  active: boolean;
  notes?: string;
  company?: Company;
  bank?: Bank;
}

export interface FinancialHoliday {
  id: string;
  date: string;
  description: string;
  type: 'NATIONAL_BANKING' | 'STATE' | 'MUNICIPAL';
  state?: string;
  city?: string;
  companyId?: string;
  source: string;
}

export interface ImportVersion {
  id: string;
  module: SystemModule;
  fileName: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  validationErrors: string[];
  snapshotSummary: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userEmail: string;
  module: string;
  action: string;
  recordId?: string;
  summary: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
}

export interface EconomicSummary {
  selicOver: {
    value: string;
    date: string;
    source: string;
    updatedAt: string;
    status: 'ONLINE' | 'PENDING';
    history12m: Array<{ date: string; value: number }>;
  };
  ptaxVenda: {
    value: string;
    date: string;
    source: string;
    updatedAt: string;
    status: 'ONLINE' | 'PENDING';
    history12m: Array<{ date: string; value: number }>;
  };
  ipcaMonthly: {
    value: string;
    date: string;
    source: string;
    updatedAt: string;
    status: 'ONLINE' | 'PENDING';
    history12m: Array<{ date: string; value: number }>;
  };
  ipca12m: {
    value: string;
    date: string;
    source: string;
    updatedAt: string;
    status: 'ONLINE' | 'PENDING';
  };
  lastSyncAttempt: string;
  lastSuccessfulSync?: string;
}
