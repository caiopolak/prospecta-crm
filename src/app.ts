import express, { Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { summarizeCall, suggestNextStep, detectObjections, generateCoachTip } from './ai';
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

// Connected Mobile Gateway SSE clients
let gatewayClients: Response[] = [];
let lastMobileHeartbeat: Date | null = null;
let pairedDeviceName: string = 'Nenhum celular conectado';
let activeGatewayCall: any = null;

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.use(express.json({ limit: '50mb' }));

// CORS for the Android Gateway WebView (origin https://localhost) on the local network
app.use((req: Request, res: Response, next: any) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Serve React frontend build
app.use(express.static(path.join(__dirname, '..', 'client', 'build')));

// Call recordings (MediaRecorder uploads from the VoIP studio)
const RECORDINGS_DIR = path.join(__dirname, '..', 'recordings');
app.use('/recordings', express.static(RECORDINGS_DIR));

app.post('/api/calls/recording', (req: Request, res: Response) => {
  try {
    const { data, mime, phone } = req.body;
    if (!data) return res.status(400).json({ error: 'Nenhum áudio recebido' });
    if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
    const ext = (mime || '').includes('mp4') ? 'm4a' : 'webm';
    const name = `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    fs.writeFileSync(path.join(RECORDINGS_DIR, name), Buffer.from(data, 'base64'));
    res.json({ url: `/recordings/${name}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'Prospecta CRM Enterprise VoIP API running', timestamp: new Date() });
});

// ==========================================
// 1. DASHBOARD & METRICS
// ==========================================
app.get('/api/dashboard/stats', (req: Request, res: Response) => {
  try {
    const totalCompanies = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any).count;
    const totalContacts = (db.prepare('SELECT COUNT(*) as count FROM contacts').get() as any).count;
    const pendingTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'concluida'").get() as any).count;
    const overdueTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status != 'concluida' AND due_date IS NOT NULL AND due_date < DATETIME('now')").get() as any).count;
    const totalCadences = (db.prepare('SELECT COUNT(*) as count FROM cadences').get() as any).count;
    
    // Telephony metrics
    const totalCalls = (db.prepare('SELECT COUNT(*) as count FROM calls').get() as any).count;
    const connectedCalls = (db.prepare("SELECT COUNT(*) as count FROM calls WHERE disposition IN ('conectado', 'reuniao_agendada', 'pediu_retorno')").get() as any).count;
    const meetingsBooked = (db.prepare("SELECT COUNT(*) as count FROM calls WHERE disposition = 'reuniao_agendada'").get() as any).count;
    const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
    
    // Pipeline value
    const pipelineSum = (db.prepare("SELECT SUM(value) as total FROM deals WHERE status = 'aberto'").get() as any).total || 0;
    const totalDeals = (db.prepare('SELECT COUNT(*) as count FROM deals').get() as any).count;

    res.json({
      totalCompanies,
      totalContacts,
      pendingTasks,
      overdueTasks,
      totalCadences,
      totalCalls,
      connectedCalls,
      meetingsBooked,
      connectRate,
      pipelineValue: pipelineSum,
      totalDeals,
      conversionRate: totalCompanies > 0 ? Math.round((connectedCalls + 1) / (totalCompanies + 1) * 65) : 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/leads/prioritarios', (req: Request, res: Response) => {
  try {
    const leads = db.prepare(`
      SELECT 
        c.id, 
        c.name, 
        c.role,
        c.email, 
        c.phone, 
        c.tags,
        co.name as company, 
        co.segment,
        co.size,
        'Prospecção Ativa' as stage,
        CASE WHEN c.consent = 1 THEN 'alta' ELSE 'baixa' END as priority,
        (SELECT COUNT(*) FROM calls WHERE contact_id = c.id) as call_count,
        (SELECT disposition FROM calls WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_call_status
      FROM contacts c
      LEFT JOIN companies co ON c.company_id = co.id
      ORDER BY c.consent DESC, call_count ASC, c.created_at DESC
      LIMIT 15
    `).all();
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. POWER DIALER & CALL QUEUE
// ==========================================
app.get('/api/calls/queue', (req: Request, res: Response) => {
  try {
    const queue = db.prepare(`
      SELECT 
        c.id,
        c.name,
        c.role,
        c.phone,
        c.email,
        c.observations,
        c.tags,
        co.id as company_id,
        co.name as company_name,
        co.segment as company_segment,
        co.size as company_size,
        co.city,
        co.state,
        (SELECT COUNT(*) FROM calls WHERE contact_id = c.id) as total_attempts,
        (SELECT disposition FROM calls WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_disposition,
        (SELECT created_at FROM calls WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_call_date
      FROM contacts c
      INNER JOIN companies co ON c.company_id = co.id
      WHERE c.phone IS NOT NULL AND LENGTH(c.phone) >= 8
      ORDER BY total_attempts ASC, c.created_at DESC
      LIMIT 50
    `).all();
    res.json(queue);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. CALL RECORDS (TELEPHONY LOGS & AI HOOKS)
// ==========================================
app.get('/api/calls', (req: Request, res: Response) => {
  try {
    const calls = db.prepare(`
      SELECT 
        cl.*,
        c.name as contact_name,
        c.role as contact_role,
        co.name as company_name
      FROM calls cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      LEFT JOIN companies co ON cl.company_id = co.id
      ORDER BY cl.created_at DESC
      LIMIT 100
    `).all();
    res.json(calls);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/calls', (req: Request, res: Response) => {
  try {
    const {
      company_id,
      contact_id,
      phone_number,
      call_type,
      status,
      disposition,
      duration_seconds,
      notes,
      sentiment,
      objections_detected,
      transcript,
      ai_summary,
      next_step,
      recording_url,
      create_followup,
      followup_date,
      followup_title
    } = req.body;

    if (!phone_number || !disposition) {
      return res.status(400).json({ error: 'Número de telefone e status da chamada são obrigatórios' });
    }

    const insertCall = db.prepare(`
      INSERT INTO calls (
        company_id, contact_id, phone_number, call_type, status, disposition, 
        duration_seconds, notes, sentiment, objections_detected, transcript, 
        ai_summary, next_step, recording_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertCall.run(
      company_id || null,
      contact_id || null,
      phone_number,
      call_type || 'outbound',
      status || 'completed',
      disposition,
      duration_seconds || 0,
      notes || '',
      sentiment || 'neutro',
      objections_detected || '',
      transcript || '',
      ai_summary || '',
      next_step || '',
      recording_url || ''
    );

    const callId = result.lastInsertRowid;

    // Log Activity
    db.prepare(`
      INSERT INTO activity_logs (entity_type, entity_id, action_type, title, description)
      VALUES (?, ?, ?, ?, ?)
    `).run('call', callId, 'call', `Ligação para ${phone_number} [${disposition}]`, notes || 'Registro de chamada VoIP');

    // Auto-create Follow-up Task if requested or when disposition is 'pediu_retorno' / 'reuniao_agendada'
    if (create_followup || disposition === 'pediu_retorno' || disposition === 'reuniao_agendada') {
      const taskTitle = followup_title || (
        disposition === 'reuniao_agendada' 
          ? 'Reunião de Demonstração / Diagnóstico' 
          : 'Retornar Ligação (Follow-up de Cold Call)'
      );
      const due = followup_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const taskType = disposition === 'reuniao_agendada' ? 'reuniao' : 'ligacao';
      
      db.prepare(`
        INSERT INTO tasks (title, description, priority, status, task_type, due_date, company_id, contact_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskTitle,
        `Follow-up automático gerado após cold call de ${duration_seconds}s. Notas: ${notes || 'Sem observações.'}`,
        disposition === 'reuniao_agendada' ? 'alta' : 'media',
        'pendente',
        taskType,
        due,
        company_id || null,
        contact_id || null
      );
    }

    // Auto update contact status if qualified / meeting booked
    if (contact_id && disposition === 'reuniao_agendada') {
      db.prepare("UPDATE companies SET status = 'cliente' WHERE id = (SELECT company_id FROM contacts WHERE id = ?)").run(contact_id);
    }

    res.status(201).json({ id: callId, message: 'Chamada registrada com sucesso', disposition });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// AI Call Summarizer & Objection Analyzer (Engine Inteligente)
app.post('/api/calls/ai-summarize', (req: Request, res: Response) => {
  try {
    const { transcript, notes, disposition } = req.body;
    const textToAnalyze = `${transcript || ''} ${notes || ''}`;

    const rawObjections = detectObjections(textToAnalyze);
    const objectionLabels: Record<string, string> = {
      preco: 'Preço / Orçamento',
      tempo: 'Falta de tempo',
      necessidade: 'Não vê necessidade',
      autoridade: 'Falta de autoridade / decisores'
    };
    const objections = rawObjections.map((key) => objectionLabels[key] || key);

    let sentiment = 'neutro';
    const lowerText = textToAnalyze.toLowerCase();
    if (disposition === 'reuniao_agendada' || lowerText.includes('adorei') || lowerText.includes('ótimo') || lowerText.includes('faz sentido')) {
      sentiment = 'positivo';
    } else if (disposition === 'sem_interesse' || lowerText.includes('não quero') || lowerText.includes('descarte')) {
      sentiment = 'negativo';
    } else if (objections.length > 0) {
      sentiment = 'objecao';
    }

    const summary = summarizeCall(textToAnalyze, disposition);
    const nextStep = suggestNextStep(disposition);
    const coachTip = generateCoachTip(disposition, rawObjections);

    res.json({
      sentiment,
      objections_detected: objections.join(', '),
      ai_summary: summary,
      next_step: nextStep,
      coach_tip: coachTip
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. SCRIPTS & BATTLECARDS (COLD CALL HUD)
// ==========================================
app.get('/api/scripts', (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    let sql = 'SELECT * FROM scripts';
    const params: any[] = [];
    if (category) {
      sql += ' WHERE category = ?';
      params.push(category);
    }
    sql += ' ORDER BY id ASC';
    const scripts = db.prepare(sql).all(...params);
    res.json(scripts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scripts', (req: Request, res: Response) => {
  try {
    const { category, title, trigger_text, content, tips, stage } = req.body;
    if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    const result = db.prepare(`
      INSERT INTO scripts (category, title, trigger_text, content, tips, stage)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(category || 'script_abertura', title, trigger_text || '', content, tips || '', stage || 'todos');
    res.status(201).json({ id: result.lastInsertRowid, title });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/scripts/:id', (req: Request, res: Response) => {
  try {
    const { category, title, trigger_text, content, tips, stage } = req.body;
    const result = db.prepare(`
      UPDATE scripts SET category=?, title=?, trigger_text=?, content=?, tips=?, stage=? WHERE id=?
    `).run(category, title, trigger_text, content, tips, stage, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Script não encontrado' });
    res.json({ id: Number(req.params.id), title });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/scripts/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM scripts WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Script não encontrado' });
    res.json({ message: 'Script removido' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. DEALS & OPPORTUNITIES (PIPELINE KANBAN)
// ==========================================
app.get('/api/deals', (req: Request, res: Response) => {
  try {
    const deals = db.prepare(`
      SELECT 
        d.*,
        co.name as company_name,
        co.segment as company_segment,
        c.name as contact_name,
        c.phone as contact_phone,
        c.email as contact_email,
        ps.name as stage_name,
        ps.stage_order,
        ps.probability as stage_probability,
        ps.is_won as stage_is_won
      FROM deals d
      LEFT JOIN companies co ON d.company_id = co.id
      LEFT JOIN contacts c ON d.contact_id = c.id
      LEFT JOIN pipeline_stages ps ON d.stage_id = ps.id
      ORDER BY d.created_at DESC
    `).all();
    res.json(deals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/deals', (req: Request, res: Response) => {
  try {
    const { company_id, contact_id, stage_id, title, value, probability, expected_close_date } = req.body;
    if (!title || !company_id) return res.status(400).json({ error: 'Título e empresa são obrigatórios' });
    
    // Default stage if not provided
    let sId = stage_id;
    if (!sId) {
      const firstStage = db.prepare('SELECT id FROM pipeline_stages ORDER BY stage_order ASC LIMIT 1').get();
      sId = firstStage ? firstStage.id : null;
    }

    const result = db.prepare(`
      INSERT INTO deals (company_id, contact_id, stage_id, title, value, probability, expected_close_date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(company_id, contact_id || null, sId, title, value || 0, probability || 10, expected_close_date || null);
    
    res.status(201).json({ id: result.lastInsertRowid, title, value });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/deals/:id', (req: Request, res: Response) => {
  try {
    const { stage_id, title, value, probability, expected_close_date, loss_reason, status } = req.body;
    const result = db.prepare(`
      UPDATE deals SET stage_id=?, title=?, value=?, probability=?, expected_close_date=?, loss_reason=?, status=?, updated_at=DATETIME('now')
      WHERE id=?
    `).run(stage_id, title, value, probability, expected_close_date, loss_reason, status, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Oportunidade não encontrada' });
    res.json({ id: Number(req.params.id), message: 'Oportunidade atualizada' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/deals/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM deals WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Oportunidade não encontrada' });
    res.json({ message: 'Oportunidade removida' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. PIPELINE STAGES
// ==========================================
app.get('/api/pipeline-stages', (req: Request, res: Response) => {
  try {
    const stages = db.prepare(`
      SELECT 
        ps.*,
        (SELECT COUNT(*) FROM deals WHERE stage_id = ps.id) as deal_count,
        (SELECT COALESCE(SUM(value), 0) FROM deals WHERE stage_id = ps.id) as total_value
      FROM pipeline_stages ps 
      ORDER BY ps.stage_order ASC
    `).all();
    res.json(stages);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/pipeline-stages', (req: Request, res: Response) => {
  try {
    const { name, stage_order, probability, is_won, color } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const result = db.prepare('INSERT INTO pipeline_stages (name, stage_order, probability, is_won, color) VALUES (?, ?, ?, ?, ?)')
      .run(name, stage_order ?? 0, probability ?? 0, is_won ? 1 : 0, color || '#6366F1');
    res.status(201).json({ id: result.lastInsertRowid, name, stage_order, probability, is_won });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/pipeline-stages/:id', (req: Request, res: Response) => {
  try {
    const { name, stage_order, probability, is_won, color } = req.body;
    const result = db.prepare('UPDATE pipeline_stages SET name=?, stage_order=?, probability=?, is_won=?, color=? WHERE id=?')
      .run(name, stage_order, probability, is_won ? 1 : 0, color || '#6366F1', Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Estágio não encontrado' });
    res.json({ id: Number(req.params.id), name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/pipeline-stages/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM pipeline_stages WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Estágio não encontrado' });
    res.json({ message: 'Estágio removido' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. COMPANIES
// ==========================================
app.get('/api/companies', (req: Request, res: Response) => {
  try {
    const companies = db.prepare(`
      SELECT 
        co.*,
        (SELECT COUNT(*) FROM contacts WHERE company_id = co.id) as contact_count,
        (SELECT COUNT(*) FROM deals WHERE company_id = co.id) as deal_count,
        (SELECT COUNT(*) FROM calls WHERE company_id = co.id) as call_count
      FROM companies co 
      ORDER BY co.created_at DESC
    `).all();
    res.json(companies);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/companies/:id', (req: Request, res: Response) => {
  try {
    const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(Number(req.params.id));
    if (!company) return res.status(404).json({ error: 'Empresa não encontrada' });
    const contacts = db.prepare('SELECT * FROM contacts WHERE company_id = ?').all(Number(req.params.id));
    const deals = db.prepare('SELECT * FROM deals WHERE company_id = ?').all(Number(req.params.id));
    const calls = db.prepare('SELECT * FROM calls WHERE company_id = ? ORDER BY created_at DESC').all(Number(req.params.id));
    res.json({ ...company, contacts, deals, calls });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies', (req: Request, res: Response) => {
  try {
    const { name, segment, size, status, cnpj, website, city, state } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const result = db.prepare(`
      INSERT INTO companies (name, segment, size, status, cnpj, website, city, state) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, segment || '', size || 'media', status || 'prospect', cnpj || '', website || '', city || '', state || '');
    res.status(201).json({ id: result.lastInsertRowid, name, segment, size, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/companies/:id', (req: Request, res: Response) => {
  try {
    const { name, segment, size, status, cnpj, website, city, state } = req.body;
    const result = db.prepare(`
      UPDATE companies SET name=?, segment=?, size=?, status=?, cnpj=?, website=?, city=?, state=?, updated_at=DATETIME('now') 
      WHERE id=?
    `).run(name, segment, size, status, cnpj, website, city, state, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json({ id: Number(req.params.id), name, segment, size, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/companies/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM contacts WHERE company_id = ?').run(Number(req.params.id));
    db.prepare('DELETE FROM deals WHERE company_id = ?').run(Number(req.params.id));
    const result = db.prepare('DELETE FROM companies WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Empresa não encontrada' });
    res.json({ message: 'Empresa e dados associados removidos' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/companies/bulk-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhuma empresa selecionada' });
    }
    const delContacts = db.prepare('DELETE FROM contacts WHERE company_id = ?');
    const delDeals = db.prepare('DELETE FROM deals WHERE company_id = ?');
    const delCompany = db.prepare('DELETE FROM companies WHERE id = ?');
    let removed = 0;
    db.transaction(() => {
      for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isFinite(id)) continue;
        delContacts.run(id);
        delDeals.run(id);
        removed += delCompany.run(id).changes;
      }
    })();
    res.json({ message: `${removed} empresa(s) e dados associados removidos`, removed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. CONTACTS
// ==========================================
app.get('/api/contacts', (req: Request, res: Response) => {
  try {
    const contacts = db.prepare(`
      SELECT 
        c.*, 
        co.name as company_name,
        co.segment as company_segment,
        (SELECT COUNT(*) FROM calls WHERE contact_id = c.id) as call_count,
        (SELECT disposition FROM calls WHERE contact_id = c.id ORDER BY created_at DESC LIMIT 1) as last_disposition
      FROM contacts c 
      LEFT JOIN companies co ON c.company_id = co.id 
      ORDER BY c.created_at DESC
    `).all();
    res.json(contacts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/contacts/:id', (req: Request, res: Response) => {
  try {
    const contact = db.prepare(`
      SELECT c.*, co.name as company_name, co.segment as company_segment 
      FROM contacts c 
      LEFT JOIN companies co ON c.company_id = co.id 
      WHERE c.id = ?
    `).get(Number(req.params.id));
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    
    const calls = db.prepare('SELECT * FROM calls WHERE contact_id = ? ORDER BY created_at DESC').all(Number(req.params.id));
    const tasks = db.prepare('SELECT * FROM tasks WHERE contact_id = ? ORDER BY due_date ASC').all(Number(req.params.id));
    res.json({ ...contact, calls, tasks });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts', (req: Request, res: Response) => {
  try {
    const { company_id, name, role, phone, email, source, consent, tags, observations, linkedin } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    
    const result = db.prepare(`
      INSERT INTO contacts (company_id, name, role, phone, email, source, consent, tags, observations, linkedin) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(company_id || null, name, role || '', phone || '', email || '', source || 'cold_call', consent ?? 1, tags || '', observations || '', linkedin || '');
    
    res.status(201).json({ id: result.lastInsertRowid, name, company_id });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/contacts/:id', (req: Request, res: Response) => {
  try {
    const { name, role, phone, email, source, consent, tags, observations, company_id, linkedin } = req.body;
    const result = db.prepare(`
      UPDATE contacts SET name=?, role=?, phone=?, email=?, source=?, consent=?, tags=?, observations=?, company_id=?, linkedin=?, updated_at=DATETIME('now') 
      WHERE id=?
    `).run(name, role, phone, email, source, consent, tags, observations, company_id, linkedin, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json({ id: Number(req.params.id), name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/contacts/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json({ message: 'Contato removido' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/contacts/bulk-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Nenhum contato selecionado' });
    }
    const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
    let removed = 0;
    db.transaction(() => {
      for (const raw of ids) {
        const id = Number(raw);
        if (!Number.isFinite(id)) continue;
        removed += stmt.run(id).changes;
      }
    })();
    res.json({ message: `${removed} contato(s) removido(s)`, removed });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. TASKS & FOLLOW-UPS
// ==========================================
app.get('/api/tasks', (req: Request, res: Response) => {
  try {
    const tasks = db.prepare(`
      SELECT 
        t.*,
        c.name as contact_name,
        c.phone as contact_phone,
        co.name as company_name
      FROM tasks t
      LEFT JOIN contacts c ON t.contact_id = c.id
      LEFT JOIN companies co ON t.company_id = co.id
      ORDER BY t.status = 'pendente' DESC, t.due_date ASC, t.created_at DESC
    `).all();
    res.json(tasks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks', (req: Request, res: Response) => {
  try {
    const { title, description, assigned_to, priority, status, task_type, due_date, company_id, contact_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Título é obrigatório' });
    const result = db.prepare(`
      INSERT INTO tasks (title, description, assigned_to, priority, status, task_type, due_date, company_id, contact_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || '', assigned_to || 'SDR', priority || 'media', status || 'pendente', task_type || 'ligacao', due_date || null, company_id || null, contact_id || null);
    res.status(201).json({ id: result.lastInsertRowid, title });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', (req: Request, res: Response) => {
  try {
    const { title, description, assigned_to, priority, status, task_type, due_date, company_id, contact_id } = req.body;
    const completed_at = status === 'concluida' ? new Date().toISOString() : null;
    const result = db.prepare(`
      UPDATE tasks SET title=?, description=?, assigned_to=?, priority=?, status=?, task_type=?, due_date=?, company_id=?, contact_id=?, completed_at=?, updated_at=DATETIME('now') 
      WHERE id=?
    `).run(title, description, assigned_to, priority, status, task_type, due_date, company_id, contact_id, completed_at, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ id: Number(req.params.id), title, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    res.json({ message: 'Tarefa removida' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10. CADENCES & SEQUENCES
// ==========================================
app.get('/api/cadences', (req: Request, res: Response) => {
  try {
    const cadences = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM cadence_steps WHERE cadence_id = c.id) as step_count,
        (SELECT COUNT(*) FROM cadence_enrollments WHERE cadence_id = c.id) as enrolled_count
      FROM cadences c
      ORDER BY c.created_at DESC
    `).all();
    res.json(cadences);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cadences/:id', (req: Request, res: Response) => {
  try {
    const cadence = db.prepare('SELECT * FROM cadences WHERE id = ?').get(Number(req.params.id));
    if (!cadence) return res.status(404).json({ error: 'Cadência não encontrada' });
    const steps = db.prepare('SELECT * FROM cadence_steps WHERE cadence_id = ? ORDER BY step_order ASC').all(Number(req.params.id));
    const enrollments = db.prepare(`
      SELECT ce.*, ct.name as contact_name, ct.phone as contact_phone, co.name as company_name 
      FROM cadence_enrollments ce
      JOIN contacts ct ON ce.contact_id = ct.id
      LEFT JOIN companies co ON ct.company_id = co.id
      WHERE ce.cadence_id = ?
    `).all(Number(req.params.id));
    res.json({ ...cadence, steps, enrollments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cadences', (req: Request, res: Response) => {
  try {
    const { name, description, type, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    const result = db.prepare('INSERT INTO cadences (name, description, type, status) VALUES (?, ?, ?, ?)')
      .run(name, description || '', type || 'sequencia', status || 'ativo');
    res.status(201).json({ id: result.lastInsertRowid, name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cadences/:id', (req: Request, res: Response) => {
  try {
    const { name, description, type, status } = req.body;
    const result = db.prepare("UPDATE cadences SET name=?, description=?, type=?, status=?, updated_at=DATETIME('now') WHERE id=?")
      .run(name, description, type, status, Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Cadência não encontrada' });
    res.json({ id: Number(req.params.id), name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cadences/:id', (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM cadence_steps WHERE cadence_id = ?').run(Number(req.params.id));
    db.prepare('DELETE FROM cadence_enrollments WHERE cadence_id = ?').run(Number(req.params.id));
    const result = db.prepare('DELETE FROM cadences WHERE id = ?').run(Number(req.params.id));
    if (result.changes === 0) return res.status(404).json({ error: 'Cadência não encontrada' });
    res.json({ message: 'Cadência removida' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cadences/:id/steps', (req: Request, res: Response) => {
  try {
    const steps = db.prepare('SELECT * FROM cadence_steps WHERE cadence_id = ? ORDER BY step_order ASC').all(Number(req.params.id));
    res.json(steps);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cadences/:id/steps', (req: Request, res: Response) => {
  try {
    const { step_order, type, channel, wait_time, template_subject, template_body } = req.body;
    if (!type) return res.status(400).json({ error: 'Tipo de etapa é obrigatório' });
    const result = db.prepare(`
      INSERT INTO cadence_steps (cadence_id, step_order, type, channel, wait_time, template_subject, template_body) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(Number(req.params.id), step_order ?? 0, type, channel || '', wait_time || 0, template_subject || '', template_body || '');
    res.status(201).json({ id: result.lastInsertRowid, type });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cadence-steps/:id', (req: Request, res: Response) => {
  try {
    const result = db.prepare('DELETE FROM cadence_steps WHERE id = ?').run(Number(req.params.id));
    res.json({ message: 'Etapa removida' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Enroll Contact into Cadence
app.post('/api/cadences/:id/enroll', (req: Request, res: Response) => {
  try {
    const { contact_id } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'ID do contato obrigatório' });
    
    // Check if already enrolled
    const exists = db.prepare('SELECT id FROM cadence_enrollments WHERE cadence_id = ? AND contact_id = ?').get(Number(req.params.id), contact_id);
    if (exists) return res.status(400).json({ error: 'Contato já está matriculado nesta cadência' });

    const result = db.prepare(`
      INSERT INTO cadence_enrollments (cadence_id, contact_id, current_step_order, status, next_action_due)
      VALUES (?, ?, 1, 'ativo', DATETIME('now'))
    `).run(Number(req.params.id), contact_id);

    res.status(201).json({ id: result.lastInsertRowid, message: 'Contato matriculado na cadência com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 11. SIP & VOIP CONFIGURATION
// ==========================================
app.get('/api/sip-config', (req: Request, res: Response) => {
  try {
    let config = db.prepare('SELECT * FROM sip_configs ORDER BY id DESC LIMIT 1').get();
    if (!config) {
      db.prepare("INSERT INTO sip_configs (provider_name, is_simulator, caller_id) VALUES ('Simulador Web Audio', 1, '+1 555 010 0000')").run();
      config = db.prepare('SELECT * FROM sip_configs ORDER BY id DESC LIMIT 1').get();
    }
    // Never expose the SIP credential to the browser or API clients.
    const publicConfig = { ...(config as any) };
    delete publicConfig.password;
    res.json(publicConfig);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sip-config', (req: Request, res: Response) => {
  try {
  const { provider_name, is_simulator, ws_server, sip_domain, username, password, caller_id, dtmf_volume, auto_record } = req.body;
  if (!is_simulator) {
    if (!ws_server || !(ws_server.startsWith('ws://') || ws_server.startsWith('wss://'))) {
      return res.status(400).json({ error: 'Servidor WebSocket deve começar com ws:// ou wss:// (ex: wss://sip.provedor.com.br:8089/ws).' });
    }
    if (!sip_domain) {
      return res.status(400).json({ error: 'Domínio SIP é obrigatório para conexão real.' });
    }
    if (!username) {
      return res.status(400).json({ error: 'Usuário/ramal SIP é obrigatório para conexão real.' });
    }
    if (!password || !password.trim()) {
      return res.status(400).json({ error: 'Senha SIP é obrigatória para conexão real.' });
    }
  }
  let config = db.prepare('SELECT id FROM sip_configs ORDER BY id DESC LIMIT 1').get();
    
    if (config) {
      db.prepare(`
        UPDATE sip_configs SET 
          provider_name=?, is_simulator=?, ws_server=?, sip_domain=?, username=?, password=?, 
          caller_id=?, dtmf_volume=?, auto_record=?, updated_at=DATETIME('now')
        WHERE id=?
      `).run(provider_name, is_simulator ? 1 : 0, ws_server, sip_domain, username, password, caller_id, dtmf_volume, auto_record ? 1 : 0, config.id);
    } else {
      db.prepare(`
        INSERT INTO sip_configs (provider_name, is_simulator, ws_server, sip_domain, username, password, caller_id, dtmf_volume, auto_record)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(provider_name, is_simulator ? 1 : 0, ws_server, sip_domain, username, password, caller_id, dtmf_volume, auto_record ? 1 : 0);
    }

    res.json({ message: 'Configuração VoIP / SIP atualizada com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 12. BATCH CSV IMPORT & BACKUP
// ==========================================
app.post('/api/import/contacts', (req: Request, res: Response) => {
  try {
    const { rows } = req.body; // Array of objects
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Nenhum registro para importar' });
    }

    let imported = 0;
    const insertComp = db.prepare('INSERT INTO companies (name, segment, size, status, city, state) VALUES (?, ?, ?, ?, ?, ?)');
    const insertCont = db.prepare('INSERT INTO contacts (company_id, name, role, phone, email, source, consent, tags, observations) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

    const transaction = db.transaction((records: any[]) => {
      for (const row of records) {
        if (!row.name && !row.company) continue;
        
        // Check or create company
        let companyId = null;
        if (row.company) {
          const existingComp = db.prepare('SELECT id FROM companies WHERE name = ? COLLATE NOCASE').get(row.company);
          if (existingComp) {
            companyId = existingComp.id;
          } else {
            companyId = insertComp.run(row.company, row.segment || 'Geral', row.size || 'media', 'prospect', row.city || '', row.state || '').lastInsertRowid;
          }
        }

        if (row.name) {
          insertCont.run(
            companyId,
            row.name,
            row.role || 'Tomador de Decisão',
            row.phone || '',
            row.email || '',
            row.source || 'importacao_csv',
            1,
            row.tags || 'Importado',
            row.observations || ''
          );
          imported++;
        }
      }
    });

    transaction(rows);

    res.json({ imported, message: `Importação concluída com sucesso! ${imported} contatos importados.` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Activity logs
app.get('/api/activities', (req: Request, res: Response) => {
  try {
    const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 30').all();
    res.json(logs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 13. MOBILE GSM GATEWAY & LOCAL NETWORK SYNC
// ==========================================
app.get('/api/network-info', (req: Request, res: Response) => {
  const localIp = getLocalIpAddress();
  const isConnected = gatewayClients.length > 0 && lastMobileHeartbeat !== null && (Date.now() - lastMobileHeartbeat.getTime() < 30000);
  res.json({
    localIp,
    port: PORT,
    fullUrl: `http://${localIp}:${PORT}`,
    isMobileConnected: isConnected,
    clientCount: gatewayClients.length,
    pairedDeviceName: isConnected ? pairedDeviceName : 'Desconectado',
    lastSeen: lastMobileHeartbeat,
    activeGatewayCall
  });
});

// SSE endpoint where Android phones connect to receive dial requests
app.get('/api/gateway/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  gatewayClients.push(res);
  lastMobileHeartbeat = new Date();

  // Welcome event
  res.write(`data: ${JSON.stringify({ type: 'GATEWAY_CONNECTED', serverIp: getLocalIpAddress(), timestamp: new Date() })}\n\n`);

  // Heartbeat interval
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'PING', timestamp: new Date() })}\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    gatewayClients = gatewayClients.filter(c => c !== res);
  });
});

// Mobile app registers itself
app.post('/api/gateway/register', (req: Request, res: Response) => {
  const { deviceName, simCarrier, simReady } = req.body;
  pairedDeviceName = deviceName || 'Android Device (GSM)';
  lastMobileHeartbeat = new Date();
  res.json({ message: 'Aparelho GSM registrado com sucesso no servidor do PC', serverIp: getLocalIpAddress() });
});

// Mobile app heartbeat (mantém o flag "celular online" vivo enquanto o SSE estiver aberto)
app.post('/api/gateway/heartbeat', (req: Request, res: Response) => {
  const { deviceName } = req.body;
  lastMobileHeartbeat = new Date();
  if (deviceName) {
    pairedDeviceName = deviceName;
  }
  res.json({ ok: true, serverTime: new Date() });
});

// PC triggers a dial command to the phone
app.post('/api/gateway/dial', (req: Request, res: Response) => {
  const { phone, leadId, leadName, company, role } = req.body;
  if (!phone) return res.status(400).json({ error: 'Número de telefone é obrigatório' });

  const heartbeatAgeMs = lastMobileHeartbeat ? Date.now() - lastMobileHeartbeat.getTime() : Infinity;
  if (gatewayClients.length === 0 || heartbeatAgeMs > 30000) {
    return res.status(503).json({ error: 'Celular GSM não está conectado ou ficou offline. Verifique o app do gateway no celular.' });
  }

  activeGatewayCall = { phone, leadId, leadName, company, role, startedAt: new Date() };

  const payload = JSON.stringify({
    type: 'DIAL_COMMAND',
    phone,
    leadId,
    leadName,
    company,
    role,
    timestamp: new Date()
  });

  // Broadcast to all connected Android devices
  gatewayClients.forEach(client => {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch(e) {}
  });

  res.json({
    message: 'Comando de discagem transmitido para o celular conectado',
    sentToDevices: gatewayClients.length,
    phone
  });
});

// Mobile updates call state (e.g. call ended, duration)
app.post('/api/gateway/call-status', (req: Request, res: Response) => {
  const { status, state, durationSeconds, disposition, notes, phone } = req.body;
  const currentStatus = status || state; // Accept both status or state
  
  lastMobileHeartbeat = new Date();
  if (currentStatus === 'ended') {
    activeGatewayCall = null;
  }
  res.json({ message: 'Status da chamada móvel atualizado' });
});

// Cleanup: limpa chamada GSM esquecida pelo celular (app fechado no meio da ligação)
setInterval(() => {
  if (activeGatewayCall && activeGatewayCall.startedAt) {
    const ageMs = Date.now() - new Date(activeGatewayCall.startedAt).getTime();
    if (ageMs > 10 * 60 * 1000) {
      console.warn(`[Gateway] Limpando chamada GSM esquecida (${activeGatewayCall.phone}) após 10 minutos sem status.`);
      activeGatewayCall = null;
    }
  }
}, 60000);

// Catch-all: serve React SPA
app.use((req: Request, res: Response, next: any) => {
  if (req.path.startsWith('/api/') || req.path === '/health') return next();
  res.sendFile(path.join(__dirname, '..', 'client', 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Prospecta CRM Enterprise VoIP running on http://localhost:${PORT}`);
});

export default app;
