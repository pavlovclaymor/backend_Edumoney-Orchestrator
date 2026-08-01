"# Backend Edumoney Orchestrator

Este repositório contém o backend da aplicação Edumoney, com foco em gestão financeira, pagamentos, carteiras digitais, invoices, cashouts e integrações de negócio para escolas, comerciantes e usuários.

A API foi estruturada para funcionar como um núcleo financeiro robusto, com regras de negócio centralizadas, controle de saldo, rastreabilidade de transações e eventos para integração com outros módulos do sistema.

## Objetivo da aplicação

O backend do Edumoney tem como finalidade:

- gerenciar contas de usuários, escolas e comerciantes;
- controlar carteiras digitais e saldos;
- processar pagamentos e transferências;
- criar e gerenciar invoices;
- permitir recargas e cashouts;
- fornecer uma base auditável e extensível para operações financeiras.

## Visão geral da API

A API expõe endpoints para operações transacionais e de negócio, organizados por domínio, como:

- autenticação e autorização;
- gestão de usuários e perfis;
- gestão de escolas e comerciantes;
- operações financeiras, como transferências, pagamentos, recargas e saques;
- emissão e acompanhamento de invoices;
- auditoria, notificações e eventos.

A arquitetura foi pensada para que a lógica financeira não fique espalhada pelos controllers. Em vez disso, a movimentação de dinheiro é centralizada em um orchestrator financeiro, o que melhora consistência, segurança e manutenção.

## Arquitetura principal

O backend segue uma estrutura modular, com separação entre:

- controllers: recebem requisições HTTP e delegam a lógica para serviços;
- services: implementam a regra de negócio;
- models: representam os dados persistidos no MongoDB;
- routes: expõem os endpoints da API;
- core: concentra a lógica financeira, eventos, segurança e orchestration;
- workers: processam eventos assíncronos e integrações auxiliares.

### Componentes-chave

- Wallet: representa a carteira do usuário, comerciante ou escola.
- Transaction: registra a operação financeira de alto nível.
- Ledger: mantém o histórico contábil detalhado das entradas e saídas.
- FinancialOrchestrator: ponto único para execução das operações financeiras.
- EventBus: publica eventos para notificações, auditoria e outros fluxos.
- FinancialEnforcementEngine: impede que operações financeiras sejam feitas fora do fluxo controlado.

## Fluxo financeiro principal

O fluxo financeiro do sistema é baseado em um padrão centralizado:

1. uma requisição chega ao controller;
2. o service valida a regra de negócio;
3. o FinancialOrchestrator executa a operação financeira;
4. a carteira é atualizada;
5. a transação é registrada;
6. o ledger recebe os registros contábeis;
7. eventos são emitidos para notificações e workers.

Esse modelo reduz riscos de inconsistência e faz com que o sistema fique mais preparado para crescer com novos tipos de operação financeira.

## Domínios principais

### Autenticação

Responsável por autenticar usuários, gerar tokens JWT e controlar acesso às rotas protegidas.

### Usuários e perfis

Inclui o gerenciamento de dados do usuário, permissões e relacionamento com outras entidades como escolas e comerciantes.

### Escolas e comerciantes

Gerencia entidades que participam do ecossistema financeiro, incluindo configuração, vínculos e regras de comissão ou fee.

### Financeiro

Este é o coração do sistema. Aqui ficam os fluxos de:

- transferências;
- pagamentos de invoices;
- recargas;
- QR payments;
- cashouts;
- split de taxas e fees.

### Invoices

A API permite criar invoices, acompanhar status de pagamento, associar comerciantes e alunos e integrar o ciclo de cobrança.

### Auditoria e notificações

O sistema registra eventos de auditoria e envia notificações para acompanhar ações importantes, como pagamentos, levantamentos e alterações de estado.

## Tecnologias principais

O backend utiliza uma stack baseada em:

- Node.js
- Express
- MongoDB/Mongoose
- JWT para autenticação
- eventos internos para comunicação assíncrona
- arquitetura modular com foco em operações financeiras

## Estrutura de diretórios

- src/controllers: controllers HTTP
- src/services: regras de negócio
- src/models: modelos do MongoDB
- src/routes: definição de rotas
- src/core: módulos centrais financeiros e de eventos
- src/workers: processamento assíncrono
- src/utils: helpers e utilidades
- tests: testes de contratos e integração

## Como usar

Para executar o projeto localmente, é necessário instalar as dependências e configurar as variáveis de ambiente do projeto.

O fluxo típico é:

1. instalar dependências;
2. configurar o ambiente com as variáveis necessárias;
3. iniciar o servidor;
4. consumir os endpoints via Postman, Insomnia ou frontend.

## Observações importantes

- a camada financeira é centralizada e deve ser respeitada para evitar inconsistências;
- operações de saldo, transação e ledger devem seguir o fluxo do orchestrator;
- o projeto foi pensado para servir como base para sistemas financeiros mais completos, incluindo múltiplos fluxos de pagamento, split e reconciliação.

## Resumo

O backend do Edumoney é uma API modular e orientada a eventos, com forte foco em finanças digitais. Sua principal força está na forma como centraliza regras financeiras, garante rastreabilidade e prepara o sistema para evoluir com segurança.
" 
## DEV
Desenvolvido por **Pavlov Claymor Dev FullStack 2026**
