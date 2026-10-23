# Prospecta CRM

CRM de prospecção B2B com gestão de empresas e contatos, pipeline de vendas, tarefas, cadências e operação de chamadas em uma interface web com suporte Android.

> Projeto de portfólio em desenvolvimento. O modo simulador funciona localmente; chamadas reais dependem de uma conta e configuração SIP próprias. O backend ainda não implementa autenticação e deve ser executado apenas em ambiente local/confiável.

<p align="center">
  <img src="MARKETING DE PRODUTO/Logo Prospecta CRM em Verde Neon.png" alt="Capa do Prospecta CRM" width="720" />
</p>

## Visão geral

- Cadastro de empresas, contatos e oportunidades, com pipeline em etapas.
- Dashboard, histórico de chamadas, filas de prospecção, tarefas e cadências.
- Power dialer com simulador local e integração SIP usando JsSIP.
- Gateway Android GSM via Capacitor e plugin nativo para iniciar chamadas pelo discador do aparelho.
- Importação de contatos por CSV e gravação local de áudio de chamadas.
- Aplicação web React e API Express com persistência SQLite.

## Imagem do produto

A capa do projeto está disponível em [`MARKETING DE PRODUTO/capa preview 1.jpg`](MARKETING%20DE%20PRODUTO/capa%20preview%201.jpg). As capturas detalhadas e o vídeo de apresentação permanecem no diretório de marketing local.

## Tecnologias

- TypeScript, Node.js e Express
- React 19, React Router e Framer Motion
- SQLite com better-sqlite3
- JsSIP para sinalização SIP via WebSocket
- Capacitor 8, Android e Java para integração com recursos de telefonia
- Testes de API em Node.js e testes do frontend com Jest / Testing Library

## Requisitos

- Node.js 20 ou superior e npm
- Android Studio/JDK somente para compilar ou executar o app Android
- Para telefonia real: provedor SIP compatível com WebSocket, credenciais e um ambiente com acesso ao serviço

## Executar localmente

```bash
npm install
cd client && npm install && cd ..
npm start
```

Em outro terminal:

```bash
cd client
npm start
```

O backend usa a porta `3002`; o frontend do Create React App usa `3000`. A base `prospecta.db` é criada localmente pelo backend e não deve ser versionada.

## Build

```bash
cd client && npm run build && cd ..
npm run build
```

Para Android, gere os assets web primeiro e siga o fluxo Capacitor/Android Studio. Builds de release devem ser assinados com uma chave própria, guardada fora do repositório.

## Testes

```bash
npm test
cd client && npm test -- --watchAll=false
```

## Configuração SIP

O modo simulador pode ser usado sem credenciais de telefonia. Para chamadas reais, configure os dados SIP na tela de VoIP do app. Senhas são armazenadas no banco SQLite local, portanto use apenas em uma instalação confiável. Não publique `.env`, banco de dados, gravações, chaves ou APKs.

## Estrutura

```text
src/                    API Express, SQLite e funções auxiliares
client/src/             Interface React, chamadas SIP e telas do CRM
client/android/         Projeto nativo Android/Capacitor
tests/                  Testes da API
MARKETING DE PRODUTO/   Material visual do produto
```

## Estado e limitações

- Este repositório apresenta um projeto de portfólio; não representa um serviço hospedado ou uma oferta SaaS pronta para produção.
- O código auxiliar de IA contém heurísticas determinísticas e respostas mock, sem integração ativa com um modelo externo.
- O backend não tem autenticação/autorização; não o exponha diretamente à internet nem use com dados reais sem controles adicionais.
- A API de configuração não retorna a senha SIP; o cliente conserva a credencial informada em memória durante a sessão para conectar o JsSIP.

## English

Prospecta CRM is a B2B prospecting CRM with company and contact management, a sales pipeline, tasks, cadences, call history, a local call simulator, SIP calling through JsSIP, and an Android GSM gateway built with Capacitor. It is a portfolio project under development. See the Portuguese sections above for setup and current limitations.

## Licença e direitos autorais

Este projeto é proprietário e todos os direitos sobre o conteúdo original são reservados ao autor. A publicação pública permite visualizar e avaliar o repositório como portfólio; não concede permissão para copiar, modificar, redistribuir, criar derivados ou usar comercialmente o código. Materiais e dependências de terceiros permanecem sob suas próprias licenças. Consulte [LICENSE](LICENSE) para os termos completos e peça autorização por escrito ao autor para outros usos.

