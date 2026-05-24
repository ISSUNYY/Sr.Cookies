# Plano de Implementação: Integração do Mercado Pago 💳⚡ [CONCLUÍDO]

Este plano define a arquitetura e as tarefas necessárias para integrar os pagamentos reais do **Mercado Pago** no e-commerce **Sr. Cookies**, utilizando as credenciais de teste fornecidas.

---

## 👁️ Visão Geral (Overview)

Substituiremos a simulação financeira básica do PagBem por uma integração robusta e real com a API do **Mercado Pago**.
A solução contemplará:
1. **Checkout Pro (Redirecionamento Seguro)**: Para cartões e saldo Mercado Pago, permitindo checkout simplificado e com alta conversão.
2. **Pix Dinâmico**: Geração de QR Code e código Copia e Cola diretamente na tela do site.
3. **Webhooks / IPN**: Rota dedicada de notificação de pagamentos para atualizar o status no Supabase em tempo real.

---

## 📱 Tipo de Projeto
* **Tipo**: WEB (React + Vite + Supabase backend)
* **Agente Principal**: `backend-specialist` (APIs e Banco) + `frontend-specialist` (Interface e Checkout)

---

## 🎯 Critérios de Sucesso (Success Criteria)

- [x] Criação bem-sucedida de Preferências de Pagamento no backend do Mercado Pago.
- [x] Geração dinâmica de Pix com cópia de chave e exibição de QR Code funcional.
- [x] Atualização automática do status da tabela `orders` para `PAID` assim que o Mercado Pago notificar o Webhook.
- [x] Sem vazamento de chaves privadas (tokens mantidos estritamente sob `.env`).

---

## 🛠️ Stack Tecnológica (Tech Stack)

* **Backend / Edge Functions**: Mercado Pago Node.js SDK (`mercadopago`)
* **Frontend**: Mercado Pago SDK React (`@mercadopago/sdk-react`)
* **Banco de Dados**: Supabase (atualização através de Trigger/Serviço ou webhook direto)

---

## 📁 Estrutura de Arquivos Planejada (File Structure)

```
c:/Projetos/srcookie
├── .env.local                       # [MODIFY] Adicionar chaves públicas e privadas do Mercado Pago
├── docs/
│   └── PLAN-mercado-pago.md         # [NEW] Este arquivo de planejamento
└── src/
    ├── features/
    │   ├── orders/
    │   │   ├── services/
    │   │   │   ├── paymentService.ts # [MODIFY] Atualizar para chamar API do Mercado Pago
    │   │   │   └── mpService.ts      # [NEW] Novo serviço dedicado às requisições do Mercado Pago
    │   │   └── webhook/
    │   │       └── mpNotification.ts # [NEW] Endpoint/serviço para receber notificações do webhook
    │   └── catalog/
    │       └── pages/
    │           └── CheckoutPage.tsx  # [MODIFY] Integrar opções de checkout do Mercado Pago
```

---

## 📝 Divisão de Tarefas (Task Breakdown)

### 🧱 Fase 1: Infraestrutura e Credenciais
* **Tarefa 1.1: Configurar variáveis de ambiente** [CONCLUÍDO]
  * **Agente**: `security-auditor`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P0
  * **INPUT**: Chaves fornecidas (`APP_USR-b483348d-e7d7-4268-ba58-881987342cf4` e `APP_USR-8031810500488798-052318-0be1b24b83aca883358816554baef786-3422205278`)
  * **OUTPUT**: Chaves injetadas em `.env.local` e `.env`
  * **VERIFY**: Executar script de auditoria de secrets local e garantir que o Vite carrega a Public Key como `VITE_MERCADO_PAGO_PUBLIC_KEY`.

* **Tarefa 1.2: Instalação das dependências do Mercado Pago** [CONCLUÍDO]
  * **Agente**: `backend-specialist`
  * **Habilidade**: `nodejs-best-practices`
  * **Prioridade**: P0
  * **INPUT**: Rodar `npm install mercadopago @mercadopago/sdk-react`
  * **OUTPUT**: Modificação do `package.json`
  * **VERIFY**: Rodar `npm run build` para garantir que não há conflito de módulos ou pacotes.

---

### ⚙️ Fase 2: Serviços Backend (API do Mercado Pago)
* **Tarefa 2.1: Criar o mpService no backend** [CONCLUÍDO]
  * **Agente**: `backend-specialist`
  * **Habilidade**: `api-patterns`
  * **Prioridade**: P1
  * **INPUT**: Nova biblioteca `mpService.ts` utilizando a biblioteca oficial do Mercado Pago para inicializar o cliente com o Access Token.
  * **OUTPUT**: Funções `createPreference(orderId, totalAmount)` e `createPixPayment(orderId, totalAmount, userEmail)`.
  * **VERIFY**: Criar script rápido em `scratch/test-mp.js` para bater na API de sandbox do Mercado Pago e retornar um link de checkout e um payload de Pix válidos.

* **Tarefa 2.2: Rota de Webhook para Notificação** [CONCLUÍDO]
  * **Agente**: `backend-specialist`
  * **Habilidade**: `api-patterns`
  * **Prioridade**: P1
  * **INPUT**: Função de webhook que recebe as notificações `payment` do Mercado Pago (com query params `action=payment.created` ou `id` do pagamento).
  * **OUTPUT**: Rota/Endpoint que lê o status do pagamento diretamente da API do Mercado Pago e atualiza a tabela `orders` no Supabase para `PAID` se aprovado.
  * **VERIFY**: Simular chamada HTTP POST contendo um ID de teste na rota de webhook e verificar se o status do pedido foi atualizado corretamente no banco.

---

### 🎨 Fase 3: Experiência do Cliente (Frontend)
* **Tarefa 3.1: Integração no CheckoutPage** [CONCLUÍDO]
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Atualizar a `CheckoutPage.tsx` para carregar o SDK do Mercado Pago React.
  * **OUTPUT**: 
    - Ao selecionar **Crédito/Débito**, gerar a preferência e abrir a modal segura do **Checkout Pro**.
    - Ao selecionar **Pix**, fazer a chamada para `createPixPayment` e renderizar o QR Code real de sandbox retornado e a chave Pix copia e cola real.
  * **VERIFY**: Testar o clique no botão do checkout e garantir que a transição de telas e as modais abram perfeitamente sem erros de layout.

---

## 🏁 Fase X: Plano de Verificação (Verification Plan)

- [x] **Auditoria de Linters**: Rodar `npm run lint && npx tsc --noEmit`.
- [x] **Verificação de Compilação**: Executar `npm run build` para validar todos os bundles.
- [x] **Teste de Sandbox de Ponta a Ponta**: 
  - Fazer uma compra simulada utilizando o **Pix de teste**.
  - Garantir que o Pix retorna o payload e a confirmação é despachada.
  - Testar um checkout simulado em sandbox com os cartões de teste recomendados do Mercado Pago (ex: `4444 3333 2222 1111`).
