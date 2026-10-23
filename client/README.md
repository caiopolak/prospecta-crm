# Prospecta CRM — interface web

Aplicação React/TypeScript do Prospecta CRM. A documentação principal, requisitos, instruções de execução e limitações estão no [README da raiz](../README.md).

## Scripts

- `npm start` inicia o servidor de desenvolvimento na porta 3000.
- `npm run build` gera os arquivos de produção em `build/`.
- `npm test -- --watchAll=false` executa os testes do frontend uma vez.

O frontend espera a API Express do repositório raiz disponível na porta 3002 (ou proxied conforme configuração local). Integrações de chamadas reais requerem uma configuração SIP válida.
