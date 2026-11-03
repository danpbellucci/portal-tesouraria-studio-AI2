// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import { Request, Response, NextFunction } from '../shims/express';
import { AuthService, SessionInfo } from '../services/auth.service';
import { SystemModule, PermissionAction } from '../storage/schemas';

export interface AuthenticatedRequest extends Request {
  user?: SessionInfo;
}

export function extractSession(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.elo_session) {
    token = req.cookies.elo_session;
  }

  if (token) {
    const session = AuthService.validateSession(token);
    if (session) {
      req.user = session;
    }
  }

  next();
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Sessão não autorizada ou expirada. Efetue login novamente.' });
    return;
  }
  next();
}

export function requirePermission(moduleName: SystemModule, action: PermissionAction) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Autenticação necessária.' });
      return;
    }

    if (req.user.isSystemAdmin) {
      return next();
    }

    const permitted = AuthService.hasPermission(req.user, moduleName, action);
    if (!permitted) {
      res.status(403).json({
        error: `Acesso negado. Seu perfil não possui permissão de ${action} no módulo ${moduleName}.`
      });
      return;
    }

    next();
  };
}
