import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { Pagination } from '../components/Pagination';
import Checkbox from '../components/Checkbox';
import { Plus, Search, PhoneCall, Globe, MapPin, Trash2, Edit } from 'lucide-react';
import { useVoIP } from '../context/VoIPContext';

interface Company {
  id: number;
  name: string;
  segment: string;
  size: string;
  status: string;
  cnpj?: string;
  city: string;
  state: string;
  website: string;
  contact_count: number;
  deal_count: number;
  call_count: number;
}

const emptyCompany = { name: '', segment: '', size: 'media', status: 'prospect', cnpj: '', website: '', city: '', state: '' };

export default function Companies() {
  const { dialNumber, toast } = useVoIP();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyCompany);
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error('Falha na requisição');
      const data = await res.json();
      setCompanies(data);
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar as empresas.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyCompany); setFormError(''); setShowModal(true); };
  const openEdit = (c: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(c);
    setForm({
      name: c.name,
      segment: c.segment || '',
      size: c.size || 'media',
      status: c.status || 'prospect',
      cnpj: c.cnpj || '',
      website: c.website || '',
      city: c.city || '',
      state: c.state || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const viewDetails = async (id: number) => {
    const res = await fetch(`/api/companies/${id}`).then(r => r.json());
    setSelectedCompanyDetails(res);
  };

  const save = async () => {
    if (!form.name.trim()) {
      setFormError('Informe o nome da empresa para continuar.');
      return;
    }
    setFormError('');
    if (editing) {
      await fetch(`/api/companies/${editing.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
    } else {
      await fetch('/api/companies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
    }
    setShowModal(false);
    load();
  };

  const remove = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta empresa e todos os contatos/negócios associados?')) return;
    await fetch(`/api/companies/${id}`, { method: 'DELETE' });
    if (selectedCompanyDetails?.id === id) setSelectedCompanyDetails(null);
    load();
  };

  const filtered = companies.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()) || c.segment?.toLowerCase().includes(search.toLowerCase()));

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
    if (!window.confirm(`Excluir ${selected.size} empresa(s) e todos os contatos/negócios associados? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await fetch('/api/companies/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setSelected(new Set());
      setSelectedCompanyDetails(null);
      toast(data.message || 'Empresas removidas.');
      load();
    } catch (e) {
      toast('Não foi possível excluir as empresas selecionadas.', 'error');
    }
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Base de Empresas</h1>
          <p>Contas corporativas e organizações alvo de Prospecção B2B</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={openNew}>
            <Plus size={16} /> Nova Empresa
          </button>
        </div>
      </div>

      <div className={selectedCompanyDetails ? 'grid-split' : ''}>
        
        {/* Table list */}
        <div className="table-container">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={16} className="text-muted" />
              <input 
                type="text" 
                placeholder="Buscar empresas ou segmento..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Total: <strong>{filtered.length} empresas</strong>
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
              <strong>{selected.size} selecionada(s)</strong>
              <button className="btn btn-danger btn-small" onClick={bulkDelete}>
                <Trash2 size={13} /> Excluir selecionadas (+ contatos/deals)
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
            <div className="empty-box">Nenhuma empresa cadastrada.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                      <Checkbox
                        checked={allPageSelected}
                        indeterminate={somePageSelected && !allPageSelected}
                        onChange={toggleAllPage}
                        aria-label="Selecionar todas da página"
                      />
                  </th>
                  <th>Empresa</th>
                  <th>Segmento</th>
                  <th>Porte / Local</th>
                  <th>Status</th>
                  <th>Contatos / Deals</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map(c => (
                  <tr key={c.id} onClick={() => viewDetails(c.id)} style={{ cursor: 'pointer' }}>
                    <td onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(c.id)}
                          onChange={() => toggleSel(c.id)}
                          aria-label={`Selecionar ${c.name}`}
                        />
                    </td>
                    <td>
                      <strong style={{ color: 'white' }}>{c.name}</strong>
                      {c.website && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          <Globe size={10} style={{ display: 'inline', marginRight: 3 }} /> {c.website}
                        </div>
                      )}
                    </td>
                    <td>{c.segment || 'Geral'}</td>
                    <td>
                      <div>{c.size || 'Média'}</div>
                      {(c.city || c.state) && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          <MapPin size={10} style={{ display: 'inline', marginRight: 2 }} /> {c.city}/{c.state}
                        </div>
                      )}
                    </td>
                    <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                    <td>
                      <span className="badge badge-neutral" style={{ marginRight: 6 }}>{c.contact_count || 0} contatos</span>
                      <span className="badge badge-info">{c.deal_count || 0} deals</span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-small" onClick={e => openEdit(c, e)} title="Editar" aria-label={`Editar ${c.name}`}>
                        <Edit size={13} />
                      </button>
                      {' '}
                      <button className="btn btn-danger btn-small" onClick={e => remove(c.id, e)} title="Excluir" aria-label={`Excluir ${c.name}`}>
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

        {/* Company Details Drawer / Panel */}
        {selectedCompanyDetails && (
          <div className="table-container" style={{ padding: '24px', height: 'fit-content', background: '#111A2E' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'white' }}>{selectedCompanyDetails.name}</h3>
                <span className={`badge badge-${selectedCompanyDetails.status}`} style={{ marginTop: 6 }}>
                  {selectedCompanyDetails.status}
                </span>
              </div>
              <button className="btn-icon" onClick={() => setSelectedCompanyDetails(null)} aria-label="Fechar detalhes da empresa" style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                &times;
              </button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              <p><strong>Segmento:</strong> {selectedCompanyDetails.segment || '-'}</p>
              <p><strong>Porte:</strong> {selectedCompanyDetails.size || '-'}</p>
              <p><strong>Local:</strong> {selectedCompanyDetails.city}/{selectedCompanyDetails.state}</p>
              {selectedCompanyDetails.website && <p><strong>Web:</strong> {selectedCompanyDetails.website}</p>}
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              Contatos Associados ({selectedCompanyDetails.contacts?.length || 0})
            </h4>

            {selectedCompanyDetails.contacts?.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum contato cadastrado para esta empresa.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {selectedCompanyDetails.contacts.map((ct: any) => (
                  <div key={ct.id} style={{ background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: 13, color: 'white' }}>{ct.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ct.role || 'Cargo'} &bull; {ct.phone || 'Sem fone'}</div>
                    </div>
                    {ct.phone && (
                      <button className="btn-dial-inline" aria-label={`Discar para ${ct.name}`} onClick={() => dialNumber(ct.phone, { id: ct.id, name: ct.name, phone: ct.phone, company: selectedCompanyDetails.name, company_id: selectedCompanyDetails.id, role: ct.role, email: ct.email })}>
                        <PhoneCall size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              Histórico de Chamadas ({selectedCompanyDetails.calls?.length || 0})
            </h4>

            {selectedCompanyDetails.calls?.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhuma chamada registrada.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {selectedCompanyDetails.calls.map((cl: any) => (
                  <div key={cl.id} style={{ fontSize: 12, background: 'var(--bg-input)', padding: '8px 10px', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'white' }}>{cl.disposition}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{cl.duration_seconds}s</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="company-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="company-modal-title">{editing ? 'Editar Empresa' : 'Nova Empresa Corporativa'}</h2>
            <div className="form-group">
              <label htmlFor="company-name">Nome da Empresa *</label>
              <input id="company-name" value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (formError) setFormError(''); }} placeholder="Ex: Acme Corp" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company-segment">Segmento</label>
                <input id="company-segment" value={form.segment} onChange={e => setForm({...form, segment: e.target.value})} placeholder="Ex: Tecnologia" />
              </div>
              <div className="form-group">
                <label htmlFor="company-size">Porte</label>
                <select id="company-size" value={form.size} onChange={e => setForm({...form, size: e.target.value})}>
                  <option value="pequena">Pequena (1-50)</option>
                  <option value="media">Média (51-250)</option>
                  <option value="grande">Grande (251+)</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company-city">Cidade</label>
                <input id="company-city" value={form.city} onChange={e => setForm({...form, city: e.target.value})} placeholder="Ex: São Paulo" />
              </div>
              <div className="form-group">
                <label htmlFor="company-state">Estado (UF)</label>
                <input id="company-state" value={form.state} onChange={e => setForm({...form, state: e.target.value})} placeholder="Ex: SP" maxLength={2} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="company-website">Website</label>
                <input id="company-website" value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="www.empresa.com.br" />
              </div>
              <div className="form-group">
                <label htmlFor="company-status">Status</label>
                <select id="company-status" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                  <option value="prospect">Prospect</option>
                  <option value="lead">Lead</option>
                  <option value="cliente">Cliente</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
            {formError && (
              <div className="form-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>{editing ? 'Salvar' : 'Criar Empresa'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
