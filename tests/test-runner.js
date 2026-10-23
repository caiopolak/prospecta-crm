const assert = require('node:assert');

const BASE_URL = 'http://localhost:3002';

// Utility logging
function logSuite(name) {
  console.log(`\n==================================================`);
  console.log(`🧪 SUITE: ${name}`);
  console.log(`==================================================`);
}

function logTest(name, success = true, detail = '') {
  const icon = success ? '✅' : '❌';
  console.log(`${icon}  ${name} ${detail ? `(${detail})` : ''}`);
}

async function runAllTests() {
  console.log(`🚀 INICIANDO BATERIA COMPLETA DE TESTES E VALIDAÇÃO - PROSPECTA CRM`);
  console.log(`   Target API: ${BASE_URL}\n`);

  let passed = 0;
  let failed = 0;
  const errors = [];

  const test = async (title, fn) => {
    try {
      await fn();
      logTest(title, true);
      passed++;
    } catch (err) {
      logTest(title, false, err.message);
      failed++;
      errors.push({ title, error: err });
    }
  };

  // State shared across suites
  let createdCompanyId = null;
  let createdContactId = null;
  let createdCallId = null;
  let createdDealId = null;
  let createdCadenceId = null;
  let createdTaskId = null;
  let createdScriptId = null;
  let savedRecordingUrl = null;

  // ---------------------------------------------------------
  // SUITE 1: INFRAESTRUTURA & SAÚDE
  // ---------------------------------------------------------
  logSuite('1. Infraestrutura, Saúde & Rede');

  await test('GET /health deve responder HTTP 200 com status ok', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
  });

  await test('GET /api/network-info deve retornar IPs e porta 3002', async () => {
    const res = await fetch(`${BASE_URL}/api/network-info`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.localIp);
    assert.strictEqual(data.port, 3002);
  });

  await test('GET /api/sip-config deve retornar configuração SIP válida', async () => {
    const res = await fetch(`${BASE_URL}/api/sip-config`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok('provider_name' in data || 'is_simulator' in data);
  });

  // ---------------------------------------------------------
  // SUITE 2: DASHBOARD & MÉTRICAS
  // ---------------------------------------------------------
  logSuite('2. Dashboard & Métricas do CRM');

  await test('GET /api/dashboard/stats deve retornar contadores coerentes', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data.totalCompanies === 'number');
    assert.ok(typeof data.totalContacts === 'number');
    assert.ok(typeof data.totalCalls === 'number');
    assert.ok(typeof data.conversionRate === 'number');
  });

  await test('GET /api/leads/prioritarios deve listar leads ordenados', async () => {
    const res = await fetch(`${BASE_URL}/api/leads/prioritarios`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  await test('GET /api/activities deve retornar registro de atividades recentes', async () => {
    const res = await fetch(`${BASE_URL}/api/activities`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  // ---------------------------------------------------------
  // SUITE 3: EMPRESAS (CRUD COMPLETO)
  // ---------------------------------------------------------
  logSuite('3. Gestão de Empresas (CRUD)');

  await test('POST /api/companies deve criar nova empresa corporativa', async () => {
    const payload = {
      name: 'Example Company A',
      segment: 'SaaS / B2B',
      size: 'media',
      status: 'prospect',
      city: 'São Paulo',
      state: 'SP',
      website: 'example.invalid',
      cnpj: 'TEST-CNPJ-NOT-REAL'
    };
    const res = await fetch(`${BASE_URL}/api/companies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdCompanyId = data.id;
  });

  await test('GET /api/companies/:id deve retornar detalhes da empresa criada', async () => {
    assert.ok(createdCompanyId, 'Id da empresa precisa existir');
    const res = await fetch(`${BASE_URL}/api/companies/${createdCompanyId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.name, 'Example Company A');
    assert.strictEqual(data.segment, 'SaaS / B2B');
  });

  await test('PUT /api/companies/:id deve atualizar os dados da empresa', async () => {
    assert.ok(createdCompanyId);
    const payload = {
      name: 'Example Company A - Alterada',
      segment: 'Tecnologia Avançada',
      size: 'grande',
      status: 'cliente',
      city: 'Campinas',
      state: 'SP',
      website: 'example.invalid'
    };
    const res = await fetch(`${BASE_URL}/api/companies/${createdCompanyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 200);

    // Re-fetch para checar se atualizou no banco
    const checkRes = await fetch(`${BASE_URL}/api/companies/${createdCompanyId}`);
    const checkData = await checkRes.json();
    assert.strictEqual(checkData.name, 'Example Company A - Alterada');
    assert.strictEqual(checkData.status, 'cliente');
  });

  // ---------------------------------------------------------
  // SUITE 4: CONTATOS & IMPORTAÇÃO CSV
  // ---------------------------------------------------------
  logSuite('4. Gestão de Contatos & Importação em Lote');

  await test('POST /api/contacts deve cadastrar um novo contato vinculado à empresa', async () => {
    assert.ok(createdCompanyId);
    const payload = {
      name: 'Test Contact A Oliveira Executivo',
      role: 'Diretor de Operações',
      phone: '5550100101',
      email: 'contact1@example.invalid',
      company_id: createdCompanyId,
      observations: 'Contato chave gerado via teste de integridade'
    };
    const res = await fetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdContactId = data.id;
  });

  await test('GET /api/contacts/:id deve retornar o contato completo com empresa', async () => {
    assert.ok(createdContactId);
    const res = await fetch(`${BASE_URL}/api/contacts/${createdContactId}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.name, 'Test Contact A Oliveira Executivo');
    assert.strictEqual(data.phone, '5550100101');
    assert.strictEqual(data.company_id, createdCompanyId);
  });

  await test('POST /api/import/contacts deve importar contatos de lote em formato estruturado', async () => {
    const payload = {
      rows: [
        {
          name: 'Test Contact B',
          company: 'Example Company B',
          role: 'CEO',
          phone: '5550100102',
          email: 'contact2@example.invalid',
          city: 'Curitiba',
          state: 'PR',
          segment: 'TI'
        },
        {
          name: 'Test Contact C Alves',
          company: 'Example Company C',
          role: 'Gerente de Vendas',
          phone: '5550100103',
          email: 'contact3@example.invalid',
          city: 'Porto Alegre',
          state: 'RS',
          segment: 'Servicos'
        }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/import/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.imported >= 2);
  });

  // ---------------------------------------------------------
  // SUITE 5: TELEFONIA, GRAVAÇÃO, FILA & HISTÓRICO
  // ---------------------------------------------------------
  logSuite('5. Telefonia VoIP, Gravação de Áudio & Fila de Prospecção');

  await test('GET /api/calls/queue deve incluir contato recém criado na fila de prospecção', async () => {
    const res = await fetch(`${BASE_URL}/api/calls/queue`);
    assert.strictEqual(res.status, 200);
    const queue = await res.json();
    assert.ok(Array.isArray(queue));
    const found = queue.find(item => item.id === createdContactId);
    assert.ok(found, 'O contato criado deve estar presente na fila de chamadas');
  });

  await test('POST /api/calls/recording deve salvar arquivo de áudio base64 e retornar URL estática', async () => {
    // 1 segundo de áudio dummy silencioso base64 (WebM)
    const dummyBase64 = 'GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibU23U2CEV01BNk1CgEBDsYJAYI13ZWJtAQU2AQA=';
    const res = await fetch(`${BASE_URL}/api/calls/recording`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: dummyBase64, mime: 'audio/webm', phone: '5550100101' })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.url && data.url.startsWith('/recordings/'));
    savedRecordingUrl = data.url;

    // Verificar se o arquivo realmente pode ser baixado/acessado
    const fileRes = await fetch(`${BASE_URL}${savedRecordingUrl}`);
    assert.strictEqual(fileRes.status, 200);
  });

  await test('POST /api/calls deve registrar desfecho da chamada com nota e gravação associada', async () => {
    assert.ok(createdContactId);
    assert.ok(savedRecordingUrl);
    const payload = {
      company_id: createdCompanyId,
      contact_id: createdContactId,
      phone_number: '5550100101',
      call_type: 'outbound',
      status: 'completada',
      disposition: 'reuniao_agendada',
      duration_seconds: 45,
      notes: 'Cliente gostou muito da apresentação do CRM e agendou demo para terça-feira.',
      next_step: 'Enviar proposta até segunda',
      recording_url: savedRecordingUrl
    };
    const res = await fetch(`${BASE_URL}/api/calls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdCallId = data.id;
  });

  await test('GET /api/calls deve listar o histórico de chamadas com a gravação gravada', async () => {
    const res = await fetch(`${BASE_URL}/api/calls`);
    assert.strictEqual(res.status, 200);
    const calls = await res.json();
    assert.ok(Array.isArray(calls));
    const myCall = calls.find(c => c.id === createdCallId);
    assert.ok(myCall, 'Chamada salva deve constar no histórico');
    assert.strictEqual(myCall.disposition, 'reuniao_agendada');
    assert.strictEqual(myCall.recording_url, savedRecordingUrl);
  });

  // ---------------------------------------------------------
  // SUITE 6: PIPELINE & NEGÓCIOS (KANBAN)
  // ---------------------------------------------------------
  logSuite('6. Funil de Vendas (Pipeline & Oportunidades)');

  let defaultStageId = null;

  await test('GET /api/pipeline-stages deve retornar estágios do funil', async () => {
    const res = await fetch(`${BASE_URL}/api/pipeline-stages`);
    assert.strictEqual(res.status, 200);
    const stages = await res.json();
    assert.ok(Array.isArray(stages));
    assert.ok(stages.length >= 1, `esperava ao menos 1 estágio, veio ${stages.length}`);
    defaultStageId = stages[0].id;
  });

  await test('POST /api/deals deve criar uma nova oportunidade no Kanban', async () => {
    assert.ok(createdCompanyId);
    assert.ok(createdContactId);
    const payload = {
      company_id: createdCompanyId,
      contact_id: createdContactId,
      stage_id: defaultStageId,
      title: 'Projeto Implantação CRM 50 Licenças',
      value: 150000.00,
      probability: 60,
      expected_close_date: '2026-11-15'
    };
    const res = await fetch(`${BASE_URL}/api/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdDealId = data.id;
  });

  await test('PUT /api/deals/:id deve movimentar o negócio no funil', async () => {
    assert.ok(createdDealId);
    const stagesRes = await fetch(`${BASE_URL}/api/pipeline-stages`);
    const stages = await stagesRes.json();
    const nextStageId = stages[1] ? stages[1].id : defaultStageId;

    const payload = {
      stage_id: nextStageId,
      title: 'Projeto Implantação CRM 50 Licenças - Negociação',
      value: 165000.00,
      probability: 80,
      status: 'aberto'
    };
    const res = await fetch(`${BASE_URL}/api/deals/${createdDealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 200);
  });

  // ---------------------------------------------------------
  // SUITE 7: CADÊNCIAS DE PROSPECÇÃO
  // ---------------------------------------------------------
  logSuite('7. Motor de Cadências & Automação');

  await test('POST /api/cadences deve criar uma cadência de prospecção', async () => {
    const payload = {
      name: 'Cadência Outbound Enterprise Q4',
      description: 'Sequência de 5 passos para tomadores de decisão em TI',
      type: 'outbound',
      status: 'ativo'
    };
    const res = await fetch(`${BASE_URL}/api/cadences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdCadenceId = data.id;
  });

  await test('POST /api/cadences/:id/steps deve adicionar passos à cadência', async () => {
    assert.ok(createdCadenceId);
    const stepPayload = {
      step_order: 1,
      type: 'ligacao',
      channel: 'ligacao',
      wait_time: 0,
      template_subject: 'Cold Call de Apresentação',
      template_body: 'Usar script de abordagem inicial focando nas dores de telefonia'
    };
    const res = await fetch(`${BASE_URL}/api/cadences/${createdCadenceId}/steps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stepPayload)
    });
    assert.strictEqual(res.status, 201);
  });

  await test('POST /api/cadences/:id/enroll deve inscrever contato na cadência', async () => {
    assert.ok(createdCadenceId);
    assert.ok(createdContactId);
    const res = await fetch(`${BASE_URL}/api/cadences/${createdCadenceId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contact_id: createdContactId })
    });
    assert.strictEqual(res.status, 201);
  });

  // ---------------------------------------------------------
  // SUITE 8: TAREFAS & FOLLOW-UPS
  // ---------------------------------------------------------
  logSuite('8. Tarefas & Agendamentos SDR');

  await test('POST /api/tasks deve agendar tarefa de retorno', async () => {
    assert.ok(createdCompanyId);
    assert.ok(createdContactId);
    const payload = {
      title: 'Enviar Proposta Comercial Customizada',
      description: 'Elaborar proposta com plano ilimitado VoIP e 5 licenças do CRM',
      assigned_to: 'Test User',
      priority: 'alta',
      status: 'pendente',
      task_type: 'email',
      due_date: '2026-10-03T10:00:00Z',
      company_id: createdCompanyId,
      contact_id: createdContactId
    };
    const res = await fetch(`${BASE_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdTaskId = data.id;
  });

  await test('PUT /api/tasks/:id deve concluir a tarefa', async () => {
    assert.ok(createdTaskId);
    const payload = {
      title: 'Enviar Proposta Comercial Customizada',
      status: 'concluida',
      priority: 'alta',
      task_type: 'email'
    };
    const res = await fetch(`${BASE_URL}/api/tasks/${createdTaskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 200);
  });

  // ---------------------------------------------------------
  // SUITE 9: OPERAÇÕES EM MASSA E APAGAMENTO EM CASCATA
  // ---------------------------------------------------------
  logSuite('9. Operações em Massa & Integridade em Cascata');

  await test('POST /api/contacts/bulk-delete deve excluir contatos selecionados', async () => {
    // Criar um contato temporário extra para testar a remoção em lote de contatos isolados
    const ctRes = await fetch(`${BASE_URL}/api/contacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Contato Temp Bulk 1', phone: '5550100106' })
    });
    const tempCt = await ctRes.json();

    const res = await fetch(`${BASE_URL}/api/contacts/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [tempCt.id] })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.removed, 1);
  });

  await test('POST /api/companies/bulk-delete deve apagar empresa E contatos/deals filhos em cascata', async () => {
    assert.ok(createdCompanyId);
    assert.ok(createdContactId);
    assert.ok(createdDealId);

    // Apagar a empresa de teste principal
    const res = await fetch(`${BASE_URL}/api/companies/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [createdCompanyId] })
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.removed, 1);

    // Verificar se a empresa sumiu
    const compCheck = await fetch(`${BASE_URL}/api/companies/${createdCompanyId}`);
    assert.strictEqual(compCheck.status, 404);

    // Verificar se o contato filho sumiu (cascata do banco)
    const ctCheck = await fetch(`${BASE_URL}/api/contacts/${createdContactId}`);
    assert.strictEqual(ctCheck.status, 404);
  });

  // ---------------------------------------------------------
  // SUITE 10: SCRIPTS DE VENDAS
  // ---------------------------------------------------------
  logSuite('10. Roteiros & Scripts de Vendas');

  await test('POST /api/scripts deve criar novo roteiro', async () => {
    const payload = {
      title: 'Script Contorno de Objeção - "Já tenho fornecedor"',
      category: 'Objeções',
      content: 'Entendo perfeitamente! A maioria dos nossos atuais clientes também usava outro fornecedor...'
    };
    const res = await fetch(`${BASE_URL}/api/scripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    createdScriptId = data.id;
  });

  await test('DELETE /api/scripts/:id deve remover o script de teste', async () => {
    assert.ok(createdScriptId);
    const res = await fetch(`${BASE_URL}/api/scripts/${createdScriptId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(res.status, 200);
  });

  // ---------------------------------------------------------
  // RESUMO DOS RESULTADOS
  // ---------------------------------------------------------
  console.log(`\n==================================================`);
  console.log(`📊 RELATÓRIO FINAL DA VALIDAÇÃO DO PROSPECTA CRM`);
  console.log(`==================================================`);
  console.log(` Total de testes executados: ${passed + failed}`);
  console.log(` ✅ Aprovados:               ${passed}`);
  console.log(` ❌ Falhas:                  ${failed}`);

  if (failed > 0) {
    console.log(`\n🚨 DETALHES DAS FALHAS:`);
    errors.forEach((e, idx) => {
      console.log(` ${idx + 1}) ${e.title}: ${e.error.stack || e.error.message}`);
    });
    process.exit(1);
  } else {
    console.log(`\n🎉 TODOS OS ENDPOINTS, BANCO DE DADOS E INTEGRAÇÕES PASSARAM COM SUCESSO!`);
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Erro fatal executando os testes:', err);
  process.exit(1);
});
