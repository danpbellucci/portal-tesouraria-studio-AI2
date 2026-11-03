// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import fs from '../shims/fs';
import path from '../shims/path';
import crypto from '../shims/crypto';
import { DATA_DIR, BACKUPS_DIR } from '../storage/schemas';
const DOCUMENTS_DIR = path.join('', 'documents');
import { AuditService } from './audit.service';

export interface BackupMetadata {
  id: string;
  filename: string;
  createdAt: string;
  sizeBytes: number;
  filesCount: number;
  checksum: string;
  notes?: string;
  isAutoPreRestore?: boolean;
}

export class BackupService {
  static getBackupsDir(): string {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    return BACKUPS_DIR;
  }

  static async listBackups(): Promise<BackupMetadata[]> {
    const dir = this.getBackupsDir();
    const files = await fs.promises.readdir(dir);
    const backupFiles = files.filter((f) => f.endsWith('.json') && f.startsWith('backup_'));

    const list: BackupMetadata[] = [];
    for (const f of backupFiles) {
      try {
        const fullPath = path.join(dir, f);
        const stat = await fs.promises.stat(fullPath);
        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const parsed = JSON.parse(content);

        const checksum = crypto.createHash('sha256').update(content).digest('hex');

        list.push({
          id: f.replace('.json', ''),
          filename: f,
          createdAt: parsed.metadata?.createdAt || stat.mtime.toISOString(),
          sizeBytes: stat.size,
          filesCount: Object.keys(parsed.collections || {}).length,
          checksum,
          notes: parsed.metadata?.notes,
          isAutoPreRestore: parsed.metadata?.isAutoPreRestore
        });
      } catch (err) {
        console.error('Error parsing backup file:', f, err);
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  static async createBackup(notes: string = 'Backup Manual do Portal Tesouraria', isAutoPreRestore: boolean = false): Promise<BackupMetadata> {
    const dir = this.getBackupsDir();
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${timestamp}.json`;
    const targetPath = path.join(dir, filename);

    // Read all JSON files in DATA_DIR
    const dataFiles = await fs.promises.readdir(DATA_DIR);
    const collections: Record<string, any> = {};

    for (const f of dataFiles) {
      if (f.endsWith('.json') && !f.includes('.tmp.')) {
        try {
          const raw = await fs.promises.readFile(path.join(DATA_DIR, f), 'utf-8');
          collections[f] = JSON.parse(raw);
        } catch (e) {
          console.warn(`Could not include file ${f} in backup:`, e);
        }
      }
    }

    const documents: Record<string, string> = {};
    if (fs.existsSync(DOCUMENTS_DIR)) {
      for (const name of await fs.promises.readdir(DOCUMENTS_DIR)) {
        const full = path.join(DOCUMENTS_DIR, path.basename(name));
        if ((await fs.promises.stat(full)).isFile()) documents[name] = (await fs.promises.readFile(full)).toString('base64');
      }
    }

    const payload = {
      metadata: {
        id: `backup_${timestamp}`,
        createdAt: now.toISOString(),
        version: '1.0',
        system: 'Portal Tesouraria',
        notes,
        isAutoPreRestore,
        filesCount: Object.keys(collections).length
      },
      collections,
      documents
    };

    const content = JSON.stringify(payload, null, 2);
    await fs.promises.writeFile(targetPath, content, 'utf-8');

    const stat = await fs.promises.stat(targetPath);
    const checksum = crypto.createHash('sha256').update(content).digest('hex');

    return {
      id: `backup_${timestamp}`,
      filename,
      createdAt: now.toISOString(),
      sizeBytes: stat.size,
      filesCount: Object.keys(collections).length,
      checksum,
      notes,
      isAutoPreRestore
    };
  }

  static async restoreBackup(backupId: string, userEmail: string = 'admin'): Promise<{ success: boolean; restoredFiles: number; preRestoreBackupId: string }> {
    const dir = this.getBackupsDir();
    const fullPath = path.join(dir, `${backupId}.json`);

    if (!fs.existsSync(fullPath)) {
      throw new Error('Arquivo de backup não encontrado.');
    }

    const content = await fs.promises.readFile(fullPath, 'utf-8');
    const parsed = JSON.parse(content);

    if (!parsed.collections || typeof parsed.collections !== 'object') {
      throw new Error('Conteúdo do arquivo de backup corrompido ou inválido.');
    }

    // MANDATORY STEP: Create safety backup immediately before restoring
    const safetyBackup = await this.createBackup(`Backup automático de segurança antes da restauração de ${backupId}`, true);

    // Restore uploaded documents, preserving stored filenames.
    if (parsed.documents && typeof parsed.documents === 'object') {
      await fs.promises.mkdir(DOCUMENTS_DIR, { recursive: true });
      for (const [name, encoded] of Object.entries(parsed.documents)) {
        const safeName = path.basename(name);
        if (typeof encoded !== 'string') continue;
        const target = path.join(DOCUMENTS_DIR, safeName);
        const temp = `${target}.tmp.${Date.now()}`;
        await fs.promises.writeFile(temp, Buffer.from(encoded, 'base64'));
        await fs.promises.rename(temp, target);
      }
    }

    // Write all collections into DATA_DIR atomically
    let restoredCount = 0;
    for (const [fileName, fileData] of Object.entries(parsed.collections)) {
      const targetFilePath = path.join(DATA_DIR, fileName);
      const tempPath = `${targetFilePath}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tempPath, JSON.stringify(fileData, null, 2), 'utf-8');
      await fs.promises.rename(tempPath, targetFilePath);
      restoredCount++;
    }

    await AuditService.log({
      userEmail,
      module: 'backups',
      action: 'RESTORE',
      summary: `Restauração do backup ${backupId} concluída. ${restoredCount} coleções restauradas. Snapshot de segurança gerado: ${safetyBackup.id}.`
    });

    return {
      success: true,
      restoredFiles: restoredCount,
      preRestoreBackupId: safetyBackup.id
    };
  }

  static async getBackupContent(backupId: string): Promise<string> {
    const dir = this.getBackupsDir();
    const fullPath = path.join(dir, `${backupId}.json`);
    if (!fs.existsSync(fullPath)) {
      throw new Error('Arquivo de backup não encontrado.');
    }
    return await fs.promises.readFile(fullPath, 'utf-8');
  }
}
