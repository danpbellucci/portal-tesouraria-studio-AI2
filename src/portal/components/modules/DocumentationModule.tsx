// @ts-nocheck — legacy module shared with the local Express server (looser TS config)
import React, { useState } from 'react';
import {
  BookOpen,
  Server,
  ShieldCheck,
  RotateCcw,
  RefreshCw,
  Terminal,
  FolderTree,
  Lock,
  Globe,
  Copy,
  Check
} from 'lucide-react';
import { useToast } from '../common/Toast';

export const DocumentationModule: React.FC = () => {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'DEPLOY' | 'BACKUP_RESTORE' | 'UPGRADE' | 'STORAGE'>('DEPLOY');
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    showToast('Comando copiado para a área de transferência.', 'info');
    setTimeout(() => setCopiedSection(null), 2500);
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Manuais & Implantação na Rede Corporativa</h1>
        <p className="text-xs text-slate-500 mt-1">
          Instruções técnicas para a equipe de Infraestrutura e TI da Elo Participações para hospedagem interna, inicialização contínua e rotinas de backup.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveTab('DEPLOY')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'DEPLOY'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Instalação (Linux & Windows)</span>
        </button>

        <button
          onClick={() => setActiveTab('BACKUP_RESTORE')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'BACKUP_RESTORE'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Rotinas de Backup & Restauração</span>
        </button>

        <button
          onClick={() => setActiveTab('UPGRADE')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'UPGRADE'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Atualização Sem Perda de Dados</span>
        </button>

        <button
          onClick={() => setActiveTab('STORAGE')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'STORAGE'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="w-3.5 h-3.5" />
          <span>Estrutura JSON & Persistência</span>
        </button>
      </div>

      {/* TAB 1: DEPLOYMENT */}
      {activeTab === 'DEPLOY' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-600" />
              1. Requisitos de Ambiente
            </h3>
            <ul className="text-xs text-slate-600 list-disc pl-5 space-y-1.5 leading-relaxed">
              <li><strong>Node.js:</strong> Versão 20 LTS ou 22 LTS instalada no servidor.</li>
              <li><strong>Sistema Operacional:</strong> Linux (Ubuntu Server, Red Hat, Debian) ou Windows Server 2019/2022.</li>
              <li><strong>Rede Corporativa:</strong> Endereço IP estático e entrada DNS interna (ex: <code>http://elo-treasury.interno</code>).</li>
              <li><strong>Isolamento em Nuvem:</strong> Nenhuma dependência externa de Supabase, Firebase ou Vercel. A aplicação roda 100% on-premises.</li>
            </ul>
          </div>

          {/* Linux systemd */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">2. Inicialização Automática no Linux (systemd)</h3>
              <button
                onClick={() =>
                  copyCode(
`[Unit]
Description=Portal Tesouraria
After=network.target

[Service]
Type=simple
User=elo-app
WorkingDirectory=/opt/elo-treasury
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/opt/elo-treasury/data

[Install]
WantedBy=multi-user.target`,
                    'systemd'
                  )
                }
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
              >
                {copiedSection === 'systemd' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Configuração</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-auto leading-relaxed">
{`# Criar serviço systemd em /etc/systemd/system/elo-treasury.service:
[Unit]
Description=Portal Tesouraria
After=network.target

[Service]
Type=simple
User=elo-app
WorkingDirectory=/opt/elo-treasury
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=DATA_DIR=/opt/elo-treasury/data

[Install]
WantedBy=multi-user.target

# Comandos de ativação:
sudo systemctl daemon-reload
sudo systemctl enable elo-treasury
sudo systemctl start elo-treasury`}
            </pre>
          </div>

          {/* Windows Server PM2 */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">3. Inicialização no Windows Server (PM2 ou Windows Service)</h3>
              <button
                onClick={() =>
                  copyCode(
`npm install -g pm2 pm2-windows-service
pm2-service-install
npm run build
pm2 start server.ts --name "elo-treasury" --interpreter tsx
pm2 save`,
                    'pm2'
                  )
                }
                className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-900"
              >
                {copiedSection === 'pm2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copiar Comandos</span>
              </button>
            </div>

            <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-auto leading-relaxed">
{`# No PowerShell com privilégios de Administrador:
npm install -g pm2 pm2-windows-service
pm2-service-install

# No diretório do projeto:
npm install
npm run build
pm2 start server.ts --name "elo-treasury" --interpreter tsx
pm2 save`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: BACKUP & RESTORE */}
      {activeTab === 'BACKUP_RESTORE' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Procedimentos Operacionais de Backup e Recuperação
          </h3>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              <strong>1. Backups Automáticos e Manuais:</strong> O Portal Tesouraria cria snapshots versionados dentro do diretório <code className="font-mono text-slate-800">/backups/</code>. Cada pacote contém todas as coleções JSON e metadados com hash SHA-256 para garantia de integridade.
            </p>
            <p>
              <strong>2. Salvaguarda Pré-Restauração:</strong> Antes de qualquer restauração de backup ser aplicada pelo administrador, o motor de persistência executa compulsoriamente um snapshot de segurança denominado <em>"Backup automático de segurança antes da restauração"</em>.
            </p>
            <p>
              <strong>3. Cópia Externa Recomendada (Cron / Agendador de Tarefas):</strong> Configure a replicação diária da pasta <code className="font-mono text-slate-800">/backups/</code> para um volume compartilhado de rede corporativo (NAS / SAN):
            </p>
            <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg font-mono text-[11px]">
{`# Exemplo de sincronização diária para storage de rede corporativo (crontab):
0 23 * * * rsync -av /opt/elo-treasury/backups/ /mnt/backup_corporativo/elo-treasury/`}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 3: UPGRADE WITHOUT DATA LOSS */}
      {activeTab === 'UPGRADE' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-sky-600" />
            Atualização da Aplicação Sem Perda de Dados
          </h3>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <p>
              Como os dados persistentes residem fora do bundle compilado (no diretório <code className="font-mono text-slate-800">/data/</code> ou caminho configurado via <code className="font-mono text-slate-800">DATA_DIR</code>), a aplicação pode ser atualizada sem risco aos registros financeiros:
            </p>

            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong>Gerar Backup Preventivo:</strong> Acesse o módulo <em>Backups & Recuperação</em> e gere um snapshot manual.
              </li>
              <li>
                <strong>Atualizar o Código:</strong> Efetue o pull da nova versão ou extraia os novos arquivos de código-fonte no servidor.
              </li>
              <li>
                <strong>Instalar Dependências & Recompilar:</strong>
                <pre className="p-2.5 bg-slate-950 text-slate-100 rounded font-mono text-[11px] mt-1">
{`npm install
npm run build`}
                </pre>
              </li>
              <li>
                <strong>Reiniciar o Serviço:</strong>
                <pre className="p-2.5 bg-slate-950 text-slate-100 rounded font-mono text-[11px] mt-1">
{`sudo systemctl restart elo-treasury   # Linux
pm2 restart elo-treasury              # Windows Server`}
                </pre>
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB 4: STORAGE & JSON SCHEMAS */}
      {activeTab === 'STORAGE' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-sky-600" />
            Arquitetura de Persistência em Arquivos JSON
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed">
            O Portal Tesouraria utiliza armazenamento em arquivos JSON atômicos com serialização por Mutex, garantindo que mesmo com múltiplos acessos simultâneos de usuários, não ocorram gravações parciais ou corrupção de arquivos:
          </p>

          <pre className="p-4 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-auto leading-relaxed">
{`ELO-TREASURY/
├── data/
│   ├── companies.json              # Cadastro mestre das empresas do grupo
│   ├── directors.json              # Diretores estatutários
│   ├── company_directors.json      # Relacionamento N:N empresas e diretores
│   ├── banks.json                  # Instituições bancárias FEBRABAN
│   ├── current_accounts.json       # Contas correntes (intraday, aplicação, tombamento)
│   ├── bank_agreements.json        # Convênios bancários cadastrados
│   ├── bank_accesses.json          # Acessos aos portais bancários corporativos
│   ├── indicators.json             # Histórico de CDI diário e cotas de fundos
│   ├── indicator_versions.json     # Versões imutáveis da curva CDI
│   ├── cash_projections.json       # Posição e projeção diária de caixa
│   ├── tecban_records.json         # Movimentação financeira da rede Tecban
│   ├── loan_contracts.json         # Contratos de empréstimo e cronograma
│   ├── loan_simulations.json       # Simulações de custo financeiro
│   ├── financial_holidays.json     # Feriados bancários oficiais
│   ├── users.json                  # Usuários e hashes de senhas (PBKDF2)
│   ├── roles.json                  # Matriz de perfis e permissões RBAC
│   ├── import_versions.json        # Snapshots de todas as planilhas importadas
│   └── audit_logs.json             # Trilha de auditoria global imutável
├── imports/                        # Arquivos originais (.xlsx/.csv) preservados
└── backups/                        # Snapshots de backup JSON`}
          </pre>
        </div>
      )}
    </div>
  );
};
