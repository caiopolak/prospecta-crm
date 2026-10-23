const BASE = 'http://localhost:3002';
const J = async (path, opts) => {
  const r = await fetch(BASE + path, opts);
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
};
const post = (p, b) => J(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
const del = (p) => J(p, { method: 'DELETE' });

(async () => {
  const db = require('better-sqlite3')('prospecta.db');

  // 1. Empresas de teste (cascata: deals + tasks)
  const testCompanies = db.prepare(`
    SELECT id FROM companies WHERE name IN (
      'Example Company A - Alterada', 'Example Company B', 'Example Company C',
      'ZZ Cascade Full', 'ZZ Cascade Chain', 'ZZ Cascade Test', 'ZZ Cascade Debug'
    )
  `).all().map(r => r.id);
  if (testCompanies.length) {
    const r = await post('/api/companies/bulk-delete', { ids: testCompanies });
    console.log('companies bulk-delete:', r.status, JSON.stringify(r.body));
  }

  // 2. Contatos de teste (criados pela suíte; FK agora é SET NULL, então explícito)
  const testPhones = ['5550100101','5550100102','5550100103','5550100104','5550100105'];
  const testContacts = db.prepare(
    `SELECT id FROM contacts WHERE phone IN (${testPhones.map(() => '?').join(',')})`
  ).all(...testPhones).map(r => r.id);
  if (testContacts.length) {
    const r = await post('/api/contacts/bulk-delete', { ids: testContacts });
    console.log('contacts bulk-delete:', r.status, JSON.stringify(r.body));
  }

  // 3. Cadências de teste (cascata: steps + enrollments)
  const testCadences = db.prepare(`
    SELECT id FROM cadences WHERE name = 'Cadência Outbound Enterprise Q4'
  `).all().map(r => r.id);
  for (const id of testCadences) {
    const r = await del(`/api/cadences/${id}`);
    console.log('cadence delete', id, ':', r.status);
  }

  // 4. Chamadas de teste (não há DELETE /api/calls — remove direto)
  const testCalls = db.prepare(`
    DELETE FROM calls WHERE phone_number IN ('5550100101','5550100104')
  `).run();
  console.log('calls removidas:', testCalls.changes);

  // 5. Resíduos diretos (cascata do FK pode já ter pego — garante)
  db.prepare(`DELETE FROM tasks WHERE title IN ('Task cascade','Task chain','Enviar Proposta Comercial Customizada')`).run();
  db.prepare(`DELETE FROM deals WHERE title LIKE 'Projeto Implantação CRM 50 Licenças%'`).run();

  // Relatório final
  console.log('\n=== ESTADO FINAL DO BANCO ===');
  ['companies','contacts','deals','tasks','calls','cadences','cadence_steps','cadence_enrollments','scripts'].forEach(t => {
    console.log(`${t} = ${db.prepare('SELECT COUNT(*) c FROM ' + t).get().c}`);
  });
  console.log('\nEmpresas:', db.prepare('SELECT id, name FROM companies').all().map(r => `${r.id}:${r.name}`).join(' | '));
  console.log('Contatos:', db.prepare('SELECT id, name FROM contacts').all().map(r => `${r.id}:${r.name}`).join(' | '));
  console.log('Cadências:', db.prepare('SELECT id, name FROM cadences').all().map(r => `${r.id}:${r.name}`).join(' | '));
  db.close();
})().catch(e => { console.error('ERRO:', e); process.exit(1); });
