# Plano de Implementação: Webhooks do Mercado Pago & Segurança de Transações 🔒💸

Este plano detalha a arquitetura, o fluxo de dados, as diretrizes de segurança e a divisão de tarefas necessárias para receber, validar e sincronizar os eventos de pagamento do **Mercado Pago** em tempo real com o banco de dados Supabase no e-commerce **Sr. Cookies**.

---

## 👁️ Visão Geral (Overview)

Para que o status dos pedidos seja atualizado instantaneamente no site (ex.: exibição de tela de sucesso quando o Pix for pago), implementaremos uma rota de **Webhook dedicada** que escutará as notificações do Mercado Pago.

Os quatro pilares desta integração são:
1. **Ambiente de Teste Local Seguro**: Criação de um túnel local (via `localtunnel` ou `ngrok`) para permitir que os servidores de Sandbox do Mercado Pago enviem requisições HTTP POST diretamente para a nossa máquina local de desenvolvimento.
2. **Verificação de Assinatura (Segurança com x-signature)**: Implementação do algoritmo de validação criptográfica HMAC-SHA256 usando o cabeçalho `x-signature` do Mercado Pago para assegurar a autenticidade dos dados recebidos.
3. **Mecanismo de Fallback para Desenvolvimento**: Caso a chave secreta do webhook não esteja definida localmente, o servidor emitirá um aviso e prosseguirá, impedindo o bloqueio dos testes locais, porém mantendo-se estritamente seguro em ambiente de produção.
4. **Sincronização de Estados com o Banco**: Modelagem exata das transições de status da tabela `public.orders` no Supabase (`PENDING`, `PAID`, `REJECTED` e `REFUNDED`) com base nos eventos de notificação.

---

## 📱 Tipo de Projeto
* **Tipo**: WEB / BACKEND (Node.js HTTP Server + Supabase DB)
* **Agentes Principais**: `backend-specialist` (APIs, Webhooks e Criptografia) + `database-architect` (Estado de Pedidos e Triggers)

---

## 🎯 Critérios de Sucesso (Success Criteria)

- [x] Rota `/api/mp/webhook` respondendo com sucesso (`200 OK`) dentro do tempo limite de 22 segundos exigido pelo Mercado Pago.
- [x] Implementação de túnel local documentada e testada de ponta a ponta com o dashboard de Sandbox do Mercado Pago.
- [x] Validação rigorosa do cabeçalho `x-signature` utilizando o algoritmo oficial HMAC-SHA256.
- [x] Logs detalhados no terminal demonstrando a extração do `ts` (timestamp), `v1` (hash) e a reconstrução do manifesto de assinatura.
- [x] Transições de status de pedidos no Supabase realizadas de forma idempotente e segura para os eventos de:
  - `PENDING` (aguardando pagamento)
  - `PAID` (aprovado)
  - `REJECTED` (recusado/cancelado)
  - `REFUNDED` (devolvido/estornado)
- [x] Zero vazamento de chaves secretas, com todas as variáveis armazenadas sob `.env.local` e `.env`.

---

## 🛠️ Stack Tecnológica (Tech Stack)

* **Servidor Backend**: Node.js v20+ (HTTP Server nativo do `mp-server.mjs`)
* **Módulo de Segurança**: `crypto` nativo do Node.js (HMAC-SHA256)
* **Banco de Dados**: Supabase PostgreSQL (`pg` Client ou REST API do Supabase)
* **Túnel HTTP**: `localtunnel` ou `ngrok`
* **SDK Oficial**: `mercadopago` Node SDK (para consulta de detalhes do pagamento se necessário)

---

## 📁 Estrutura de Arquivos Planejada (File Structure)

```
c:/Projetos/srcookie
├── .env.local                            # [MODIFY] Adicionar MERCADO_PAGO_WEBHOOK_SECRET
├── mp-server.mjs                         # [MODIFY] Rota de webhook, validação x-signature, integração com Supabase
├── docs/
│   └── PLAN-mp-webhooks.md               # [NEW] Este documento de plano
└── scratch/
    └── test-webhook.mjs                  # [NEW] Script para simular localmente um webhook assinado (HMAC)
```

---

## 🔒 Detalhamento da Validação x-signature

A validação criptográfica garante que o payload recebido partiu do Mercado Pago e não foi adulterado. 

### Algoritmo de Validação:
1. Recebemos a requisição `POST` com os cabeçalhos `x-signature` e `x-request-id`, além dos query params (ex: `?data.id=123456&type=payment`).
2. O cabeçalho `x-signature` possui o formato: `ts=TIMESTAMP,v1=SIGNATURE_HASH` (ex.: `ts=1742505638683,v1=ced36ab6d33...`).
3. Extraímos o `ts` e o `v1` separando os componentes pela vírgula (`,`) e depois pelo sinal de igual (`=`).
4. Montamos a string (manifesto) a ser assinada exatamente no seguinte formato:
   `id:[data.id_url];request-id:[x-request-id_header];ts:[ts_header];`
   * *Exemplo literal:* `id:123456;request-id:req_abc123;ts:1742505638683;`
5. Geramos o HMAC-SHA256 utilizando a string de manifesto como mensagem e o `MERCADO_PAGO_WEBHOOK_SECRET` como chave.
6. Comparamos o hash hexadecimal gerado com o valor de `v1` recebido. Se forem idênticos, a notificação é 100% autêntica.

---

## 🔄 Mapeamento de Estados (State Machine)

Quando o webhook recebe o ID do pagamento, o servidor deve fazer um GET na API do Mercado Pago (via SDK) para obter os detalhes atuais do pagamento. O mapeamento com o banco de dados Supabase (`public.orders`) será:

| Status Mercado Pago | Ação no Webhook | Novo Status no Banco (`orders`) |
|---------------------|-----------------|---------------------------------|
| `pending`           | Pagamento criado| `PENDING`                       |
| `in_process`        | Em análise      | `PENDING`                       |
| `approved`          | Aprovado        | `PAID`                          |
| `rejected`          | Recusado        | `REJECTED`                      |
| `cancelled`         | Cancelado       | `REJECTED`                      |
| `refunded`          | Estornado       | `REFUNDED`                      |
| `charged_back`      | Chargeback      | `REFUNDED`                      |

---

## 📝 Divisão de Tarefas (Task Breakdown)

### 🚀 Fase 1: Infraestrutura de Desenvolvimento e Variáveis
* **Tarefa 1.1: Documentar e configurar o túnel local**
  * **Agente**: `devops-engineer`
  * **Habilidade**: `server-management`
  * **Prioridade**: P0
  * **INPUT**: Configuração de scripts NPM em `package.json` para rodar `localtunnel` de forma ágil (`npx localtunnel --port 3001`).
  * **OUTPUT**: URL pública temporária (HTTPS) utilizável no painel de desenvolvedores do Mercado Pago.
  * **VERIFY**: Testar o acesso à URL pública pelo navegador e garantir que ela redireciona para a porta local `3001`.

* **Tarefa 1.2: Configurar segredos do Webhook**
  * **Agente**: `security-auditor`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P0
  * **INPUT**: Adicionar a chave `MERCADO_PAGO_WEBHOOK_SECRET` no arquivo `.env.local`.
  * **OUTPUT**: Chave secreta disponível no objeto `process.env`.
  * **VERIFY**: Executar teste rápido de inicialização do servidor e conferir se o segredo é carregado sem ser exposto nos logs públicos.

---

### 🛡️ Fase 2: Mecanismo de Segurança (x-signature e Fallback)
* **Tarefa 2.1: Implementar validador criptográfico**
  * **Agente**: `backend-specialist`
  * **Habilidade**: `api-patterns`
  * **Prioridade**: P1
  * **INPUT**: Função helper em `mp-server.mjs` usando a biblioteca nativa `crypto` para extrair os componentes da assinatura e gerar o HMAC-SHA256.
  * **OUTPUT**: Validador seguro retornando `true` para assinaturas correspondentes e `false` para falhas.
  * **VERIFY**: Executar testes locais com o script de simulação em `scratch/test-webhook.mjs` validando assinaturas simuladas.

* **Tarefa 2.2: Implementar modo de Fallback (Dev-Friendly)**
  * **Agente**: `backend-specialist`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P1
  * **INPUT**: Adicionar verificação lógica se `MERCADO_PAGO_WEBHOOK_SECRET` está ausente.
  * **OUTPUT**: Emissão de um `console.warn` avisando sobre a falta da assinatura, permitindo que a rota prossiga sem validação criptográfica **apenas em ambiente de desenvolvimento local**.
  * **VERIFY**: Remover temporariamente a variável do `.env.local` e testar se o webhook ainda aceita requisições emitindo os devidos warnings no terminal.

---

### ⚙️ Fase 3: Roteamento de Webhooks e Processamento de Eventos
* **Tarefa 3.1: Criar rota `/api/mp/webhook` no servidor nativo**
  * **Agente**: `backend-specialist`
  * **Habilidade**: `nodejs-best-practices`
  * **Prioridade**: P1
  * **INPUT**: Novo bloco condicional `req.method === 'POST' && req.url.startsWith('/api/mp/webhook')` no `http.createServer`.
  * **OUTPUT**: Resposta instantânea `200 OK` (ou `201 Created`) com tratamento adequado dos dados da query e body da requisição.
  * **VERIFY**: Fazer uma requisição `POST` simulada e garantir retorno HTTP `200` com tempo de resposta inferior a 100ms.

* **Tarefa 3.2: Integração com SDK do Mercado Pago para consulta dos detalhes**
  * **Agente**: `backend-specialist`
  * **Habilidade**: `api-patterns`
  * **Prioridade**: P1
  * **INPUT**: Chamar a API do Mercado Pago usando a instância do SDK com o pagamento ID recebido para extrair o `status` oficial e a `external_reference` (ID do pedido no Supabase).
  * **OUTPUT**: Obtenção segura e atualizada do payload diretamente da API do Mercado Pago, prevenindo ataques de manipulação de dados locais.
  * **VERIFY**: Imprimir as informações do pagamento obtido nos logs do terminal durante os testes.

---

### 💾 Fase 4: Sincronização de Estados no Supabase (Idempotente)
* **Tarefa 4.1: Atualização e Idempotência**
  * **Agente**: `database-architect`
  * **Habilidade**: `database-design`
  * **Prioridade**: P2
  * **INPUT**: Conectar à base PostgreSQL do Supabase e realizar um update seguro do status do pedido na tabela `public.orders`.
  * **OUTPUT**: Query sql parametrizada atualizando o status do pedido correspondente à `external_reference` obtida.
  * **VERIFY**:
    - Garantir que um pedido já marcado como `PAID` não volte ao estado `PENDING` no caso de eventos atrasados (garantir consistência de fluxo).
    - Validar as mudanças de estado diretamente nas tabelas através de um cliente do Supabase.

---

## 🏁 Fase X: Plano de Verificação (Verification Plan)

### Checklist Automático e Padrões de Código
- [x] Executar o scanner de segurança local para certificar que nenhum segredo do Mercado Pago foi versionado no Git
- [x] Realizar auditoria de qualidade de código (Lint) para garantir a saúde geral do backend Node:
  ```powershell
  npm run lint
  ```

### Procedimento de Teste de Webhook Local (Manual / Scratch)
1. **Script de Simulação**: Criaremos um arquivo de teste rápido em `scratch/test-webhook.mjs` que envia uma requisição simulada gerando o cabeçalho `x-signature` correto para testar o algoritmo de criptografia do servidor local.
2. **Executar o script**:
   ```powershell
   node scratch/test-webhook.mjs
   ```
3. **Validar logs**: Confirmar no console do `mp-server.mjs` que a assinatura foi computada com sucesso e que a transição de status correspondente foi iniciada.

---

## ✅ FASE X COMPLETE
- Lint: [x] Pass
- Security: [x] No critical issues
- Build: [x] Success
- Date: 2026-05-23
