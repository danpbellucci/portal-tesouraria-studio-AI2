// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import crypto from '../shims/crypto';
import { JsonRepository } from '../storage/db';
import { UserAccount, UserRole, SystemModule, PermissionAction } from '../storage/schemas';

const usersRepo = new JsonRepository<UserAccount>('users.json');
const rolesRepo = new JsonRepository<UserRole>('roles.json');

export interface SessionInfo {
  token: string;
  userId: string;
  email: string;
  name: string;
  roleId: string;
  isSystemAdmin: boolean;
  permissions: Record<string, PermissionAction[]>;
  createdAt: number;
  lastActiveAt: number;
}

// In-memory active sessions store (synchronized with server runtime)
class PersistentSessionMap extends Map<string, SessionInfo> {
  private static KEY = 'elopar_active_sessions';
  private loaded = false;
  private load() {
    if (this.loaded) return; this.loaded = true;
    try { const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(PersistentSessionMap.KEY) : null; if (raw) for (const [k, v] of JSON.parse(raw)) super.set(k, v); } catch { /* ignore */ }
  }
  private save() { try { if (typeof localStorage !== 'undefined') localStorage.setItem(PersistentSessionMap.KEY, JSON.stringify([...super.entries()])); } catch { /* ignore */ } }
  get(k: string) { this.load(); return super.get(k); }
  set(k: string, v: SessionInfo) { this.load(); super.set(k, v); if (this.loaded) this.save(); return this; }
  delete(k: string) { this.load(); const r = super.delete(k); this.save(); return r; }
  entries() { this.load(); return super.entries(); }
}
const activeSessions: Map<string, SessionInfo> = new PersistentSessionMap();

// Failed login attempts tracker: key -> { count, lockedUntil }
const failedAttempts: Map<string, { count: number; lockedUntil?: number }> = new Map();

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  static hashPassword(password: string, salt: string): string {
    return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  }

  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }



  static generateSessionToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  static async ensureDefaultAdmin(): Promise<void> {
    const adminEmail = ((undefined as string | undefined) || 'dbellucci@elopar.com.br').toLowerCase().trim();
    const adminPassword = (undefined as string | undefined) || 'alelo123';
    const users = await usersRepo.getAll();
    const existing = users.find((u) => u.email.toLowerCase() === adminEmail);
    if (existing) return;

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(adminPassword, salt);
    await usersRepo.create({
      email: adminEmail,
      name: 'Administrador Elo Treasury',
      passwordHash,
      salt,
      roleId: 'role_admin',
      status: 'ACTIVE',
      failedLoginAttempts: 0
    });
  }

  static async isSetupRequired(): Promise<boolean> {
    await this.ensureDefaultAdmin();
    return false;
  }

  static async setupInitialAdmin(data: { email: string; name: string; password: string }): Promise<UserAccount> {
    const users = await usersRepo.getAll();
    if (users.length > 0) {
      throw new Error('O sistema já possui usuários cadastrados. Procedimento de inicialização desabilitado.');
    }

    if (!data.email || !data.password || data.password.length < 8) {
      throw new Error('E-mail e senha são obrigatórios. A senha deve possuir ao menos 8 caracteres.');
    }

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(data.password, salt);

    const adminUser = await usersRepo.create({
      email: data.email.toLowerCase().trim(),
      name: data.name.trim() || 'Administrador Inicial',
      passwordHash,
      salt,
      roleId: 'role_admin',
      status: 'ACTIVE',
      failedLoginAttempts: 0
    });

    return adminUser;
  }

  static async authenticate(email: string, password: string, clientIp: string = '127.0.0.1'): Promise<{ user: UserAccount; session: SessionInfo }> {
    const normalizedEmail = (email || '').toLowerCase().trim();
    const lockKey = `${normalizedEmail}_${clientIp}`;
    const attempt = failedAttempts.get(lockKey);

    const now = Date.now();
    if (attempt && attempt.lockedUntil && attempt.lockedUntil > now) {
      const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / 60000);
      throw new Error(`Acesso temporariamente bloqueado devido a sucessivas tentativas inválidas. Tente novamente em ${remainingMinutes} minutos.`);
    }

    const users = await usersRepo.getAll();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    // Generic error to not reveal whether email exists
    const invalidCredentialsError = new Error('Credenciais de acesso inválidas ou usuário não autorizado.');

    if (!user) {
      this.recordFailedAttempt(lockKey);
      throw invalidCredentialsError;
    }

    if (user.status === 'BLOCKED') {
      throw new Error('Conta de usuário bloqueada pela administração do sistema.');
    }

    if (user.status === 'PENDING_ACTIVATION') {
      throw new Error('E-mail pré-aprovado. Conclua o primeiro acesso cadastrando sua senha.');
    }

    if (!user.passwordHash || !user.salt) {
      throw invalidCredentialsError;
    }

    const candidateHash = this.hashPassword(password, user.salt);
    if (candidateHash !== user.passwordHash) {
      this.recordFailedAttempt(lockKey);
      throw invalidCredentialsError;
    }

    // Reset failed attempts on success
    failedAttempts.delete(lockKey);

    // Fetch user role
    const role = await rolesRepo.getById(user.roleId);
    const isSystemAdmin = role?.isSystemAdmin || user.roleId === 'role_admin';
    const permissions = role?.permissions || ({} as any);

    const token = this.generateSessionToken();
    const session: SessionInfo = {
      token,
      userId: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      isSystemAdmin: !!isSystemAdmin,
      permissions,
      createdAt: now,
      lastActiveAt: now
    };

    activeSessions.set(token, session);

    // Update last login
    await usersRepo.update(user.id, {
      lastLoginAt: new Date().toISOString(),
      lastLoginIp: clientIp,
      failedLoginAttempts: 0
    });

    return { user, session };
  }

  private static recordFailedAttempt(key: string): void {
    const current = failedAttempts.get(key) || { count: 0 };
    current.count += 1;
    if (current.count >= MAX_FAILED_ATTEMPTS) {
      current.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    }
    failedAttempts.set(key, current);
  }

  static validateSession(token: string): SessionInfo | null {
    if (!token) return null;
    const session = activeSessions.get(token);
    if (!session) return null;

    const now = Date.now();
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
      return null;
    }

    session.lastActiveAt = now;
    return session;
  }

  static revokeSession(token: string): boolean {
    return activeSessions.delete(token);
  }

  static revokeAllUserSessions(userId: string): void {
    for (const [token, s] of activeSessions.entries()) {
      if (s.userId === userId) {
        activeSessions.delete(token);
      }
    }
  }

  static async authorizeEmail(data: { email: string; name: string; roleId: string }): Promise<{ user: UserAccount }> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const users = await usersRepo.getAll();
    const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (existing) {
      throw new Error('Este e-mail já está cadastrado no sistema.');
    }

    const user = await usersRepo.create({
      email: normalizedEmail,
      name: data.name.trim(),
      roleId: data.roleId || 'role_analyst',
      status: 'PENDING_ACTIVATION',
      failedLoginAttempts: 0
    });

    return { user };
  }

  static async activateUser(data: { email: string; newPassword: string }): Promise<UserAccount> {
    const normalizedEmail = (data.email || '').toLowerCase().trim();

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new Error('A nova senha deve possuir ao menos 8 caracteres.');
    }

    const users = await usersRepo.getAll();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || user.status !== 'PENDING_ACTIVATION') {
      throw new Error('Este e-mail não está pré-aprovado para cadastro ou a conta já foi ativada. Solicite autorização ao administrador.');
    }

    const salt = this.generateSalt();
    const passwordHash = this.hashPassword(data.newPassword, salt);

    const updated = await usersRepo.update(user.id, {
      status: 'ACTIVE',
      passwordHash,
      salt,
      activationCode: undefined,
      activationCodeExpiresAt: undefined,
      failedLoginAttempts: 0
    });

    if (!updated) {
      throw new Error('Falha ao ativar usuário.');
    }

    return updated;
  }

  static async adminResetPassword(userId: string): Promise<void> {
    const user = await usersRepo.getById(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    await usersRepo.update(userId, {
      status: 'PENDING_ACTIVATION',
      passwordHash: undefined,
      salt: undefined,
      activationCode: undefined,
      activationCodeExpiresAt: undefined
    });
    this.revokeAllUserSessions(userId);
  }

  static hasPermission(session: SessionInfo, moduleName: SystemModule, action: PermissionAction): boolean {
    if (session.isSystemAdmin) return true;
    const modulePerms = session.permissions?.[moduleName];
    if (!modulePerms || !Array.isArray(modulePerms)) return false;
    return modulePerms.includes(action) || modulePerms.includes('admin');
  }
}
