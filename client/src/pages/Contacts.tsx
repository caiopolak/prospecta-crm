import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { Pagination } from '../components/Pagination';
import Checkbox from '../components/Checkbox';
import { Plus, Search, PhoneCall, Trash2, Edit } from 'lucide-react';
import { useVoIP } from '../context/VoIPContext';

interface Contact {
  id: number;
  company_id: number;
  company_name: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  source: string;
  consent: number;
  tags: string;
  observations: string;
  call_count: number;
  last_disposition: string;
}

const emptyContact = { company_id: 0, name: '', role: '', phone: '', email: '', source: 'cold_call', consent: 1, tags: '', observations: '', linkedin: '' };

export default function Contacts() {
  const { dialNumber, startPowerQueue, toast } = useVoIP();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyContact);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;
  
  // CSV Import state
  const [csvRawText, setCsvRawText] = useState('');
  const [importStatus, setImportStatus] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const [contactsRes, companiesRes] = await Promise.all([
        fetch('/api/contacts'),
        fetch('/api/companies'),
      ]);
      if (!contactsRes.ok) throw new Error('Falha na requisição');
      setContacts(await contactsRes.json());
      if (companiesRes.ok) setCompanies(await companiesRes.json());
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar os contatos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyContact); setFormError(''); setShowModal(true); };
  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      company_id: c.company_id || 0,
      name: c.name,
      role: c.role || '',
      phone: c.phone || '',
      email: c.email || '',
      source: c.source || 'cold_call',
      consent: c.consent ?? 1,
      tags: c.tags || '',
      observations: c.observations || '',
      linkedin: (c as any).linkedin || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name || !form.company_id) {
      setFormError('Nome e Empresa são obrigatórios.');
      return;
    }
    setFormError('');
    if (editing) {
      await fetch(`/api/contacts/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
    } else {
      await fetch('/api/contacts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
    }
    setShowModal(false);
    load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('Excluir este contato?')) return;
    await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
    load();
  };

  const splitCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(v => v.trim().replace(/^["']|["']$/g, ''));
  };

  const handleCsvImport = async () => {
    try {
      setImportStatus('Processando CSV...');
      const lines = csvRawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setImportStatus('Erro: CSV precisa ter cabeçalho e pelo menos uma linha.');
        return;
      }

      const headers = splitCsvLine(lines[0]).map(h => h.toLowerCase());
      const rows = [];

      for (let i = 1; i < lines.length; i++) {
        const values = splitCsvLine(lines[i]);
        const rowObj: any = {};
        headers.forEach((h, idx) => {
          rowObj[h] = values[idx] || '';
        });
        rows.push(rowObj);
      }

      const res = await fetch('/api/import/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });
      if (!res.ok) throw new Error('O servidor recusou a importação.');
      const data = await res.json();
      setImportStatus(data.message || 'Importado com sucesso!');
      setTimeout(() => {
        setShowImportModal(false);
        setCsvRawText('');
        load();
      }, 1500);
    } catch (e: any) {
      setImportStatus(`Erro na importação: ${e.message}`);
    }
  };

  const filtered = contacts.filter(c => 
    c.name?.toLowerCase().includes(search.toLowerCase()) || 
    c.company_name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const toggleSel = (id: number) => setSelected(prev => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const pageIds = pageItems.map(c => c.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  const somePageSelected = pageIds.some(id => selected.has(id));
  const toggleAllPage = () => setSelected(prev => {
    const n = new Set(prev);
    if (allPageSelected) pageIds.forEach(id => n.delete(id));
    else pageIds.forEach(id => n.add(id));
    return n;
  });

  const bulkDelete = async () => {
    if (!window.confirm(`Excluir ${selected.size} contato(s)? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch('/api/contacts/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setSelected(new Set());
      toast(data.message || 'Contatos removidos.');
      load();
    } catch (e) {
      toast('Não foi possível excluir os contatos selecionados.', 'error');
    }
  };

  const bulkDial = () => {
    const leads = contacts
      .filter(c => selected.has(c.id) && c.phone)
      .map(c => ({
        id: c.id, name: c.name, phone: c.phone, company: c.company_name,
        company_id: c.company_id, role: c.role, email: c.email,
        tags: c.tags, observations: c.observations
      }));
    if (leads.length === 0) {
      toast('Nenhum contato selecionado tem telefone.', 'error');
      return;
    }
    startPowerQueue(leads);
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Contatos &amp; Tomadores de Decisão</h1>
          <p>Diretório de leads B2B qualificados para campanhas multicanal e cold calls</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            Importar CSV
          </button>
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Novo Contato
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={16} className="text-muted" />
            <input 
              type="text" 
              placeholder="Buscar por nome, e-mail, telefone ou empresa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Total: <strong>{filtered.length} contatos</strong>
          </div>
        </div>

        {selected.size > 0 && (
          <div
            role="region"
            aria-label="Ações em massa"
            style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', margin: '4px 0 10px', borderRadius: 8, fontSize: 13,
              color: '#6EE7B7', background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.35)'
            }}
          >
            <strong>{selected.size} selecionado(s)</strong>
            <button className="btn btn-primary btn-small" onClick={bulkDial}>
              <PhoneCall size={13} /> Discar selecionados (Power Queue)
            </button>
            <button className="btn btn-danger btn-small" onClick={bulkDelete}>
              <Trash2 size={13} /> Excluir selecionados
            </button>
            <button className="btn btn-secondary btn-small" onClick={() => setSelected(new Set())}>
              Limpar seleção
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-box">Carregando…</div>
        ) : loadError ? (
          <div className="empty-box">
            <p>{loadError}</p>
            <button className="btn btn-secondary btn-small" onClick={load}>Tentar novamente</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-box">Nenhum contato encontrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected && !allPageSelected}
                    onChange={toggleAllPage}
                    aria-label="Selecionar todos da página"
                  />
                </th>
                <th>Contato</th>
                <th>Empresa</th>
                <th>Telefone / VoIP</th>
                <th>E-mail</th>
                <th>Origem</th>
                <th>Histórico</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map(c => (
                <tr key={c.id}>
                  <td>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onChange={() => toggleSel(c.id)}
                      aria-label={`Selecionar ${c.name}`}
                    />
                  </td>
                  <td>
                    <strong style={{ color: 'white' }}>{c.name}</strong>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{c.role || 'Tomador'}</div>
                  </td>
                  <td>{c.company_name || 'Sem Empresa'}</td>
                  <td>
                    {c.phone ? (
                      <span style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#38BDF8' }}>
                        {c.phone}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Sem telefone</span>
                    )}
                  </td>
                  <td>{c.email || '-'}</td>
                  <td><span className="badge badge-neutral">{c.source || 'cold_call'}</span></td>
                  <td>
                    <span className="badge badge-neutral">{c.call_count || 0} ligações</span>
                  </td>
                  <td>
                    {c.phone && (
                      <button 
                        className="btn-dial-inline"
                        onClick={() => dialNumber(c.phone, {
                          id: c.id,
                          name: c.name,
                          phone: c.phone,
                          company: c.company_name,
                          company_id: c.company_id,
                          role: c.role,
                          email: c.email,
                          tags: c.tags,
                          observations: c.observations
                        })}
                        style={{ marginRight: 6 }}
                      >
                        <PhoneCall size={12} /> Discar
                      </button>
                    )}
                    <button className="btn btn-secondary btn-small" onClick={() => openEdit(c)} title="Editar" aria-label={`Editar ${c.name}`}>
                      <Edit size={13} />
                    </button>
                    {' '}
                    <button className="btn btn-danger btn-small" onClick={() => remove(c.id)} title="Excluir" aria-label={`Excluir ${c.name}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {!loading && !loadError && filtered.length > 0 && (
          <Pagination page={safePage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        )}
      </div>

      {/* Contact Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="contact-modal-title">{editing ? 'Editar Contato' : 'Novo Contato'}</h2>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-name">Nome Completo *</label>
                <input id="contact-name" value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (formError) setFormError(''); }} placeholder="Ex: Carlos Eduardo" />
              </div>
              <div className="form-group">
                <label htmlFor="contact-company">Empresa *</label>
                <select id="contact-company" value={form.company_id} onChange={e => { setForm({...form, company_id: Number(e.target.value)}); if (formError) setFormError(''); }}>
                  <option value={0}>Selecione a empresa...</option>
                  {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-role">Cargo / Função</label>
                <input id="contact-role" value={form.role} onChange={e => setForm({...form, role: e.target.value})} placeholder="Ex: Diretor de Operações" />
              </div>
              <div className="form-group">
                <label htmlFor="contact-phone">Telefone / WhatsApp *</label>
                <input id="contact-phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+1 555 010 0101" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-email">E-mail Corporativo</label>
                <input id="contact-email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="contact@example.invalid" />
              </div>
              <div className="form-group">
                <label htmlFor="contact-source">Origem</label>
                <select id="contact-source" value={form.source} onChange={e => setForm({...form, source: e.target.value})}>
                  <option value="cold_call">Cold Call (Prospecção)</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="indicacao">Indicação</option>
                  <option value="site">Inbound Site</option>
                  <option value="evento">Evento / Feira</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="contact-tags">Tags (separadas por vírgula)</label>
                <input id="contact-tags" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} placeholder="Decisor, Frota, Alta Prioridade" />
              </div>
              <div className="form-group">
                <label htmlFor="contact-consent">Consentimento LGPD</label>
                <select id="contact-consent" value={form.consent} onChange={e => setForm({...form, consent: Number(e.target.value)})}>
                  <option value={1}>Consentido (Opt-in)</option>
                  <option value={0}>Não consentido</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="contact-observations">Observações / Perfil do Contato</label>
              <textarea id="contact-observations" value={form.observations} onChange={e => setForm({...form, observations: e.target.value})} placeholder="Notas sobre o perfil, dores ou preferências..." />
            </div>
            {formError && (
              <div className="form-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Salvar Contato' : 'Criar Contato'}</button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="csv-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="csv-modal-title">Importação Rápida via CSV</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Cole abaixo seus dados em formato CSV com cabeçalho (ex: <code>name,company,phone,email,role,city,state</code>).
            </p>
            <div className="form-group">
              <textarea 
                id="csv-paste"
                aria-label="Dados CSV para importação"
                style={{ height: '140px', fontFamily: 'JetBrains Mono', fontSize: 12 }}
                placeholder={`name,company,phone,email,role\nExample Contact,Example Company,+1 555 010 0101,contact@example.invalid,Sales role`}
                value={csvRawText}
                onChange={e => setCsvRawText(e.target.value)}
              />
            </div>
            {importStatus && (
              <div style={{ fontSize: 13, padding: '10px', background: 'rgba(99,102,241,0.15)', color: '#818CF8', borderRadius: 6, marginBottom: 14 }}>
                {importStatus}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Fechar</button>
              <button className="btn btn-success" onClick={handleCsvImport}>Importar Registros</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
