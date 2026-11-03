# Elo Treasury Compass

# 1. PORTAL TESOURARIA ELOPAR

Sua missão é desenvolver uma aplicação corporativa completa chamada **Portal Tesouraria EloPar**, pertencente à Elo Participações.

O Portal Tesouraria EloPar será utilizado pela equipe de Tesouraria para centralizar informações bancárias, financeiras, operacionais, indicadores econômicos, contratos, empréstimos, projeções de caixa e controles internos.

O sistema deve ser uma aplicação real, funcional e pronta para utilização corporativa.

Não desenvolva apenas um protótipo visual, telas estáticas ou demonstrações com dados fictícios.

Todas as funcionalidades devem possuir lógica de negócio, persistência, validações, filtros e operações efetivas.

A confiabilidade das informações financeiras é a prioridade máxima do projeto.

Para viabilizar tanto a execução no preview quanto o posterior download para execução local na máquina/servidor da empresa, implemente uma camada de serviço e persistência desacoplada (Storage/API Adapter) com persistência em armazenamento do navegador (LocalStorage / IndexedDB com seeds realistas dos dados corporativos), estruturada de forma que todas as chamadas de API correspondam exatamente às rotas REST esperadas pelo backend Express local.

# 3. IDENTIDADE DO SISTEMA

Nome oficial: **Portal Tesouraria EloPar**
Empresa: Elo Participações.

### Diretrizes visuais
* Design minimalista e premium.
* Referência visual em produtos Apple e aplicações financeiras corporativas modernas.
* Azul-marinho corporativo (#0A192F / #0F2744 / #1E3A8A) como cor principal.
* Branco e cinza como cores complementares.
* Tipografia limpa e profissional.
* Sidebar lateral recolhível.
* Ícones discretos (Lucide React).
* Cards com indicadores executivos.
* Tabelas profissionais e densas.
* Gráficos elegantes (Recharts).
* Modais para inclusão e edição.
* Filtros e pesquisas em tempo real.
* Interface responsiva, com foco em desktop.

# 6. ESTRUTURA DE NAVEGAÇÃO E MÓDULOS

Organizar a aplicação com os seguintes módulos acessíveis pela Sidebar:

1. **Dashboard** (SELIC Over, PTAX venda, IPCA mensal e 12m, Cotas de fundos, CDI realizado e projetado, Projeção de caixa, Controle Tecban, status de atualizações com fontes BCB e IBGE).
2. **Gestão das Empresas** (CRUD, Nome fantasia, Razão social, CNPJ com validação oficial, Diretores estatutários com relação N:N, filtros, exportação).
3. **Gestão de Contas Correntes** (Empresa, Banco, Agência, Conta corrente, Limite Intraday Sim/Não com valor obrigatório se Sim, Aplicação automática Sim/Não, Tombamento Sim/Não com conta de destino obrigatória se Sim).
4. **Gestão de Convênios Bancários** (Banco, Empresa, Tipo: Pagfor / Cobrança / Outros, Código do convênio, Gestor do convênio, Conta corrente vinculada às contas da mesma empresa e banco).
5. **Gestão de Acessos Bancários** (Empresa, Banco, Perfil de acesso em texto livre, Nome do usuário, Gestor do usuário. Sem agência/conta).
6. **Indicadores e Taxas** (Séries diárias: CDI a.a., Cotas Baraúna, Carnaúba, Jacarandá, Caliandra, BB Corporate Fácil. Ferramenta de cálculo de remuneração em % CDI com capitalização de 252 dias úteis: (Cota final / Cota base - 1) / CDI acumulado).
7. **Projeção de Caixa** (Empresa, Data, Saldo real, Saídas reais, Entradas reais, Saldo projetado, Saídas projetadas, Entradas projetadas, gráficos comparativos e importação/exportação).
8. **Controle Tecban** (Controle diário com Saldo real, Saques reais, Recargas reais, Saldo projetado, Saques projetados, Recargas projetadas. Tratamento de divisão por zero).
9. **Empréstimos** (Contratos: Empresa, Banco, Início, Vencimento, Valor, Spread a.a., CDI, base 252 dias úteis. Eventos de juros e amortização. Cálculo de juros diário i_op = [(1+CDI)^(1/252) * (1+Spread)^(1/252)] - 1. Segregação de principal e saldo devedor).
10. **Calendário Financeiro** (Feriados bancários FEBRABAN, fins de semana não úteis, regra mandatória: 31 de dezembro é dia útil bancário quando cair em dia de semana).
11. **Bloqueios Judiciais** (Empresa, Banco, Data, Tipo: bloqueio/desbloqueio/transferência, Valor, Processo, Obs. Saldo gerencial = Bloqueios - Desbloqueios. Transferências segregadas).
12. **Mapa de Tarifas** (Nome, Banco, Tipo, Conta corrente, Tarifa unitária, Data de validade).
13. **Contatos Bancários** (Banco, Gerente comercial, Gerente de cash, Gerente operacional com Nome, Telefone e E-mail cada).
14. **Procurações e Procuradores** (Aba Procurações com upload/documento, Empresa, Validade; Aba Procuradores com Nome, E-mail, Tipo: Coordenador, Especialista, Gerente, Gerente executivo, Superintendente, Outro).
15. **Contratos** (Empresa, Nome, Contraparte, Vencimento, alertas e anexos).
16. **Políticas e Normativos** (Upload/documento, Nome, Vencimento).
17. **Manuais e Fluxos** (Upload/arquivo, Nome, Vencimento).
18. **Roteiro Contábil** (Empresa, Banco, Conta, Nome do movimento, Conta contábil).
19. **Divisão de Atividades** (Nome, Atividade, Empresa, Frequência).
20. **Dividendos/JCP** (Upload comprovante, Empresa origem, Empresa destino, Data, Valor, Tipo Dividendos ou JCP).
21. **Central de Planilhas** (Modelos individuais por módulo e Bloco "Todos os modelos" gerando arquivo XLSX consolidado com abas padronizadas, formato brasileiro, vírgula decimal, datas DD/MM/AAAA).
22. **Administração e Auditoria** (Usuários autorizados pelo admin, bloqueio, perfis, e Trilha global de auditoria registrando Usuário, Data/Hora, Módulo, Operação, Valores anteriores e posteriores).
23. **Aprovações** (Inclusão de transações para aprovação: Aplicações/Resgates e Transferências/Pagamentos com contas e aprovadores. Seleção múltipla e botão "Solicitar aprovação" que dispara e-mail via mailto formatado para Outlook com dados detalhados e destinatários, marcando os lançamentos como concluídos).

# REGRAS FINANCEIRAS E DE FORMATAÇÃO
* Formatação brasileira em todo o sistema: Moeda R$ 1.234,56, Percentual 12,34%, Data DD/MM/AAAA, Decimal com vírgula.
* Precisão decimal em cálculos financeiros (utilizar decimal.js ou equivalente).
* Convenção de 252 dias úteis com suporte ao calendário financeiro.

## Execução Local & Armazenamento JSON na Máquina

Este projeto roda 100% de forma local, sem dependência de serviços externos ou nuvem de terceiros. Todos os dados cadastrados, modificados ou importados são gravados diretamente em **arquivos JSON na sua máquina** dentro da pasta `./data/`:

- `./data/companies.json`: Cadastro de empresas
- `./data/company_directors.json`: Relação de diretores estatutários
- `./data/current_accounts.json`: Contas correntes e limites
- `./data/bank_agreements.json`: Convênios bancários
- `./data/bank_accesses.json`: Acessos bancários
- `./data/indicators.json`: Séries históricas de indicadores e cotas
- `./data/cash_projections.json`: Lançamentos de projeção de caixa
- `./data/tecban_records.json`: Controle diário Tecban
- `./data/loan_contracts.json`: Contratos de empréstimos e amortizações
- `./data/financial_holidays.json`: Calendário financeiro FEBRABAN
- `./data/roles.json` e `./data/users.json`: Controle de acesso e usuários
- `./backups/*.json`: Backups completos gerados

### Como rodar na sua máquina:

1. Clone o repositório ou descompacte os arquivos na sua máquina:
```bash
git clone <url-do-repositorio>
cd elo-treasury-compass
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor local:
```bash
npm run dev
```

4. Acesse no navegador:
```
http://localhost:3000
```

Ao realizar qualquer operação (cadastrar empresa, criar empréstimo, lançar projeção), os dados são salvos instantaneamente nos arquivos `.json` na pasta `./data/` do seu computador.
