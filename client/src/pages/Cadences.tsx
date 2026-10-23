import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { Plus, PhoneCall } from 'lucide-react';
import { useVoIP } from '../context/VoIPContext';

export default function Cadences() {
  const { dialNumber } = useVoIP();
  const [cadences, setCadences] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showStepModal, setShowStepModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  
  const [form, setForm] = useState({ name: '', description: '', type: 'sequencia' });
  const [stepForm, setStepForm] = useState({ type: 'ligacao', channel: 'telefone', wait_time: 24, template_subject: '', template_body: '' });

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/cadences');
      if (!res.ok) throw new Error('Falha na requisição');
      const list = await res.json();
      setCadences(list);
      setLoadError('');
      if (selected) {
        const updated = list.find((c: any) => c.id === selected.id);
        if (updated) selectCadence(updated);
      }
    } catch {
      setLoadError('Não foi possível carregar as cadências.');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const selectCadence = async (cad: any) => {
    const detail = await fetch(`/api/cadences/${cad.id}`).then(r => r.json());
    setSelected(detail);
  };

  const saveCadence = async () => {
    if (!form.name.trim()) {
      setFormError('Informe o nome da cadência para continuar.');
      return;
    }
    setFormError('');
    await fetch('/api/cadences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
    });
    setShowModal(false);
    setForm({ name: '', description: '', type: 'sequencia' });
    load();
  };

  const addStep = async () => {
    if (!selected) return;
    await fetch(`/api/cadences/${selected.id}/steps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...stepForm, step_order: (selected.steps?.length || 0) + 1 })
    });
    setShowStepModal(false);
    selectCadence(selected);
    load();
  };

  const removeCadence = async (id: number) => {
    if (!window.confirm('Excluir esta cadência e suas etapas?')) return;
    await fetch(`/api/cadences/${id}`, { method: 'DELETE' });
    setSelected(null);
    load();
  };

  const stepLabels: Record<string, string> = {
    ligacao: 'Ligação / Cold Call',
    whatsapp: 'Mensagem WhatsApp',
    email: 'E-mail Automático',
    espera: 'Intervalo de Espera',
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Cadências &amp; Sequências Multicanal</h1>
          <p>Automatize toques sequenciais de Cold Call, WhatsApp e E-mail para maximizar conversões</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => { setFormError(''); setShowModal(true); }}>
            <Plus size={16} /> Nova Cadência
          </button>
        </div>
      </div>

      <div className={selected ? 'grid-detail' : ''}>
        
        {/* Cadences List */}
        <div className="table-container" style={{ padding: '16px', height: 'fit-content' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12 }}>Sequências Ativas</h3>
          {loading ? (
            <div className="empty-box">Carregando…</div>
          ) : loadError ? (
            <div className="empty-box">
              <p>{loadError}</p>
              <button className="btn btn-secondary btn-small" onClick={load}>Tentar novamente</button>
            </div>
          ) : cadences.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nenhuma cadência criada.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cadences.map(c => (
                <div 
                  key={c.id} 
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected?.id === c.id}
                  onClick={() => selectCadence(c)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectCadence(c);
                    }
                  }}
                  style={{
                    background: selected?.id === c.id ? '#1A263D' : 'var(--bg-input)',
                    border: selected?.id === c.id ? '1px solid var(--color-primary)' : '1px solid var(--border-subtle)',
                    padding: '12px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ color: 'white', fontSize: 13.5 }}>{c.name}</strong>
                    <span className={`badge badge-${c.status}`}>{c.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    {c.step_count || 0} etapas &bull; {c.enrolled_count || 0} leads matriculados
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected Cadence Details */}
        {selected && (
          <div className="table-container" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'white', marginBottom: 4 }}>{selected.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selected.description || 'Sem descrição cadastrada.'}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-small" onClick={() => setShowStepModal(true)}>
                  <Plus size={14} /> Adicionar Etapa
                </button>
                <button className="btn btn-danger btn-small" onClick={() => removeCadence(selected.id)}>
                  Excluir
                </button>
              </div>
            </div>

            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 14 }}>
              Fluxo da Sequência ({selected.steps?.length || 0} Toques)
            </h4>

            {selected.steps?.length === 0 ? (
              <div className="empty-box" style={{ padding: '30px' }}>
                <p>Nenhuma etapa configurada nesta cadência.</p>
              </div>
            ) : (
              <div className="steps-list" style={{ marginBottom: 24 }}>
                {selected.steps.map((step: any, idx: number) => (
                  <div key={step.id} className="step-item" style={{ background: '#111A2E', padding: '14px 18px' }}>
                    <div className="step-number">{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, color: 'white', fontSize: 13.5 }}>
                        {stepLabels[step.type] || step.type}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {step.wait_time > 0 ? `Aguardar ${step.wait_time}h após etapa anterior` : 'Execução imediata (Dia 0)'}
                        {step.channel && ` • Canal: ${step.channel}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'white', marginBottom: 12 }}>
              Leads Matriculados na Cadência ({selected.enrollments?.length || 0})
            </h4>

            {selected.enrollments?.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Nenhum lead em andamento nesta sequência.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Contato</th>
                    <th>Empresa</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.enrollments.map((en: any) => (
                    <tr key={en.id}>
                      <td><strong>{en.contact_name}</strong></td>
                      <td>{en.company_name || '-'}</td>
                      <td><span className={`badge badge-${en.status}`}>{en.status}</span></td>
                      <td>
                        {en.contact_phone && (
                          <button 
                            className="btn-dial-inline"
                            onClick={() => dialNumber(en.contact_phone, { name: en.contact_name, phone: en.contact_phone, company: en.company_name })}
                          >
                            <PhoneCall size={12} /> Discar Toque
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {/* New Cadence Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cadence-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="cadence-modal-title">Nova Cadência de Prospecção</h2>
            <div className="form-group">
              <label htmlFor="cadence-name">Nome da Cadência *</label>
              <input id="cadence-name" value={form.name} onChange={e => { setForm({...form, name: e.target.value}); if (formError) setFormError(''); }} placeholder="Ex: Outbound Enterprise - 5 Toques" />
            </div>
            <div className="form-group">
              <label htmlFor="cadence-description">Descrição</label>
              <input id="cadence-description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Ex: Foco em diretores de TI" />
            </div>
            <div className="form-group">
              <label htmlFor="cadence-type">Tipo</label>
              <select id="cadence-type" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="sequencia">Sequência Multicanal</option>
                <option value="gatilho">Gatilho Automático</option>
              </select>
            </div>
            {formError && (
              <div className="form-error" role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, marginBottom: 14 }}>{formError}</div>
            )}
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveCadence}>Criar Cadência</button>
            </div>
          </div>
        </div>
      )}

      {/* New Step Modal */}
      {showStepModal && (
        <div className="modal-overlay" onClick={() => setShowStepModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="step-modal-title" onClick={e => e.stopPropagation()}>
            <h2 id="step-modal-title">Adicionar Etapa na Sequência</h2>
            <div className="form-group">
              <label htmlFor="step-type">Tipo de Ação *</label>
              <select id="step-type" value={stepForm.type} onChange={e => setStepForm({...stepForm, type: e.target.value})}>
                <option value="ligacao">Ligação / Cold Call</option>
                <option value="whatsapp">Mensagem WhatsApp</option>
                <option value="email">E-mail Automático</option>
                <option value="espera">Intervalo de Espera</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="step-channel">Canal</label>
                <select id="step-channel" value={stepForm.channel} onChange={e => setStepForm({...stepForm, channel: e.target.value})}>
                  <option value="telefone">Telefone</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="email">E-mail</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="step-wait">Espera após passo anterior (horas)</label>
                <input id="step-wait" type="number" min={0} value={stepForm.wait_time} onChange={e => setStepForm({...stepForm, wait_time: Number(e.target.value)})} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowStepModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addStep}>Adicionar Etapa</button>
            </div>
          </div>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
