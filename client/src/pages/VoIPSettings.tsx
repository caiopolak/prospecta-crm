import React, { useEffect, useState } from 'react';
import { PageTransition } from '../components/PageTransition';
import { Save, Plug, Unplug, Smartphone } from 'lucide-react';
import { sipClient, SIP_LABEL, SipConfig } from '../sip/sipClient';
import { useVoIP } from '../context/VoIPContext';

export default function VoIPSettings() {
  const { sipStatus, toast, callingMode, setCallingMode, networkInfo } = useVoIP();
  const [config, setConfig] = useState<SipConfig & { provider_name: string; dtmf_volume: number; auto_record: number }>({
    provider_name: '',
    is_simulator: 1,
    ws_server: '',
    sip_domain: '',
    username: '',
    password: '',
    caller_id: '',
    dtmf_volume: 0.5,
    auto_record: 1
  });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    fetch('/api/sip-config')
      .then(r => r.json())
      .then(data => {
        if (data) {
          const savedConfig = sipClient.getConfig();
          setConfig({ ...data, password: savedConfig?.password || '' });
        }
      })
      .catch(() => {});
  }, []);

  const validate = (): string => {
    if (Number(config.is_simulator) !== 0) return '';
    const ws = (config.ws_server || '').trim();
    if (!ws.startsWith('ws://') && !ws.startsWith('wss://')) {
      return 'O servidor WebSocket precisa começar com ws:// ou wss:// (ex: wss://sip.provedor.com.br:8089/ws).';
    }
    if (!(config.username || '').trim() || !(config.sip_domain || '').trim()) {
      return 'Informe o usuário/ramal SIP e o domínio SIP para usar conexão real.';
    }
    return '';
  };

  const saveConfig = async () => {
    const invalid = validate();
    if (invalid) {
      setSaveError(invalid);
      setSaved(false);
      return;
    }
    try {
      const res = await fetch('/api/sip-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!res.ok) throw new Error('Falha na requisição');
      if (Number(config.is_simulator) === 0 && config.password) sipClient.connect(config);
      setSaveError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setSaved(false);
      setSaveError('Não foi possível salvar as configurações. Verifique a conexão e tente novamente.');
    }
  };

  return (
    <PageTransition>
    <div>
      <div className="page-header">
        <div className="page-header-info">
          <h1>Configurações de Telefonia</h1>
          <p>Gerencie seu provedor VoIP e a conexão do seu aparelho celular</p>
        </div>
      </div>

      <div style={{ maxWidth: '700px' }}>
        
        {/* Celular GSM Gateway */}
        <div className="table-container" style={{ padding: '28px', marginBottom: 24 }}>
          <h2 style={{ fontSize: '15px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Smartphone size={18} /> Celular GSM (Gateway)
          </h2>
          
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div className={`status-dot ${networkInfo?.isMobileConnected ? 'on' : ''}`} style={{ width: 10, height: 10, borderRadius: '50%', background: networkInfo?.isMobileConnected ? '#10B981' : '#EF4444' }}></div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{networkInfo?.isMobileConnected ? `Conectado: ${networkInfo.pairedDeviceName}` : 'Celular desconectado'}</span>
            </div>
            {networkInfo?.isMobileConnected && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Último pulso: {new Date(networkInfo.lastSeen).toLocaleTimeString()}</div>
            )}
            
            <div style={{ fontSize: 13, marginBottom: 12 }}>
              Para conectar, abra o app <b>Prospecta GSM</b> no celular e configure o servidor:
              <code style={{ display: 'block', background: '#000', padding: '8px', borderRadius: 6, marginTop: 6, fontFamily: 'monospace' }}>
                {window.location.origin.replace(/^http/, 'http')}
              </code>
            </div>

            <div className="form-group">
              <label htmlFor="select-mode">Modo de Discagem Padrão</label>
              <select id="select-mode" value={callingMode} onChange={(e) => setCallingMode(e.target.value as any)}>
                <option value="pc_voip">PC WebRTC (VoIP SIP)</option>
                <option value="mobile_gsm">Celular GSM (Gateway)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-container" style={{ padding: '28px' }}>
          <h2 style={{ fontSize: '15px', marginBottom: 16 }}>Configurações VoIP SIP</h2>

          {/* Status ao vivo da sessão SIP */}
          <div
            aria-live="polite"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              flexWrap: 'wrap', padding: '14px 16px', borderRadius: 10, marginBottom: 24,
              border: `1px solid ${sipStatus === 'registered' ? 'rgba(16,185,129,0.45)' : sipStatus === 'failed' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.12)'}`,
              background: sipStatus === 'registered' ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 600 }}>
              <Plug size={16} style={{ color: sipStatus === 'registered' ? '#34D399' : 'var(--text-muted)' }} />
                <span style={{ color: sipStatus === 'registered' ? '#6EE7B7' : sipStatus === 'failed' ? '#FCA5A5' : 'var(--text)' }}>
                  {SIP_LABEL[sipStatus]}
                </span>
                {sipStatus === 'failed' && sipClient.lastError && (
                  <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>
                    {sipClient.lastError}
                  </div>
                )}
              </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {sipStatus === 'off' || sipStatus === 'failed' ? (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => {
                    const invalid = validate();
                    if (invalid) { setSaveError(invalid); return; }
                    sipClient.connect(config);
                    toast('Conectando ao provedor SIP…');
                  }}
                >
                  Conectar
                </button>
              ) : (
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => { sipClient.disconnect(); toast('Sessão SIP encerrada.'); }}
                >
                  <Unplug size={14} /> Desconectar
                </button>
              )}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="sip-provider">Provedor de Telefonia</label>
            <input 
              id="sip-provider"
              value={config.provider_name} 
              onChange={e => setConfig({...config, provider_name: e.target.value})} 
              placeholder="Ex: Simulador Web Audio ou Provedor SIP Customizado"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sip-mode">Modo de Operação</label>
            <select 
              id="sip-mode"
              value={config.is_simulator} 
              onChange={e => setConfig({...config, is_simulator: Number(e.target.value)})}
            >
              <option value={1}>Simulador Web Audio (Recomendado para Testes &amp; Sem Custo)</option>
              <option value={0}>Conexão SIP / WebRTC Real (Provedor Externo)</option>
            </select>
          </div>

          {config.is_simulator === 0 && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sip-ws">Servidor WebSocket SIP (WSS)</label>
                  <input 
                    id="sip-ws"
                    value={config.ws_server || ''} 
                    onChange={e => setConfig({...config, ws_server: e.target.value})} 
                    placeholder="wss://sip.provedor.com.br:8089/ws"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sip-domain">Domínio SIP</label>
                  <input 
                    id="sip-domain"
                    value={config.sip_domain || ''} 
                    onChange={e => setConfig({...config, sip_domain: e.target.value})} 
                    placeholder="sip.provedor.com.br"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sip-username">Usuário / Ramal SIP</label>
                  <input 
                    id="sip-username"
                    value={config.username || ''} 
                    onChange={e => setConfig({...config, username: e.target.value})} 
                    placeholder="1001"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sip-password">Senha SIP</label>
                  <input 
                    id="sip-password"
                    type="password"
                    value={config.password || ''} 
                    onChange={e => setConfig({...config, password: e.target.value})} 
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="sip-caller-id">ID de Chamada (Caller ID Exibido)</label>
              <input 
                id="sip-caller-id"
                value={config.caller_id || ''} 
                onChange={e => setConfig({...config, caller_id: e.target.value})} 
                placeholder="+1 555 010 0000"
              />
            </div>
            <div className="form-group">
              <label htmlFor="sip-dtmf">Volume dos Tons DTMF</label>
              <input 
                id="sip-dtmf"
                type="number" 
                step="0.1" 
                min="0.1" 
                max="1.0"
                value={config.dtmf_volume} 
                onChange={e => setConfig({...config, dtmf_volume: Number(e.target.value)})} 
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: 10 }}>
            <label className="checkbox-label" htmlFor="sip-autorecord">
              <input 
                id="sip-autorecord"
                type="checkbox" 
                checked={config.auto_record === 1} 
                onChange={e => setConfig({...config, auto_record: e.target.checked ? 1 : 0})} 
              />
              <span>Gravar chamadas automaticamente com consentimento</span>
            </label>
          </div>

          {saved && (
            <div style={{ padding: '10px 14px', background: 'rgba(16,185,129,0.15)', color: '#34D399', borderRadius: 6, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
              Configurações salvas com sucesso!
            </div>
          )}

          {saveError && (
            <div className="form-error" role="alert" style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.12)', color: 'var(--color-danger)', borderRadius: 6, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button className="btn btn-primary" onClick={saveConfig}>
              <Save size={16} /> Salvar Configurações VoIP
            </button>
          </div>

        </div>
      </div>
    </div>
    </PageTransition>
  );
}
