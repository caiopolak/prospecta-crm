import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { Plus, Building2, PhoneCall } from 'lucide-react';
import { useVoIP } from '../context/VoIPContext';

interface Deal {
  id: number;
  company_id: number;
  contact_id: number;
  stage_id: number;
  title: string;
  value: number;
  probability: number;
  status: string;
  company_name: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
}

interface Stage {
  id: number;
  name: string;
  stage_order: number;
  probability: number;
  is_won: number;
  color: string;
  deal_count: number;
  total_value: number;
}

export default function Pipeline() {
  const { dialNumber } = useVoIP();
  const [stages, setStages] = useState<Stage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', company_id: 0, contact_id: 0, stage_id: 0, value: 10000, probability: 20 });
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [stagesRes, dealsRes, compRes, contRes] = await Promise.all([
        fetch('/api/pipeline-stages').then(r => r.json()),
        fetch('/api/deals').then(r => r.json()),
        fetch('/api/companies').then(r => r.json()),
        fetch('/api/contacts').then(r => r.json()),
      ]);
      setStages(stagesRes);
      setDeals(dealsRes);
      setCompanies(compRes);
      setContacts(contRes);
      setLoadError('');
    } catch {
      setLoadError('Não foi possível carregar o pipeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMoveStage = async (dealId: number, newStageId: number) => {
    const deal = deals.find(d => d.id === dealId);
    if (!deal) return;
    const stage = stages.find(s => s.id === newStageId);

    await fetch(`/api/deals/${dealId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...deal,
        stage_id: newStageId,
        probability: stage ? stage.probability : deal.probability,
        status: stage?.is_won ? 'ganho' : 'aberto'
      })
    });
    loadData();
  };

  const save = async () => {
    if (!form.title.trim() || !form.company_id) {
      setFormError('Título e Empresa são obrigatórios.');
      return;
    }
    setFormError('');
    await fetch('/api/deals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    setShowModal(false);
    setForm({ title: '', company_id: 0, contact_id: 0, stage_id: 0, value: 10000, probability: 20 });
    loadData();
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Pipeline &amp; Negócios B2B</h1>
          <p>Kanban visual de oportunidades geradas após Cold Calls e reuniões de diagnóstico</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>
            <Plus size={16} /> Nova Oportunidade
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-box">Carregando…</div>
      ) : loadError ? (
        <div className="empty-box">
          <p>{loadError}</p>
          <button className="btn btn-secondary btn-small" onClick={loadData}>Tentar novamente</button>
        </div>
      ) : (
        <div className="pipeline-board">
        {stages.map(stage => {
          const stageDeals = deals.filter(d => d.stage_id === stage.id);
          const stageSum = stageDeals.reduce((acc, curr) => acc + (curr.value || 0), 0);

          return (
            <div key={stage.id} className="pipeline-column">
              <div className="column-header" style={{ borderTop: `3px solid ${stage.color || '#6366F1'}` }}>
                <div className="column-title">
                  <h3>{stage.name}</h3>
                  <span className="badge badge-neutral">{stageDeals.length}</span>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'JetBrains Mono', color: '#34D399', fontWeight: 700 }}>
                  {formatCurrency(stageSum)}
                </div>
              </div>

              <div className="column-body">
                {stageDeals.length === 0 ? (
                  <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    Nenhum negócio
                  </div>
                ) : (
                  stageDeals.map(deal => (
                    <div key={deal.id} className="deal-card">
                      <div className="deal-title">{deal.title}</div>
                      <div className="deal-company">
                        <Building2 size={12} />
                        <span>{deal.company_name || 'Empresa'}</span>
                      </div>

                      {deal.contact_name && (
                        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{deal.contact_name}</span>
                          {deal.contact_phone && (
                            <button 
                              className="btn-dial-inline"
                              style={{ padding: '2px 6px', fontSize: 10 }}
                              onClick={() => dialNumber(deal.contact_phone, { name: deal.contact_name, phone: deal.contact_phone, company: deal.company_name })}
                            >
                              <PhoneCall size={10} /> Discar
                            </button>
                          )}
                        </div>
                      )}

                      <div className="deal-footer">
                        <span className="deal-value">{formatCurrency(deal.value)}</span>
                        
                        {/* Move stage buttons */}
                        <div style={{ display: 'flex', gap: 4 }}>
                          {stages.filter(s => s.id !== stage.id).slice(0, 2).map(targetStage => (
                            <button
                              key={targetStage.id}
                              className="btn btn-secondary btn-small"
                              style={{ padding: '2px 6px', fontSize: 10, gap: 4 }}
                              onClick={() => handleMoveStage(deal.id, targetStage.id)}
                              title={`Mover para ${targetStage.name}`}
                            >
                              &rarr;{' '}
                              <span
                                style={{ maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom' }}
                              >
                                {targetStage.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* New Deal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="deal-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="deal-modal-title">Nova Oportunidade no Pipeline</h2>
            <div className="form-group">
              <label htmlFor="deal-title">Título do Negócio *</label>
              <input id="deal-title" value={form.title} onChange={e => { setForm({...form, title: e.target.value}); if (formError) setFormError(''); }} placeholder="Ex: Implantação Software Q3" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="deal-company">Empresa *</label>
                <select id="deal-company" value={form.company_id} onChange={e => { setForm({...form, company_id: Number(e.target.value)}); if (formError) setFormError(''); }}>
                  <option value={0}>Selecione a empresa...</option>
                  {companies.map(co => <option key={co.id} value={co.id}>{co.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="deal-contact">Contato Principal</label>
                <select id="deal-contact" value={form.contact_id} onChange={e => setForm({...form, contact_id: Number(e.target.value)})}>
                  <option value={0}>Selecione o contato...</option>
                  {contacts.map(ct => <option key={ct.id} value={ct.id}>{ct.name} ({ct.company_name})</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="deal-value">Valor Potencial (R$)</label>
                <input id="deal-value" type="number" value={form.value} onChange={e => setForm({...form, value: Number(e.target.value)})} />
              </div>
              <div className="form-group">
                <label htmlFor="deal-stage">Estágio Inicial</label>
                <select id="deal-stage" value={form.stage_id} onChange={e => setForm({...form, stage_id: Number(e.target.value)})}>
                  <option value={0}>Padrão (1º Estágio)</option>
                  {stages.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              </div>
            </div>
            {formError && (
              <div className="form-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={save}>Criar Oportunidade</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
