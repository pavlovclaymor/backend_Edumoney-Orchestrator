# Guia de Arquitetura Financeira do Edumoney Backend

Este documento tem como objetivo explicar, de forma prática e objetiva, como funciona a camada financeira do backend do Edumoney para que outros desenvolvedores possam usar isso como base para prototipar projetos financeiros semelhantes.

## 1. Visão geral

A parte financeira do sistema foi organizada em torno de um ponto único de entrada: o FinancialOrchestrator.

A ideia central é simples:

- toda movimentação de dinheiro passa pelo orchestrator;
- carteira, transação e ledger não devem ser manipulados diretamente em controllers ou serviços;
- cada operação financeira é executada de forma atômica, com rollback em caso de erro;
- eventos são emitidos para desacoplar notificações, auditoria e integrações.

Essa abordagem ajuda a manter:

- consistência dos saldos;
- rastreabilidade das operações;
- segurança contra uso indevido de métodos financeiros;
- base para evoluir para um modelo mais robusto de pagamentos, split e reconciliação.

---

## 2. Arquitetura principal

Os componentes principais são:

- Wallet: representa a carteira do usuário, comerciante, escola ou outro agente financeiro.
- Transaction: registra a transação de negócio e serve como audit trail.
- Ledger: guarda os registros detalhados de entradas e saídas por usuário.
- FinancialOrchestrator: ponto central para executar qualquer operação financeira.
- FinancialEnforcementEngine: bloqueia operações financeiras fora do orchestrator.
- EventBus: publica eventos para workers e integrações.

### Estrutura relevante

- src/core/financial/FinancialOrchestrator.js
- src/core/financial/FinancialEnforcementEngine.js
- src/core/financial/EnforcedWallet.js
- src/core/financial/EnforcedLedger.js
- src/core/financial/EnforcedTransaction.js
- src/models/wallet.js
- src/models/transaction.js
- src/models/ledger.model.js
- src/services/finance.service.js
- src/services/payment.service.js
- src/controllers/cashout.controller.js

---

## 3. Modelo de dados financeiro

### 3.1 Wallet

A carteira é o saldo real disponível para um owner.

Campos principais:

- ownerId: identificador do dono da carteira;
- ownerModel: tipo do dono (User, Merchant, School);
- balance: saldo atual;
- currency: moeda (AOA por padrão);
- totalCredits: somatório de créditos;
- totalDebits: somatório de débitos;
- lastTransactionAt: data da última movimentação.

Métodos principais:

- credit(amount): adiciona saldo;
- debit(amount): subtrai saldo se houver fundos suficientes.

Importante:

- a carteira não deve ser alterada diretamente fora do orchestrator;
- em projetos prototipados, esse modelo pode ser substituído por uma conta contábil mais sofisticada.

### 3.2 Transaction

A transação representa a operação de negócio registrada para auditoria.

Exemplos de tipos:

- payment
- recharge
- cashout
- transfer

Ela funciona como um histórico de alto nível para rastrear o que aconteceu.

### 3.3 Ledger

O ledger é o registro contábil detalhado.

Cada entrada possui:

- transactionId
- userId
- type: debit ou credit
- amount
- balanceAfter

Ele é essencial para reconciliação e auditoria.

---

## 4. Papel do FinancialOrchestrator

O FinancialOrchestrator é o coração financeiro da aplicação.

Ele atua como:

- single source of truth para todas as operações financeiras;
- executor atômico de transações;
- coordenador entre carteira, transação, ledger e eventos;
- camada de segurança que impede mutações financeiras ilegais.

### Como ele funciona

O método principal é:

- FinancialOrchestrator.execute({ type, payload, session })

Ele:

1. inicia uma sessão MongoDB;
2. cria uma transação de banco quando necessário;
3. habilita o contexto do orchestrator;
4. chama o handler correspondente ao tipo;
5. faz commit ou rollback;
6. emite eventos de sucesso ou falha.

### Tipos suportados

Atualmente há suporte para:

- TRANSFER
- INVOICE_PAYMENT
- INVOICE_CREATION
- RECHARGE
- QR_PAYMENT
- SCHOOL_PAYMENT
- CASHOUT

---

## 5. Fluxos financeiros principais

### 5.1 Transferência entre usuários

Fluxo:

1. valida PIN do remetente;
2. busca as duas carteiras;
3. verifica saldo do remetente;
4. debita na carteira do remetente;
5. credita na carteira do destinatário;
6. cria a transação;
7. cria os ledger entries;
8. emite eventos de wallet.

Uso típico:

- transferência entre estudantes;
- pagamentos entre usuários internos.

### 5.2 Pagamento de invoice

Fluxo:

1. valida usuário e PIN;
2. bloqueia a invoice para evitar pagamento duplicado;
3. verifica saldo do cliente;
4. debita da carteira do estudante;
5. credita na carteira do comerciante;
6. marca a invoice como paga;
7. cria transaction e ledger entries;
8. emite evento de pagamento concluído.

Esse fluxo é o mais importante para o caso de uso do sistema comercial e pode servir de base para marketplaces e cobranças por cobrança.

### 5.3 Recarga

Fluxo:

1. busca a recarga pelo ID;
2. valida a existência da recarga;
3. credita a carteira do usuário;
4. cria a transação;
5. cria o ledger entry;
6. emite evento de recarga concluída.

### 5.4 Pagamento QR

Fluxo:

1. valida usuário e PIN;
2. usa o processTransaction como mecanismo interno de débito/crédito;
3. cria transação e atualiza saldos;
4. emite eventos para notificação e integração.

### 5.5 Pagamento para escola

Fluxo:

1. valida o RUPE pendente;
2. processa pagamento da escola via orchestrator;
3. atualiza o estado do RUPE para pago;
4. emite eventos de pagamento concluído.

### 5.6 Cashout

Fluxo:

1. valida comerciante, escola e saldo;
2. calcula fee da escola;
3. debita o valor total da carteira do comerciante;
4. credita a fee na carteira da escola;
5. cria transações de audit;
6. cria ledger entries;
7. emite eventos para notificações e auditoria.

Esse fluxo é muito útil para projetos com saque para conta bancária, split de comissão e cobrança de taxas.

---

## 6. Como a segurança financeira é aplicada

A aplicação usa um mecanismo de enforcement para impedir o uso indevido das operações financeiras.

### 6.1 FinancialEnforcementEngine

Este módulo define regras claras:

- direct wallet.debit() é proibido;
- direct wallet.credit() é proibido;
- direct Transaction.create() é proibido;
- direct Ledger.create() é proibido;

A ideia é garantir que qualquer movimentação financeira passe por uma única camada autorizada.

### 6.2 Contexto do orchestrator

Quando o FinancialOrchestrator entra em operação, ele habilita um contexto especial.

Somente nesse contexto as operações financeiras são permitidas.

Isso reduz muito o risco de inconsistência e de bugs em cenários complexos.

---

## 7. Event-driven architecture

O sistema também usa eventos para desacoplar operações.

### EventBus

O EventBus centraliza a emissão de eventos como:

- wallet.credited
- wallet.debited
- transaction.completed
- payment.completed
- ledger.created
- invoice.paid

### Por que isso é útil

- workers podem reagir a eventos sem acoplar diretamente o fluxo principal;
- notificações podem ser enviadas sem mexer na lógica financeira;
- pdf workers, socket workers e audit workers podem ser adicionados facilmente.

---

## 8. Como o fluxo é chamado na aplicação

Os serviços chamam o orchestrator em vez de mexer diretamente nas entidades financeiras.

Exemplos:

- payment.service.js usa FinancialOrchestrator.execute para invoice payment;
- wallet.service.js usa FinancialOrchestrator.execute para recarga;
- transaction.service.js usa FinancialOrchestrator.execute para transferências;
- cashout.controller.js usa FinancialOrchestrator.execute para saque.

Esse padrão é o mais importante para reuso e padronização.

---

## 9. Padrões recomendados para prototipação

Ao usar esse backend como base para outros projetos financeiros, o caminho mais recomendado é:

### 9.1 Mantenha o orchestrator como porta de entrada

Se o projeto tiver novos tipos de movimento financeiro, adicione um novo handler no FinancialOrchestrator e um novo tipo em TRANSACTION_TYPE.

### 9.2 Preserve o modelo de três camadas

- camada de negócio: orchestrator;
- camada de persistência: wallet/transaction/ledger;
- camada de eventos: event bus + workers.

### 9.3 Use ledger como base de auditoria

Se for preciso reconciliar contas, o ledger é o lugar ideal para ter a verdade contábil.

### 9.4 Separe operações de pagamento e operações de conta

Em projetos maiores, vale separar:

- payment execution;
- settlement;
- payout;
- fee distribution;
- reconciliation.

### 9.5 Adapte para múltiplas moedas e contas

Hoje o sistema usa AOA e uma conta simples por owner. Para projetos mais ricos, pode evoluir para:

- multicurrency;
- contas de reserva;
- split de pagamentos;
- comissões por parceiro;
- regras de saque com limites.

---

## 10. Pontos fortes da implementação atual

- centralização das regras financeiras;
- transações atômicas;
- ledger para auditoria;
- eventos para integração;
- separação clara entre negócio e persistência;
- boa base para evolução para um sistema financeiro mais completo.

---

## 11. Limitações e cuidados

Alguns pontos merecem atenção:

- o ledger atual aceita apenas tipos debit/credit;
- a lógica de cashout ainda depende de gateway externo e validações específicas;
- a arquitetura é forte como base, mas pode precisar de refinamentos para regulação, reconciliação avançada e múltiplos níveis de conta.
- em produção, seria recomendável evoluir para:
  - idempotency mais robusta;
  - filas de processamento;
  - retry com backoff;
  - auditoria detalhada por conta e por parceiro;
  - suporte a contas e subcontas.

---

## 12. Como estender para novos fluxos financeiros

Exemplo de extensão:

1. adicionar um novo tipo em TRANSACTION_TYPE;
2. implementar um novo handler no FinancialOrchestrator;
3. criar a regra de negócio correspondente;
4. emitir eventos relevantes;
5. garantir que o fluxo use transação atômica e ledger.

Exemplo conceitual:

```js
export const TRANSACTION_TYPE = {
  ...,
  REFUND: 'REFUND',
};
```

Depois no orchestrator:

```js
case TRANSACTION_TYPE.REFUND:
  result = await this.handleRefund(payload, activeSession);
  break;
```

E o handler:

```js
static async handleRefund(payload, session) {
  // validação
  // débito/crédito
  // transaction
  // ledger
}
```

---

## 13. Resumo executivo

O Edumoney backend já possui uma base financeira bem estruturada para projetos de finanças digitais.

O ponto mais importante é que ele não trata dinheiro como uma simples operação isolada. Em vez disso, ele organiza tudo em um fluxo seguro, rastreável e extensível.

Se você quiser reutilizar isso como base, a regra de ouro é:

- nunca faça movimentação financeira fora do FinancialOrchestrator;
- sempre registre a operação em transaction e ledger;
- use eventos para expandir o sistema sem acoplar tudo.

---

## 14. Referências rápidas do repositório

- [src/core/financial/FinancialOrchestrator.js](src/core/financial/FinancialOrchestrator.js)
- [src/core/financial/FinancialEnforcementEngine.js](src/core/financial/FinancialEnforcementEngine.js)
- [src/models/wallet.js](src/models/wallet.js)
- [src/models/transaction.js](src/models/transaction.js)
- [src/models/ledger.model.js](src/models/ledger.model.js)
- [src/services/payment.service.js](src/services/payment.service.js)
- [src/controllers/cashout.controller.js](src/controllers/cashout.controller.js)
