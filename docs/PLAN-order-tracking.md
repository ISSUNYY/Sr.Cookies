# Plano de Implementação: Tela de Acompanhamento de Pedidos & Integração WhatsApp 🍪📦

Este plano define a arquitetura, o design e as tarefas necessárias para implementar uma tela de rastreamento de pedidos premium (`/track/:orderId`) no e-commerce **Sr. Cookies**, junto com a integração inteligente de envio de links via WhatsApp na finalização da compra.

---

## 🤖 **Applying knowledge of @[project-planner]...**

---

## 🧠 1. Questões Socráticas (Socratic Gate & Decisões)

Para refinar e garantir o alinhamento com a visão do produto antes da fase de código, definimos as seguintes questões estratégicas:

1. **Número de WhatsApp da Loja vs. Cliente**:
   * *Questão*: A mensagem de WhatsApp com o link de rastreamento deve ser enviada para o número do cliente (gerando um link `https://wa.me/{cliente_phone}`) para ele salvar o rastreamento, ou deve abrir um chat direto com o WhatsApp da loja (`https://wa.me/{loja_phone}`) enviando o ID do pedido para suporte?
   * *Recomendação*: Sugerimos preencher o número do cliente (coletado no checkout) para ele guardar o link em seu próprio chat, com a opção alternativa de chamar a loja se precisar de ajuda.
2. **Mapeamento Amigável de Status**:
   * *Questão*: Para cada status interno (`PENDING`, `PAID`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`), quais mensagens personalizadas e estimativas de tempo devem ser mostradas ao cliente?
   * *Recomendação*:
     * `PENDING`: "Recebemos seu pedido!" (Aguardando confirmação de pagamento).
     * `PAID`: "Pagamento aprovado!" (Pedido na fila de produção).
     * `PREPARING`: "Cookies no forno!" (Massa sendo assada e embalada).
     * `OUT_FOR_DELIVERY`: "Saiu para entrega!" (O entregador está a caminho).
     * `DELIVERED`: "Entregue!" (Aproveite seus cookies quentinhos).
3. **Persistência do Histórico de Transições**:
   * *Questão*: Como devemos registrar os horários de transição para montar a linha do tempo?
   * *Recomendação*: Criar uma tabela dedicada `public.order_status_history` no Supabase com um Trigger automático no banco. Isso garante consistência total de dados, mesmo que o status mude via webhook do Mercado Pago ou painel administrativo, sem sobrecarregar a lógica da aplicação.

---

## 📱 Tipo de Projeto
* **Tipo**: WEB (React + Vite + Supabase Backend)
* **Agente Principal**: `frontend-specialist` (Design Cozy, Layout & Componentes) + `database-architect` (Triggers, Histórico e Schema)

---

## 🎯 Critérios de Sucesso (Success Criteria)

- [ ] Nova rota `/track/:orderId` totalmente responsiva, carregando dados reais do pedido e histórico de status.
- [ ] Interface com visual premium acolhedor (warm cookie palette), usando tons de creme, marrom café e dourado âmbar.
- [ ] Linha do tempo dinâmica com micro-animações (ex: ícone de forno pulsando em `PREPARING` ou moto deslizando em `OUT_FOR_DELIVERY`).
- [ ] Card de Avaliação (Feedback) interativo funcional com sistema de 1 a 5 estrelas e comentários, ativo apenas quando o status for `DELIVERED`.
- [ ] Integração no sucesso do checkout gerando o link do WhatsApp formatado automaticamente com o telefone do cliente e link curto de rastreamento.
- [ ] Zero dependência de mapas externos (conforme especificação, sem Google Maps/Mapbox).

---

## 🛠️ Stack Tecnológica (Tech Stack)

* **Roteamento**: `react-router` (v7)
* **Estilização**: Vanilla CSS (CSS Variables para a paleta cozy e transições de opacidade/transform)
* **Banco de Dados**: Supabase PostgreSQL (Tabela `orders` + Nova tabela `order_status_history` e `order_feedbacks`)
* **Ícones**: Lucide React (`lucide-react`)
* **Notificações**: React Hot Toast (se disponível no projeto) ou toast personalizado no tema da loja.

---

## 💾 2. Plano de Migração do Banco de Dados (Database Schema)

Para suportar o histórico de milestones da linha do tempo e o feedback dos usuários de forma escalável e independente, criaremos as estruturas abaixo.

### Nova Tabela: `public.order_status_history`
Registrará cada mudança de status do pedido de forma cronológica.

```sql
CREATE TABLE public.order_status_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar leitura pública para permitir o rastreamento via ID do pedido
ALTER TABLE public.order_status_history DISABLE ROW LEVEL SECURITY;
```

### Automatização com Trigger (Garantia de Integridade)
Criaremos um Trigger que escuta modificações na tabela `public.orders` e insere o histórico de status de forma transparente.

```sql
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') OR (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.order_status_history (order_id, status, notes)
        VALUES (
            NEW.id, 
            NEW.status, 
            CASE 
                WHEN NEW.status = 'PENDING' THEN 'Pedido criado e aguardando confirmação de pagamento.'
                WHEN NEW.status = 'PAID' THEN 'Pagamento confirmado! Seu pedido entrou na nossa fila de produção.'
                WHEN NEW.status = 'PREPARING' THEN 'Massa fresca e muito chocolate! Seus cookies entraram no forno.'
                WHEN NEW.status = 'OUT_FOR_DELIVERY' THEN 'Cookies quentinhos saindo! O entregador já iniciou o percurso.'
                WHEN NEW.status = 'DELIVERED' THEN 'Entregue! Hora de saborear o melhor cookie da sua vida.'
                ELSE 'Status atualizado para ' || NEW.status
            END
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_order_status_change
AFTER INSERT OR UPDATE OF status ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_status_change();
```

### Nova Tabela: `public.order_feedbacks`
Para salvar as avaliações dos clientes feitas na página de rastreamento.

```sql
CREATE TABLE public.order_feedbacks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Habilitar escrita para os clientes
ALTER TABLE public.order_feedbacks DISABLE ROW LEVEL SECURITY;
```

---

## 🎨 3. Paleta de Cores Cozy Premium & Design System

Implementaremos as seguintes variáveis de CSS em `src/index.css` ou em arquivo isolado de tema para obter a estética de confeitaria premium e acolhedora:

```css
:root {
  --cozy-bg: #FBF9F6;           /* Creme suave e quente */
  --cozy-card: #FFFFFF;         /* Branco puro para contraste de profundidade */
  --cozy-brown-dark: #3E2723;   /* Marrom cacau profundo (contraste altíssimo) */
  --cozy-brown-medium: #6D4C41; /* Chocolate médio */
  --cozy-brown-light: #D7CCC8;  /* Cookie cru / tom pastel */
  --cozy-amber: #D97706;        /* Dourado caramelo (destaque de botões e ativos) */
  --cozy-amber-light: #FEF3C7;  /* Amarelo dourado suave para badges e foco */
  --cozy-success: #4CAF50;      /* Verde menta suave */
  --cozy-success-light: #E8F5E9;/* Fundo verde suave */
  --cozy-shadow: 0 12px 40px rgba(62, 39, 35, 0.05); /* Sombra elegante e quente */
  --cozy-radius: 20px;          /* Bordas super arredondadas e amigáveis */
}
```

---

## 📁 Estrutura de Arquivos Planejada (File Structure)

```
c:/Projetos/srcookie
├── docs/
│   └── PLAN-order-tracking.md             # [NEW] Este plano de implementação
├── supabase/
│   └── migrations/
│       └── 20260523204000_order_tracking.sql # [NEW] Migration de tabelas, triggers e permissões
└── src/
    ├── app/
    │   └── routes/
    │       └── index.tsx                  # [MODIFY] Registrar rota '/track/:orderId'
    └── features/
        ├── orders/
        │   ├── components/
        │   │   ├── TrackingProgressBar.tsx# [NEW] Componente de barra de progresso horizontal animada
        │   │   ├── TrackingTimeline.tsx   # [NEW] Componente da linha do tempo vertical com milestones
        │   │   ├── FeedbackCard.tsx       # [NEW] Card de avaliação interativo (estrelas + comentário)
        │   │   └── WhatsAppButton.tsx     # [NEW] Componente de link rápido para o WhatsApp
        │   ├── pages/
        │   │   └── OrderTrackingPage.tsx  # [NEW] Página principal do acompanhamento (/track/:orderId)
        │   └── styles/
        │       └── tracking.css           # [NEW] Estilo completo da experiência Cozy Premium
        └── checkout/
            └── components/
                └── SuccessModal.tsx       # [MODIFY] Integrar o botão de rastreamento e WhatsApp
```

---

## 📝 4. Divisão de Tarefas (Task Breakdown)

### 💾 Fase 1: Banco de Dados e Migração (P0)
* **Tarefa 1.1: Criar Migration PostgreSQL**
  * **Agente**: `database-architect`
  * **Habilidade**: `database-design`
  * **Prioridade**: P0
  * **INPUT**: Definição da tabela `order_status_history`, `order_feedbacks` e da Trigger.
  * **OUTPUT**: Arquivo `supabase/migrations/20260523204000_order_tracking.sql`.
  * **VERIFY**: Executar o script de criação no Supabase local/remoto e testar a trigger inserindo um pedido simulado na tabela `orders`.

* **Tarefa 1.2: Atualizar Interfaces do TypeScript**
  * **Agente**: `backend-specialist`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P0
  * **INPUT**: Arquivos em `src/features/orders/types/index.ts` e `orderService.ts`.
  * **OUTPUT**: Tipagens atualizadas incluindo `OrderStatusHistory` e novos métodos em `orderService.ts` (`getOrderWithHistory`, `submitOrderFeedback`).
  * **VERIFY**: Garantir compilação com `npx tsc --noEmit`.

---

### 🎨 Fase 2: Componentes da Tela de Rastreamento (P1)
* **Tarefa 2.1: Criar Layout da Página de Rastreamento (`OrderTrackingPage.tsx`)**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P1
  * **INPUT**: Novo arquivo `OrderTrackingPage.tsx` e `tracking.css` sob a paleta de cores Cozy Premium.
  * **OUTPUT**: Página base carregando as informações gerais do pedido (número, endereço, valor total) com tratamento elegante para estados de carregamento (Skeleton screens) e erro (Pedido não encontrado).
  * **VERIFY**: Abrir a página no navegador com um ID de teste e verificar a responsividade e leitura em dispositivos móveis.

* **Tarefa 2.2: Implementar a Barra de Progresso Horizontal (`TrackingProgressBar.tsx`)**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P1
  * **INPUT**: Desenho dos 5 estados (`PENDING`, `PAID`, `PREPARING`, `OUT_FOR_DELIVERY`, `DELIVERED`) com ícones da biblioteca `lucide-react` (ex: `Clock`, `CreditCard`, `Flame`, `Bike`, `CheckCircle2`).
  * **OUTPUT**: Componente visual que conecta os pontos com uma linha contínua que preenche gradativamente conforme o status atual.
  * **VERIFY**: Alternar o status do pedido manualmente e validar visualmente se a barra se preenche corretamente de forma suave.

* **Tarefa 2.3: Desenvolver a Linha de Tempo Vertical (`TrackingTimeline.tsx`)**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Histórico cronológico retornado do banco (`order_status_history`).
  * **OUTPUT**: Linha de tempo vertical mostrando a hora exata (formatada amigavelmente: `14:32`) e o título/descrição do status daquele ponto.
  * **VERIFY**: Validar se o ordenamento está correto (do mais antigo para o mais recente ou vice-versa).

* **Tarefa 2.4: Implementar Card de Feedback Estelar (`FeedbackCard.tsx`)**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `frontend-design`
  * **Prioridade**: P2
  * **INPUT**: Exibição condicional baseada no status do pedido igual a `DELIVERED`.
  * **OUTPUT**: Interface interativa de 5 estrelas com efeito hover dourado, campo de texto para opinião, animação de envio e persistência no banco na tabela `order_feedbacks`.
  * **VERIFY**: Submeter um feedback e verificar se o registro aparece na tabela e o card entra em estado de agradecimento.

---

### 💬 Fase 3: Integração de Checkout & WhatsApp (P1)
* **Tarefa 3.1: Envio Automático / Botão WhatsApp na Confirmação**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P1
  * **INPUT**: Modificar o componente `SuccessModal.tsx` ou redirecionamento de sucesso de checkout.
  * **OUTPUT**: Adicionar botão chamativo no tema cozy: "Receber Rastreamento no WhatsApp 💬".
  * **Lógica do WhatsApp**:
    * Gerar a URL dinâmica usando a API do WhatsApp:
      `https://api.whatsapp.com/send?phone=${phoneCliente}&text=${encodeURIComponent(mensagem)}`
    * Mensagem modelo:
      `Olá! Seu pedido na *Sir. Cookies* foi confirmado com sucesso! 🍪✨\n\nAcompanhe a preparação e a entrega do seu pedido em tempo real clicando no link abaixo:\n👉 https://srcookie.com/track/${orderId}`
  * **VERIFY**: Clicar no botão e verificar se abre a página do WhatsApp Web/App com a mensagem preenchida perfeitamente formatada e o link correto.

* **Tarefa 3.2: Registrar a rota `/track/:orderId` no roteador**
  * **Agente**: `frontend-specialist`
  * **Habilidade**: `clean-code`
  * **Prioridade**: P1
  * **INPUT**: Editar `src/app/routes/index.tsx`.
  * **OUTPUT**: Inserção do path `track/:orderId` com import dinâmico (`lazy`).
  * **VERIFY**: Acessar diretamente `/track/123` e ver se renderiza corretamente o componente sem travar a navegação.

---

## 🏁 5. Fase X: Plano de Verificação e Auditoria (Verification Plan)

### Verificações de Código e Padrões
- [ ] **Linters & Tipagem**: Rodar os comandos para garantir conformidade total:
  ```powershell
  npm run lint
  npx tsc --noEmit
  ```
- [ ] **Compilação de Produção**:
  ```powershell
  npm run build
  ```
- [ ] **UX / Acessibilidade (Auditoria UX)**:
  * Executar a verificação de contraste de cores (especialmente nos tons marrons/cremes/dourado) e garantir o contraste mínimo de **4.5:1** (WCAG AA).
  * Executar o script UX Audit:
    ```powershell
    python .agent/skills/frontend-design/scripts/ux_audit.py .
    ```
  * **Purple Ban (Proibição de Roxo)**: Validar manualmente que nenhum tom de roxo/violeta foi utilizado no design (mantendo a paleta quente de chocolate e caramelo).

### Teste de Fluxo Ponta a Ponta (End-to-End Manual)
1. Fazer um pedido no site e finalizar a compra.
2. Na tela de sucesso, verificar se a modal/toast exibe o botão do WhatsApp com o link dinâmico correto contendo o ID do pedido.
3. Copiar o link de rastreamento e abrir no navegador.
4. Acessar o painel administrativo (`/admin/orders`) em outra janela.
5. Alterar o status do pedido para `PREPARING` -> Verificar se a linha de tempo do cliente atualiza instantaneamente.
6. Alterar o status para `OUT_FOR_DELIVERY` -> Verificar animações de trânsito.
7. Alterar o status para `DELIVERED` -> Verificar surgimento do Card de Feedback.
8. Submeter o feedback com 5 estrelas e um comentário de teste -> Verificar inserção no banco de dados.

---

## ✅ FASE X COMPLETE
- Lint: [ ] Pending
- Security: [ ] Pending
- Build: [ ] Pending
- Date: 2026-05-23
