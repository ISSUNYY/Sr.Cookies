# Plano de Implementação: Fluxo iFood & Geolocalização 📱🍕

Este plano define as modificações de banco de dados, design de interface e recursos de geolocalização necessários para aproximar a experiência de Checkout e Login do **Sr. Cookies** do fluxo real do **iFood**.

---

## 👁️ Visão Geral (Overview)

Aprimoraremos o design global do E-commerce para emular o fluxo do **iFood**:
1. **Banco de Dados**: Correção imediata do erro de coluna de cache de esquema no Supabase (`shipping_address` e `price`).
2. **Design iFood (Sacola e Pagamento)**:
   - Sacola dividida entre abas "Pagar pelo App" (Pix e Cartão Online) e "Pagar na Entrega" (Dinheiro e Cartões na maquininha).
   - Inserção de campos de troco para pagamentos em dinheiro.
   - Detalhamento de taxas (Subtotal, Taxa de serviço R$ 0,99, Total).
3. **Geolocalização (GPS)**:
   - Adicionar botão "📍 Usar minha localização" para ler o GPS do celular.
   - Integrar geocodificação reversa via OpenStreetMap API (gratuita e sem chaves) para preencher Rua, CEP e Bairro automaticamente.
   - Cidade e Estado travados por padrão como `Macaé - RJ`.
4. **Tela de Login Otimizada**:
   - Layout minimalista, focado e elegante, eliminando barreiras visuais e simplificando o cadastro.

---

## 📱 Tipo de Projeto
* **Tipo**: WEB (React + Vite + Supabase backend)
* **Agentes Principais**: `frontend-specialist` (Interface e UX) + `backend-specialist` (Banco e Integrações)

---

## 🎯 Critérios de Sucesso (Success Criteria)

- [ ] Correção do erro de envio do Supabase.
- [ ] Obtenção de coordenadas geográficas via GPS e preenchimento de endereço em Macaé, RJ.
- [ ] Estrutura de pagamento com abas "Pagar pelo App" e "Pagar na Entrega" no formato do iFood.
- [ ] Login e Cadastro limpos e atraentes inspirados no aplicativo oficial.

---

## 📁 Estrutura de Arquivos Planejada (File Structure)

```
c:/Projetos/srcookie
├── docs/
│   └── PLAN-ifood-checkout.md         # [NEW] Este arquivo de planejamento
├── create_orders.mjs                  # [MODIFY] Corrigir schema das tabelas orders/order_items
└── src/
    ├── features/
    │   ├── auth/
    │   │   └── pages/
    │   │       ├── LoginPage.tsx      # [MODIFY] Simplificar e modernizar layout
    │   │       └── SignupPage.tsx     # [MODIFY] Alinhar com novo design
    │   ├── admin/
    │   │   └── pages/
    │   │       └── OrdersManagement.tsx # [MODIFY] Exibir informações de troco nas entregas
    │   └── catalog/
    │       ├── pages/
    │       │   └── CheckoutPage.tsx   # [MODIFY] Geolocalização, cidades travadas e abas de pagamento do iFood
    │       └── styles/
    │           └── checkout.css       # [MODIFY] Estilos para o novo layout de abas e geolocalização
```

---

## 📝 Divisão de Tarefas (Task Breakdown)

### 🧱 Fase 0: Correção do Schema do Banco de Dados
* **Tarefa 0.1: Alinhar colunas das tabelas public.orders e public.order_items**
  * **Agente**: `database-architect`
  * **Habilidade**: `database-design`
  * **Prioridade**: P0
  * **INPUT**: Modificar `create_orders.mjs` para usar `shipping_address JSONB` (em vez de `delivery_address TEXT`) e `price NUMERIC` (em vez de `price_at_time NUMERIC`) em `order_items`.
  * **OUTPUT**: Executar `node create_orders.mjs` para atualizar o banco de dados Supabase real.
  * **VERIFY**: Realizar consulta rápida pelo Supabase para confirmar a existência das novas colunas `shipping_address` e `price`.

---

### 📍 Fase 1: Geolocalização e Cidade Padrão
* **Tarefa 1.1: Localização via GPS do celular**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P1
  * **INPUT**: Adicionar botão "Usar minha localização" e implementar a API `navigator.geolocation.getCurrentPosition`.
  * **OUTPUT**: Integração com a API Nominatim (OpenStreetMap) para traduzir latitude/longitude em Rua, CEP e Bairro.
  * **VERIFY**: Simular geolocalização no navegador e conferir se os campos são preenchidos instantaneamente.

* **Tarefa 1.2: Travar Cidade Macaé por padrão**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P1
  * **INPUT**: Ocultar ou desabilitar o campo Cidade na `CheckoutPage.tsx` e injetar por padrão `"Macaé"` e `"RJ"`.
  * **OUTPUT**: Remoção de inputs desnecessários no formulário.
  * **VERIFY**: Conferir que o payload enviado para o Supabase contém Macaé/RJ mesmo sem o usuário digitar.

---

### 💳 Fase 2: Área de Pagamento iFood e Troco
* **Tarefa 2.1: Abas de Pagamento (Pagar pelo App vs Pagar na Entrega)**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Criar abas principais no formulário de checkout.
  * **OUTPUT**:
    - **Pagar pelo App**: Opções de Pix (com cópia rápida) e Cartão de Crédito (via link Mercado Pago).
    - **Pagar na Entrega**: Opções de Dinheiro e Maquininha (Crédito/Débito).
  * **VERIFY**: Clicar nas abas e validar a transição perfeita de layouts.

* **Tarefa 2.2: Campo de Troco para Dinheiro**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Ao selecionar "Dinheiro", renderizar pergunta "Precisa de troco?" com sim/não e um input para o valor.
  * **OUTPUT**: Dados de troco salvos no JSON de `shipping_address` para exibição no painel administrativo do restaurante.
  * **VERIFY**: Abrir o Painel Admin do funcionário e garantir que a informação de troco seja legível para pedidos pagos em dinheiro.

---

### 🔑 Fase 3: Login Simplificado iFood Style
* **Tarefa 3.1: Redesign da tela de Login e Registro**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Refatorar `LoginPage.tsx` e `SignupPage.tsx`.
  * **OUTPUT**: Layout minimalista com botões grandes de login social (Google) no topo, seguidos por uma divisória sutil e campos de e-mail e senha limpos.
  * **VERIFY**: Rodar a compilação do bundle final do Vite para garantir zero problemas de tipagem ou de carregamento.

---

## 🏁 Fase X: Plano de Verificação (Verification Plan)

- [ ] **TypeScript e Linters**: `npx tsc --noEmit`.
- [ ] **Auditoria de UX**: Validar o fluxo de compras de ponta a ponta sem vazamentos.
- [ ] **Teste de Webhook com Troco**: Fazer pedido com troco em dinheiro e verificar se o painel admin reflete a necessidade de troco.
