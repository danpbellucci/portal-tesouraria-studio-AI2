// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { AuthenticatedRequest, requireAuth, requirePermission } from '../middleware/auth.middleware';
import { AuditService } from '../services/audit.service';

const router = Router();

// Get audit logs with filtering
router.get('/', requireAuth, requirePermission('audit', 'view'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { module, action, startDate, endDate, search } = req.query;
    const logs = await AuditService.getLogs({
      module: module ? String(module) : undefined,
      action: action ? String(action) : undefined,
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      search: search ? String(search) : undefined
    });
    res.json(logs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
