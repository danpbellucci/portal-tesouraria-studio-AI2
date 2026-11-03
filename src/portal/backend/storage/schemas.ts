// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import path from '../shims/path';

const getBaseDir = () => {
  if (typeof process !== 'undefined' && typeof process.cwd === 'function') {
    return process.cwd();
  }
  return '';
};

export const DATA_DIR = path.join(getBaseDir(), 'data');
export const IMPORTS_DIR = path.join(getBaseDir(), 'imports');
export const BACKUPS_DIR = path.join(getBaseDir(), 'backups');
export const EXPORTS_DIR = path.join(getBaseDir(), 'exports');
export const LOGS_DIR = path.join(getBaseDir(), 'logs');

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionFile<T extends BaseRecord = BaseRecord> {
  schemaVersion: number;
  collectionName: string;
  updatedAt: string;
  records: T[];
}

export interface Company extends BaseRecord {
  tradeName: string; // Nome Fantasia
  legalName: string; // Razão Social
  cnpj: string;      // CNPJ (formatado e único)
  state?: string;    // UF para calendário
  city?: string;     // Município para calendário
  active: boolean;
}

export interface Director extends BaseRecord {
  name: string;      // Nome do Diretor Estatutário
  active: boolean;
}

export interface CompanyDirector extends BaseRecord {
  companyId: string;
  directorId: string;
  startDate?: string;
  active: boolean;
}

export interface Bank extends BaseRecord {
  code: string; // Código FEBRABAN (ex: '001', '237', '341')
  name: string; // Nome do Banco
}

export interface CurrentAccount extends BaseRecord {
  companyId: string;
  bankId: string;
  agency: string;             // Preserva zeros à esquerda
  accountNumber: string;      // Preserva zeros à esquerda e dígito
  hasIntradayLimit: boolean;  // Possui limite Intraday (Sim/Não)
  intradayLimitAmount?: string; // Valor do limite em R$ (decimal como string)
  hasAutoInvestment: boolean; // Possui aplicação automática (Sim/Não)
  hasSweeping: boolean;       // Possui tombamento (Sim/Não)
  sweepingDestinationAccount?: string; // Conta que recebe os recursos do tombamento
  active: boolean;
  notes?: string;
}

export interface BankAgreement extends BaseRecord {
  bankId: string;
  companyId: string;
  agreementType: 'PAGFOR' | 'COBRANCA' | 'OUTROS';
  currentAccountId?: string;   // Conta corrente vinculada ao convênio
  agreementCode: string;      // Código (preserva zeros e caracteres especiais)
  managerName: string;        // Gestor do convênio
  active: boolean;
  notes?: string;
}

export interface BankAccess extends BaseRecord {
  companyId: string;
  bankId: string;
  accessProfile: string;      // Perfil de acesso (livre)
  userName: string;           // Nome do usuário com acesso bancário
  managerName: string;        // Gestor do usuário
  active: boolean;
  notes?: string;
}

export interface FinancialHoliday extends BaseRecord {
  date: string;               // ISO YYYY-MM-DD
  description: string;
  type: 'NATIONAL_BANKING' | 'STATE' | 'MUNICIPAL';
  state?: string;             // Para feriados estaduais
  city?: string;              // Para feriados municipais
  companyId?: string;         // Se aplicável a empresa específica
  source: string;             // FEBRABAN, Lei Estadual/Municipal, etc.
}

export interface IndicatorRecord extends BaseRecord {
  date: string;               // ISO YYYY-MM-DD
  cdiRealizedAnnual: string;  // % a.a. exato em string decimal (ex: "10.65")
  cdiProjectedAnnual: string; // % a.a. exato em string decimal (ex: "10.50")
  quotaBarauna: string;       // Valor da cota
  quotaCarnauba: string;
  quotaJacaranda: string;
  quotaCaliandra: string;
  quotaBBCorporateFacil: string;
  versionId: string;
}

export interface IndicatorVersion extends BaseRecord {
  versionNumber: number;
  label: string;
  importedBy: string;
  fileName?: string;
  recordCount: number;
  validations: string[];
  notes?: string;
  isCurrent: boolean;
}

export interface CashProjection extends BaseRecord {
  companyId: string;
  date: string;               // ISO YYYY-MM-DD
  actualBalance: string;      // Saldo Real em R$
  actualInflow: string;       // Entradas Reais em R$
  actualOutflow: string;      // Saídas Reais em R$
  projectedBalance: string;   // Saldo Projetado em R$ (NUNCA recalculado automaticamente)
  projectedInflow: string;    // Entrada Projetada em R$
  projectedOutflow: string;   // Saída Projetada em R$
  versionId?: string;
}

export interface TecbanRecord extends BaseRecord {
  date: string;               // ISO YYYY-MM-DD
  actualBalance: string;      // Saldo Real em R$
  actualWithdrawals: string;  // Saques Reais em R$
  actualReloads: string;      // Recargas Reais em R$
  projectedBalance: string;   // Saldo Projetado em R$
  projectedWithdrawals: string; // Saque Projetado em R$
  projectedReloads: string;   // Recarga Projetada em R$
  versionId?: string;
}

export type LoanEventType = 'INTEREST' | 'AMORTIZATION' | 'INTEREST_AND_AMORTIZATION';

export interface LoanEvent {
  id: string;
  plannedDate: string;        // YYYY-MM-DD
  type: LoanEventType;
  plannedAmortization: string; // R$ string
  plannedInterest: string;    // R$ string calculada via CDI curve + spread
  plannedOutstandingBalance: string;
  // Realizado:
  actualDate?: string;
  actualInterest?: string;
  actualAmortization?: string;
  status: 'PENDING' | 'SETTLED' | 'CANCELLED';
  notes?: string;
}

export interface LoanContract extends BaseRecord {
  contractNumber: string;
  companyId: string;
  bankId: string;
  startDate: string;          // YYYY-MM-DD
  maturityDate: string;       // YYYY-MM-DD
  contractedAmount: string;   // R$
  spreadAnnual: string;       // % a.a. ex: "1.85"
  indexer: 'CDI';
  cdiVersionId: string;       // Versão da curva CDI associada
  dayCountConvention: 'BUS_252';
  currentOutstandingBalance: string;
  events: LoanEvent[];
  active: boolean;
  notes?: string;
}

export interface LoanSimulation extends BaseRecord {
  name: string;
  contractId?: string;
  companyId: string;
  bankId: string;
  startDate: string;
  maturityDate: string;
  principalAmount: string;
  spreadAnnual: string;
  cdiVersionId: string;
  totalProjectedInterest: string;
  totalCost: string;
  events: LoanEvent[];
  createdAtUser: string;
}

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'import' | 'export' | 'admin';

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
  | 'tariffs' | 'judicial_blocks' | 'bank_contacts' | 'powers' | 'procurators' | 'contracts' | 'policies' | 'manuals' | 'accounting_routes' | 'activity_divisions' | 'dividends_jcp' | 'approvals';

export interface UserRole extends BaseRecord {
  name: string;
  description: string;
  isSystemAdmin?: boolean;
  permissions: Record<SystemModule, PermissionAction[]>;
}

export interface UserAccount extends BaseRecord {
  email: string;
  name: string;
  passwordHash?: string;
  salt?: string;
  roleId: string;
  status: 'ACTIVE' | 'PENDING_ACTIVATION' | 'BLOCKED';
  activationCode?: string;
  activationCodeExpiresAt?: string;
  failedLoginAttempts: number;
  lockedUntil?: string;
  lastLoginAt?: string;
  lastLoginIp?: string;
}

export interface ImportVersion extends BaseRecord {
  module: SystemModule;
  fileName: string;
  savedFilePath?: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  insertedCount: number;
  updatedCount: number;
  rejectedCount: number;
  validationErrors: string[];
  snapshotSummary: string;
  dataSnapshot?: any[];
}

export interface AuditLog extends BaseRecord {
  timestamp: string;
  userId: string;
  userEmail: string;
  module: SystemModule | 'auth' | 'system';
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT' | 'RESTORE' | 'BACKUP' | 'LOGIN' | 'LOGOUT' | 'PASSWORD_RESET' | 'ACTIVATE';
  recordId?: string;
  summary: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
}
