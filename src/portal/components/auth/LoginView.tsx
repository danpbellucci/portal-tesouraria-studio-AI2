// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

export const LoginView: React.FC = () => {
  const { login, activateAccount } = useAuth();
  const { showToast } = useToast();

  const [mode, setMode] = useState<'LOGIN' | 'ACTIVATE'>('LOGIN');

  // Login states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Activation states
  const [actEmail, setActEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      showToast('Login efetuado com sucesso.', 'success');
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError('A confirmação de senha não coincide.');
      return;
    }

    if (newPassword.length < 8) {
      setError('A nova senha deve possuir ao menos 8 dígitos.');
      return;
    }

    setLoading(true);
    try {
      await activateAccount(actEmail, newPassword);
      setSuccessMsg('Conta ativada com sucesso! Você já pode efetuar o login com sua nova senha.');
      showToast('Conta ativada com sucesso.', 'success');
      setEmail(actEmail);
      setPassword('');
      setMode('LOGIN');
    } catch (err: any) {
      setError(err.message);
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-ui min-h-screen flex flex-col justify-center items-center p-4 bg-slate-950 bg-[radial-gradient(1200px_600px_at_20%_-10%,oklch(0.45_0.16_262/0.45),transparent),radial-gradient(900px_500px_at_110%_110%,oklch(0.35_0.12_240/0.4),transparent)]">
      <div className="max-w-md w-full bg-white/95 backdrop-blur rounded-3xl shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] p-10 border border-white/20">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-sky-700" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Portal Tesouraria EloPar</h2>
          <p className="text-xs text-slate-500 mt-1">Elo Participações · Gestão Financeira & Acessos</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {mode === 'LOGIN' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail Corporativo Autorizado</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@eloparticipacoes.com.br"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Senha Individual</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-6 shadow-md"
            >
              <span>{loading ? 'Acessando...' : 'Acessar o Portal Tesouraria'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-3 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => { setError(null); setMode('ACTIVATE'); }}
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline"
              >
                Primeiro acesso / cadastrar senha
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="bg-sky-50 p-3 rounded-lg border border-sky-200 text-xs text-sky-800 mb-2">
              Informe o e-mail que foi previamente autorizado pelo administrador. Não é necessário código de ativação.
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">E-mail Cadastrado</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={actEmail}
                  onChange={(e) => setActEmail(e.target.value)}
                  placeholder="usuario@eloparticipacoes.com.br"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Definir Nova Senha Individual</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Confirmar Nova Senha</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs pl-9 pr-3 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-6 shadow-md"
            >
              <span>{loading ? 'Cadastrando...' : 'Cadastrar Minha Senha'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-3 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => { setError(null); setMode('LOGIN'); }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Voltar para o login
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 pt-4">
          Ambiente restrito aos colaboradores autorizados da Elo Participações.
          <br />Todos os acessos são auditados e protegidos por controle de tentativas.
        </div>
      </div>
    </div>
  );
};
