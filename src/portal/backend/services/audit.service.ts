// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { JsonRepository } from '../storage/db';
import { AuditLog, SystemModule } from '../storage/schemas';

const auditRepo = new JsonRepository<AuditLog>('audit_logs.json');

export class AuditService {
  static async log(entry: {
    userId?: string;
    userEmail?: string;
    module: SystemModule | 'auth' | 'system';
    action: AuditLog['action'];
    recordId?: string;
    summary: string;
    previousValue?: any;
    newValue?: any;
    ipAddress?: string;
  }): Promise<AuditLog> {
    const record = await auditRepo.create({
      timestamp: new Date().toISOString(),
      userId: entry.userId || 'system',
      userEmail: entry.userEmail || 'sistema@interno',
      module: entry.module,
      action: entry.action,
      recordId: entry.recordId,
      summary: entry.summary,
      previousValue: entry.previousValue ? JSON.parse(JSON.stringify(entry.previousValue)) : undefined,
      newValue: entry.newValue ? JSON.parse(JSON.stringify(entry.newValue)) : undefined,
      ipAddress: entry.ipAddress || '127.0.0.1'
    });
    return record;
  }

  static async getLogs(filter?: {
    module?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<AuditLog[]> {
    const all = await auditRepo.getAll();
    let results = all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter?.module) {
      results = results.filter((r) => r.module === filter.module);
    }
    if (filter?.action) {
      results = results.filter((r) => r.action === filter.action);
    }
    if (filter?.startDate) {
      const start = new Date(filter.startDate).getTime();
      results = results.filter((r) => new Date(r.timestamp).getTime() >= start);
    }
    if (filter?.endDate) {
      const end = new Date(filter.endDate).getTime();
      results = results.filter((r) => new Date(r.timestamp).getTime() <= end);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      results = results.filter(
        (r) =>
          r.summary.toLowerCase().includes(q) ||
          r.userEmail.toLowerCase().includes(q) ||
          (r.recordId && r.recordId.toLowerCase().includes(q))
      );
    }

    return results;
  }
}
