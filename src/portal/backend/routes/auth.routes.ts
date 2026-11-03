// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Router, Response } from '../shims/express';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { AuthenticatedRequest, requireAuth } from '../middleware/auth.middleware';
import { JsonRepository } from '../storage/db';
import { UserAccount, UserRole } from '../storage/schemas';

const router = Router();
const usersRepo = new JsonRepository<UserAccount>('users.json');
const rolesRepo = new JsonRepository<UserRole>('roles.json');

// Get system setup and auth status
router.get('/status', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSetupRequired = await AuthService.isSetupRequired();
    res.json({
      isSetupRequired,
      authenticated: !!req.user,
      user: req.user || null
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Initial Admin Setup (only works when zero users exist)
router.post('/setup-admin', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, name, password } = req.body;
    const admin = await AuthService.setupInitialAdmin({ email, name, password });
    
    await AuditService.log({
      userEmail: admin.email,
      module: 'auth',
      action: 'CREATE',
      summary: `Administrador inicial cadastrado com sucesso: ${admin.email}`,
      ipAddress: req.ip
    });

    // Automatically authenticate the initial admin
    const { session } = await AuthService.authenticate(email, password, req.ip);

    res.json({
      success: true,
      message: 'Administrador inicial configurado com sucesso.',
      session,
      user: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        roleId: admin.roleId,
        isSystemAdmin: true
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      return;
    }

    const { user, session } = await AuthService.authenticate(email, password, req.ip);

    await AuditService.log({
      userId: user.id,
      userEmail: user.email,
      module: 'auth',
      action: 'LOGIN',
      summary: `Login bem-sucedido do usuário ${user.email}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      session,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        isSystemAdmin: session.isSystemAdmin,
        permissions: session.permissions
      }
    });
  } catch (err: any) {
    await AuditService.log({
      userEmail: req.body?.email || 'desconhecido',
      module: 'auth',
      action: 'LOGIN',
      summary: `Tentativa de login falha para ${req.body?.email}: ${err.message}`,
      ipAddress: req.ip
    });
    res.status(401).json({ error: err.message });
  }
});

// Activate pending account
router.post('/activate', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, newPassword } = req.body;
    const activated = await AuthService.activateUser({ email, newPassword });

    await AuditService.log({
      userId: activated.id,
      userEmail: activated.email,
      module: 'auth',
      action: 'ACTIVATE',
      summary: `Conta ativada com sucesso pelo primeiro acesso: ${activated.email}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Conta ativada com sucesso. Você já pode efetuar o login com sua nova senha.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Logout
router.post('/logout', (req: AuthenticatedRequest, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    AuthService.revokeSession(token);
  }
  res.json({ success: true, message: 'Sessão encerrada com sucesso.' });
});

// Current user info
router.get('/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// List system roles
router.get('/roles', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const roles = await rolesRepo.getAll();
    res.json(roles);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List user accounts (admin only)
router.get('/users', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao Administrador do Portal Tesouraria.' });
      return;
    }
    const users = await usersRepo.getAll();
    const sanitized = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      roleId: u.roleId,
      status: u.status,
      failedLoginAttempts: u.failedLoginAttempts,
      lockedUntil: u.lockedUntil,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt
    }));
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Pre-approve a corporate email (admin only)
router.post('/users/authorize', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao Administrador do Portal Tesouraria.' });
      return;
    }
    const { email, name, roleId } = req.body;
    if (!email || !name) {
      res.status(400).json({ error: 'E-mail e nome são obrigatórios.' });
      return;
    }

    const { user } = await AuthService.authorizeEmail({ email, name, roleId });

    await AuditService.log({
      userId: req.user.userId,
      userEmail: req.user.email,
      module: 'users',
      action: 'CREATE',
      recordId: user.id,
      summary: `E-mail autorizado para acesso: ${user.email} (Perfil: ${roleId})`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'E-mail autorizado com sucesso.',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        status: user.status
      }
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Block or Unblock user
router.post('/users/:id/toggle-block', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao Administrador.' });
      return;
    }
    const targetUser = await usersRepo.getById(req.params.id);
    if (!targetUser) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    if (targetUser.id === req.user.userId) {
      res.status(400).json({ error: 'Não é permitido bloquear a si próprio.' });
      return;
    }

    const newStatus = targetUser.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
    await usersRepo.update(targetUser.id, { status: newStatus });

    if (newStatus === 'BLOCKED') {
      AuthService.revokeAllUserSessions(targetUser.id);
    }

    await AuditService.log({
      userId: req.user.userId,
      userEmail: req.user.email,
      module: 'users',
      action: 'UPDATE',
      recordId: targetUser.id,
      summary: `Status do usuário ${targetUser.email} alterado para ${newStatus}`,
      ipAddress: req.ip
    });

    res.json({ success: true, status: newStatus });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset user access; user will create a new password using the pre-approved email
router.post('/users/:id/reset-code', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) {
      res.status(403).json({ error: 'Acesso restrito ao Administrador.' });
      return;
    }
    await AuthService.adminResetPassword(req.params.id);

    await AuditService.log({
      userId: req.user.userId,
      userEmail: req.user.email,
      module: 'users',
      action: 'PASSWORD_RESET',
      recordId: req.params.id,
      summary: `Acesso redefinido para o usuário ${req.params.id}; novo cadastro de senha permitido por e-mail pré-aprovado`,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Acesso redefinido. O usuário poderá cadastrar uma nova senha usando seu e-mail pré-aprovado.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Edit user data (admin only)
router.put('/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) { res.status(403).json({ error: 'Acesso restrito ao Administrador.' }); return; }
    const target = await usersRepo.getById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const roleId = String(req.body?.roleId || target.roleId);
    if (!name || !email) { res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' }); return; }
    const all = await usersRepo.getAll();
    if (all.some((u) => u.id !== target.id && u.email.toLowerCase() === email)) { res.status(400).json({ error: 'Já existe um usuário com este e-mail.' }); return; }
    if (target.id === req.user.userId && roleId !== target.roleId) { res.status(400).json({ error: 'Não é permitido alterar o próprio perfil.' }); return; }
    await usersRepo.update(target.id, { name, email, roleId });
    if (roleId !== target.roleId || email !== target.email) AuthService.revokeAllUserSessions(target.id);
    await AuditService.log({ userId: req.user.userId, userEmail: req.user.email, module: 'users', action: 'UPDATE', recordId: target.id, summary: `Dados do usuário ${email} atualizados (Perfil: ${roleId})`, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// Delete user (admin only)
router.delete('/users/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.isSystemAdmin) { res.status(403).json({ error: 'Acesso restrito ao Administrador.' }); return; }
    const target = await usersRepo.getById(req.params.id);
    if (!target) { res.status(404).json({ error: 'Usuário não encontrado.' }); return; }
    if (target.id === req.user.userId) { res.status(400).json({ error: 'Não é permitido excluir a si próprio.' }); return; }
    AuthService.revokeAllUserSessions(target.id);
    await usersRepo.delete(target.id);
    await AuditService.log({ userId: req.user.userId, userEmail: req.user.email, module: 'users', action: 'DELETE', recordId: target.id, summary: `Usuário excluído: ${target.email}`, ipAddress: req.ip });
    res.json({ success: true });
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

export default router;
