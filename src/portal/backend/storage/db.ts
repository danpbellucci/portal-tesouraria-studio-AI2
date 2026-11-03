// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import fs from '../shims/fs';
import path from '../shims/path';
import {
  DATA_DIR,
  IMPORTS_DIR,
  BACKUPS_DIR,
  EXPORTS_DIR,
  LOGS_DIR,
  CollectionFile,
  BaseRecord,
  UserRole
} from './schemas';

class FileMutex {
  private queues: Map<string, Promise<any>> = new Map();

  async acquire<T>(resourceKey: string, fn: () => Promise<T>): Promise<T> {
    const currentQueue = this.queues.get(resourceKey) || Promise.resolve();
    
    let release: () => void = () => {};
    const nextQueue = new Promise<void>((res) => {
      release = res;
    });

    this.queues.set(resourceKey, currentQueue.then(() => nextQueue));

    await currentQueue;
    try {
      return await fn();
    } finally {
      release();
      if (this.queues.get(resourceKey) === nextQueue) {
        this.queues.delete(resourceKey);
      }
    }
  }
}

const mutex = new FileMutex();

export class JsonRepository<T extends BaseRecord> {
  private filePath: string;
  private collectionName: string;
  private schemaVersion: number;

  constructor(collectionFileName: string, schemaVersion: number = 1) {
    this.collectionName = path.basename(collectionFileName, '.json');
    this.filePath = path.join(DATA_DIR, collectionFileName);
    this.schemaVersion = schemaVersion;
  }

  private ensureFileExists(): void {
    if (!fs.existsSync(this.filePath)) {
      const initial: CollectionFile<T> = {
        schemaVersion: this.schemaVersion,
        collectionName: this.collectionName,
        updatedAt: new Date().toISOString(),
        records: []
      };
      fs.writeFileSync(this.filePath, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  async readCollection(): Promise<CollectionFile<T>> {
    this.ensureFileExists();
    return mutex.acquire(this.filePath, async () => {
      try {
        const raw = await fs.promises.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as CollectionFile<T>;
        if (!parsed.records || !Array.isArray(parsed.records)) {
          parsed.records = [];
        }
        return parsed;
      } catch (err) {
        console.error(`[DB] Error reading ${this.filePath}:`, err);
        // Fallback recovery if corrupted
        const fallback: CollectionFile<T> = {
          schemaVersion: this.schemaVersion,
          collectionName: this.collectionName,
          updatedAt: new Date().toISOString(),
          records: []
        };
        return fallback;
      }
    });
  }

  async writeCollection(records: T[]): Promise<CollectionFile<T>> {
    return mutex.acquire(this.filePath, async () => {
      const now = new Date().toISOString();
      const payload: CollectionFile<T> = {
        schemaVersion: this.schemaVersion,
        collectionName: this.collectionName,
        updatedAt: now,
        records
      };

      const jsonString = JSON.stringify(payload, null, 2);
      const tempPath = `${this.filePath}.tmp.${Date.now()}`;

      // Atomic write: write to temp file then rename
      await fs.promises.writeFile(tempPath, jsonString, 'utf-8');
      await fs.promises.rename(tempPath, this.filePath);

      return payload;
    });
  }

  async getAll(): Promise<T[]> {
    const data = await this.readCollection();
    return data.records;
  }

  async getById(id: string): Promise<T | null> {
    const records = await this.getAll();
    return records.find((r) => r.id === id) || null;
  }

  async create(recordData: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<T> {
    const records = await this.getAll();
    const now = new Date().toISOString();
    const newRecord = {
      ...recordData,
      id: recordData.id || `${this.collectionName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: now,
      updatedAt: now
    } as T;

    records.push(newRecord);
    await this.writeCollection(records);
    return newRecord;
  }

  async update(id: string, updates: Partial<T>): Promise<T | null> {
    const records = await this.getAll();
    const index = records.findIndex((r) => r.id === id);
    if (index === -1) return null;

    const existing = records[index];
    const updated: T = {
      ...existing,
      ...updates,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };

    records[index] = updated;
    await this.writeCollection(records);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const records = await this.getAll();
    const filtered = records.filter((r) => r.id !== id);
    if (filtered.length === records.length) return false;

    await this.writeCollection(filtered);
    return true;
  }

  async replaceAll(records: T[]): Promise<void> {
    await this.writeCollection(records);
  }
}

// Initial directories setup & default seed data
export async function initializeStorage(): Promise<void> {
  const dirs = [DATA_DIR, IMPORTS_DIR, BACKUPS_DIR, EXPORTS_DIR, LOGS_DIR];
  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Seed default roles if roles.json is empty
  const rolesRepo = new JsonRepository<UserRole>('roles.json');
  const existingRoles = await rolesRepo.getAll();
  if (existingRoles.length === 0) {
    const allModules = [
      'companies', 'current_accounts', 'agreements', 'accesses',
      'indicators', 'cash_projections', 'tecban', 'loans',
      'holidays', 'users', 'backups', 'audit', 'tariffs', 'judicial_blocks', 'bank_contacts', 'powers', 'procurators', 'contracts', 'policies', 'manuals', 'accounting_routes', 'activity_divisions', 'dividends_jcp', 'approvals'
    ] as const;

    const fullPermissions: any = {};
    for (const m of allModules) {
      fullPermissions[m] = ['view', 'create', 'edit', 'delete', 'import', 'export', 'admin'];
    }

    const adminRole: UserRole = {
      id: 'role_admin',
      name: 'Administrador Geral',
      description: 'Acesso total de gestão e administração ao Portal Tesouraria',
      isSystemAdmin: true,
      permissions: fullPermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const analystPermissions: any = {};
    for (const m of allModules) {
      analystPermissions[m] = m === 'users' || m === 'backups' ? ['view'] : ['view', 'create', 'edit', 'import', 'export'];
    }

    const analystRole: UserRole = {
      id: 'role_analyst',
      name: 'Analista de Tesouraria',
      description: 'Operação financeira, cadastros, importações e projeções',
      isSystemAdmin: false,
      permissions: analystPermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const viewerPermissions: any = {};
    for (const m of allModules) {
      viewerPermissions[m] = ['view', 'export'];
    }

    const viewerRole: UserRole = {
      id: 'role_viewer',
      name: 'Auditor / Consulta',
      description: 'Acesso apenas de leitura aos relatórios e posições financeiras',
      isSystemAdmin: false,
      permissions: viewerPermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await rolesRepo.replaceAll([adminRole, analystRole, viewerRole]);
  }

  // Seed default banks if banks.json is empty
  const banksRepo = new JsonRepository<any>('banks.json');
  const existingBanks = await banksRepo.getAll();
  if (existingBanks.length === 0) {
    const defaultBanks = [
      { id: 'bank_001', code: '001', name: 'Banco do Brasil S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_237', code: '237', name: 'Banco Bradesco S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_341', code: '341', name: 'Itaú Unibanco S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_033', code: '033', name: 'Banco Santander (Brasil) S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_104', code: '104', name: 'Caixa Econômica Federal', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_208', code: '208', name: 'Banco BTG Pactual S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_422', code: '422', name: 'Banco Safra S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'bank_077', code: '077', name: 'Banco Inter S.A.', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    await banksRepo.replaceAll(defaultBanks);
  }

  // Seed FEBRABAN official banking holidays if empty
  const holidaysRepo = new JsonRepository<any>('financial_holidays.json');
  const existingHolidays = await holidaysRepo.getAll();
  if (existingHolidays.length === 0) {
    // Standard FEBRABAN 2026/2027 national bank holidays
    const defaultHolidays = [
      { id: 'hol_2026_01_01', date: '2026-01-01', description: 'Confraternização Universal', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_02_16', date: '2026-02-16', description: 'Carnaval (Segunda-feira)', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_02_17', date: '2026-02-17', description: 'Carnaval (Terça-feira)', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_04_03', date: '2026-04-03', description: 'Paixão de Cristo', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_04_21', date: '2026-04-21', description: 'Tiradentes', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_05_01', date: '2026-05-01', description: 'Dia do Trabalho', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_06_04', date: '2026-06-04', description: 'Corpus Christi', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_09_07', date: '2026-09-07', description: 'Independência do Brasil', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_10_12', date: '2026-10-12', description: 'Nossa Senhora Aparecida', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_11_02', date: '2026-11-02', description: 'Finados', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_11_15', date: '2026-11-15', description: 'Proclamação da República', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_11_20', date: '2026-11-20', description: 'Dia Nacional de Zumbi e da Consciência Negra', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_12_25', date: '2026-12-25', description: 'Natal', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: 'hol_2026_12_31', date: '2026-12-31', description: 'Último dia útil do ano (sem expediente ao público)', type: 'NATIONAL_BANKING', source: 'FEBRABAN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ];
    await holidaysRepo.replaceAll(defaultHolidays);
  }
}
