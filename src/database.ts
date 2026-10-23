const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'prospecta.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

// Ensure all columns exist on companies
try { db.exec("ALTER TABLE companies ADD COLUMN cnpj TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN website TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN city TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE companies ADD COLUMN state TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE contacts ADD COLUMN linkedin TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'ligacao'"); } catch(e) {}
try { db.exec("ALTER TABLE cadence_steps ADD COLUMN template_subject TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE cadence_steps ADD COLUMN template_body TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE pipeline_stages ADD COLUMN color TEXT DEFAULT '#6366F1'"); } catch(e) {}

// 1. Companies
db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    segment TEXT,
    size TEXT,
    status TEXT DEFAULT 'prospect',
    cnpj TEXT,
    website TEXT,
    city TEXT,
    state TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 2. Contacts
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    consent INTEGER DEFAULT 1,
    tags TEXT DEFAULT '',
    observations TEXT,
    linkedin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  )
`);

// 3. Pipeline stages
db.exec(`
  CREATE TABLE IF NOT EXISTS pipeline_stages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    stage_order INTEGER DEFAULT 0,
    probability INTEGER DEFAULT 0,
    is_won INTEGER DEFAULT 0,
    color TEXT DEFAULT '#6366F1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 4. Deals / Opportunities
db.exec(`
  CREATE TABLE IF NOT EXISTS deals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    contact_id INTEGER,
    stage_id INTEGER,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    probability INTEGER DEFAULT 0,
    expected_close_date DATETIME,
    loss_reason TEXT,
    status TEXT DEFAULT 'aberto',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT
  )
`);

// 5. Tasks & Follow-ups
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    priority TEXT DEFAULT 'media',
    status TEXT DEFAULT 'pendente',
    task_type TEXT DEFAULT 'ligacao',
    due_date DATETIME,
    company_id INTEGER,
    contact_id INTEGER,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  )
`);

// 6. Cadences
db.exec(`
  CREATE TABLE IF NOT EXISTS cadences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'sequencia',
    status TEXT DEFAULT 'ativo',
    conditions TEXT DEFAULT '{}',
    pause_until DATETIME,
    exit_condition TEXT DEFAULT '',
    reentry_enabled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 7. Cadence steps
db.exec(`
  CREATE TABLE IF NOT EXISTS cadence_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cadence_id INTEGER,
    step_order INTEGER DEFAULT 0,
    type TEXT NOT NULL,
    channel TEXT,
    wait_time INTEGER DEFAULT 0,
    template_subject TEXT,
    template_body TEXT,
    condition TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cadence_id) REFERENCES cadences(id) ON DELETE CASCADE
  )
`);

// 8. Cadence Enrollments
db.exec(`
  CREATE TABLE IF NOT EXISTS cadence_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cadence_id INTEGER,
    contact_id INTEGER,
    current_step_order INTEGER DEFAULT 0,
    status TEXT DEFAULT 'ativo',
    next_action_due DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cadence_id) REFERENCES cadences(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  )
`);

// 9. Call Records
db.exec(`
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    contact_id INTEGER,
    phone_number TEXT NOT NULL,
    call_type TEXT DEFAULT 'outbound',
    status TEXT DEFAULT 'completed',
    disposition TEXT NOT NULL,
    duration_seconds INTEGER DEFAULT 0,
    notes TEXT,
    sentiment TEXT DEFAULT 'neutro',
    objections_detected TEXT DEFAULT '',
    transcript TEXT,
    ai_summary TEXT,
    next_step TEXT,
    recording_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
  )
`);

// 10. Cold Call Scripts
db.exec(`
  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    trigger_text TEXT,
    content TEXT NOT NULL,
    tips TEXT,
    stage TEXT DEFAULT 'todos',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 11. VoIP SIP Configs
db.exec(`
  CREATE TABLE IF NOT EXISTS sip_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT DEFAULT 'Simulador WebRTC Nativo (Local)',
    is_simulator INTEGER DEFAULT 1,
    ws_server TEXT,
    sip_domain TEXT,
    username TEXT,
    password TEXT,
    caller_id TEXT DEFAULT '+1 555 010 0000',
    dtmf_volume REAL DEFAULT 0.5,
    auto_record INTEGER DEFAULT 1,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 12. Activity Timeline
db.exec(`
  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;

// ==========================================
// MIGRAÇÕES DE FK (bancos criados antes do schema atual)
// Tabelas antigas foram criadas sem ON DELETE CASCADE/SET NULL;
// SQLite não permite ALTER de FK, então recriamos preservando os dados.
// ==========================================
function ensureFk(table: string, createSql: string, requiredClause: string) {
  const current = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table) as any;
  if (!current || !current.sql) return;
  if (current.sql.includes(requiredClause)) return;

  const fkWasOn = (db.pragma('foreign_keys', { simple: true }) as any) === 1;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const cols = (db.prepare(`PRAGMA table_info(${table})`).all() as any[]).map(c => c.name);
      if (cols.length === 0) return;
      db.exec(`DROP TABLE IF EXISTS ${table}__mig`);
      db.exec(createSql.replace(`CREATE TABLE IF NOT EXISTS ${table}`, `CREATE TABLE ${table}__mig`));
      db.exec(`INSERT INTO ${table}__mig (${cols.join(', ')}) SELECT ${cols.join(', ')} FROM ${table}`);
      db.exec(`DROP TABLE ${table}`);
      db.exec(`ALTER TABLE ${table}__mig RENAME TO ${table}`);
    })();
  } finally {
    db.pragma(`foreign_keys = ${fkWasOn ? 'ON' : 'OFF'}`);
  }
}

ensureFk('contacts', `
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_id INTEGER,
    name TEXT NOT NULL,
    role TEXT,
    phone TEXT,
    email TEXT,
    source TEXT,
    consent INTEGER DEFAULT 1,
    tags TEXT DEFAULT '',
    observations TEXT,
    linkedin TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
  )
`, 'ON DELETE SET NULL');

ensureFk('tasks', `
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    priority TEXT DEFAULT 'media',
    status TEXT DEFAULT 'pendente',
    task_type TEXT DEFAULT 'ligacao',
    due_date DATETIME,
    company_id INTEGER,
    contact_id INTEGER,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
  )
`, 'ON DELETE CASCADE');

ensureFk('cadence_steps', `
  CREATE TABLE IF NOT EXISTS cadence_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cadence_id INTEGER,
    step_order INTEGER DEFAULT 0,
    type TEXT NOT NULL,
    channel TEXT,
    wait_time INTEGER DEFAULT 0,
    template_subject TEXT,
    template_body TEXT,
    condition TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cadence_id) REFERENCES cadences(id) ON DELETE CASCADE
  )
`, 'ON DELETE CASCADE');
