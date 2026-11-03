// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { BackupService } from '../services/backup.service';
import { AuditService } from '../services/audit.service';

const router = Router();

// List backups
router.get('/', requireAuth, requirePermission('backups', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const list = await BackupService.listBackups();
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create manual backup
router.post('/create', requireAuth, requirePermission('backups', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { notes } = req.body;
    const backup = await BackupService.createBackup(notes || 'Backup manual solicitado pelo usuário');

    await AuditService.log({
      userId: req.user?.userId,
      userEmail: req.user?.email,
      module: 'backups',
      action: 'BACKUP',
      recordId: backup.id,
      summary: `Backup manual gerado com sucesso: ${backup.filename} (${backup.filesCount} arquivos, ${backup.sizeBytes} bytes)`,
      ipAddress: req.ip
    });

    res.status(201).json(backup);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Download backup JSON
router.get('/:id/download', requireAuth, requirePermission('backups', 'export'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const content = await BackupService.getBackupContent(id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${id}.json"`);
    res.send(content);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Restore backup (admin only)
router.post('/:id/restore', requireAuth, requirePermission('backups', 'admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await BackupService.restoreBackup(id, req.user?.email);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
