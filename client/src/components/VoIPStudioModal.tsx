import React, { useState, useEffect } from 'react';
import { useVoIP } from '../context/VoIPContext';
import { phoneAudio } from '../utils/audioTones';
import confetti from 'canvas-confetti';
import { 
  Phone, PhoneOff, Mic, MicOff, Pause, Play, Sparkles, 
  FileText, ShieldAlert, ArrowRight, X, 
  User, Tag, CheckCircle2, Headphones, Smartphone, Wifi, WifiOff,
  CalendarCheck, PhoneCall, Handshake, Inbox, PhoneMissed, CircleX, Ban
} from 'lucide-react';

export const VoIPStudioModal: React.FC = () => {
  const {
    callStatus,
    callingMode,
    setCallingMode,
    activeLead,
    callDuration,
    isMuted,
    isOnHold,
    isDialerOpen,
    micLevel,
    networkInfo,
    sipStatus,
    isRecording,
    saveError,
    callQueue,
    queueIndex,
    dialNumber,
    hangupCall,
    toggleMute,
    toggleHold,
    closeDialer,
    saveCallDisposition,
    stopPowerQueue,
    nextQueueLead,
    resumeQueue,
  } = useVoIP();

  const [manualPhone, setManualPhone] = useState('');
  const [activeTab, setActiveTab] = useState<'script' | 'objecoes' | 'qualificacao'>('script');
  const [scripts, setScripts] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [selectedDisposition, setSelectedDisposition] = useState<string>('conectado');
  const [notes, setNotes] = useState<string>('');
  const [sentiment, setSentiment] = useState<string>('neutro');
  const [createFollowup, setCreateFollowup] = useState<boolean>(true);
  const [followupDate, setFollowupDate] = useState<string>('');
  const [followupTitle, setFollowupTitle] = useState<string>('');
  
  const [aiSummary, setAiSummary] = useState<string>('');
  const [nextStep, setNextStep] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/scripts')
      .then(r => r.json())
      .then(data => setScripts(data))
      .catch(() => {});
  }, []);

  const clearForm = () => {
    setNotes('');
    setAiSummary('');
    setNextStep('');
    setFollowupDate('');
    setFollowupTitle('');
  };

  const confirmClose = () => {
    if (callStatus === 'disposition_needed') {
      const ok = window.confirm('Descartar o registro desta chamada? O histórico não será salvo.');
      if (!ok) return;
      closeDialer();
      clearForm();
    } else if (callStatus !== 'dialing' && callStatus !== 'ringing' && callStatus !== 'connected' && callStatus !== 'on_hold') {
      closeDialer();
    }
  };

  // Keyboard shortcuts during active call
  useEffect(() => {
    const DISPOSITION_KEYS = ['reuniao_agendada', 'pediu_retorno', 'conectado', 'gatekeeper', 'caixa_postal', 'ocupado', 'sem_interesse', 'numero_invalido'];
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDialerOpen) return;
      const el = e.target as HTMLElement | null;
      const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');

      if (callStatus === 'disposition_needed') {
        const idx = ['1', '2', '3', '4', '5', '6', '7', '8'].indexOf(e.key);
        if (idx >= 0 && !inField) {
          e.preventDefault();
          setSelectedDisposition(DISPOSITION_KEYS[idx]);
          return;
        }
        if (e.key === 'Escape' || (!inField && e.key.toLowerCase() === 'x')) {
          e.preventDefault();
          confirmClose();
          return;
        }
        return;
      }

      if (['0','1','2','3','4','5','6','7','8','9','*','#'].includes(e.key) && callStatus === 'idle' && !inField) {
        handleDialpadPress(e.key);
      } else if (e.key.toLowerCase() === 'm' && (callStatus === 'connected' || callStatus === 'on_hold')) {
        toggleMute();
      } else if (e.key === 'Escape' || (!inField && e.key.toLowerCase() === 'x')) {
        confirmClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDialerOpen, callStatus, isMuted]);

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainder = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const handleDialpadPress = (key: string) => {
    phoneAudio.playDtmf(key);
    setManualPhone(prev => prev + key);
  };

  const handleCallManual = () => {
    if (manualPhone.trim().length >= 8) {
      dialNumber(manualPhone.trim(), {
        name: 'Número Manual',
        phone: manualPhone.trim(),
        company: 'Prospecção Externa',
      });
    }
  };

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true);
    try {
      const res = await fetch('/api/calls/ai-summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          disposition: selectedDisposition,
          transcript: `SDR realizou ligação para ${activeLead?.name} da empresa ${activeLead?.company}. Notas: ${notes}`,
        }),
      });
      const data = await res.json();
      setAiSummary(data.ai_summary);
      setNextStep(data.next_step);
      setSentiment(data.sentiment);

      if (selectedDisposition === 'reuniao_agendada' || data.sentiment === 'positivo') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSaveDisposition = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const ok = await saveCallDisposition({
      disposition: selectedDisposition,
      notes,
      sentiment,
      create_followup: createFollowup,
      followup_date: followupDate || undefined,
      followup_title: followupTitle || undefined,
      ai_summary: aiSummary,
      next_step: nextStep,
    });
    setIsSaving(false);
    if (ok) {
      // Só comemora e limpa o formulário depois do registro persistir
      if (selectedDisposition === 'reuniao_agendada') {
        confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
      }
      clearForm();
    }
  };

  const handleSkipLead = () => {
    if (queueIndex >= 0 && queueIndex < callQueue.length - 1) {
      clearForm();
      nextQueueLead();
    }
  };

  if (!isDialerOpen) return null;

  const isCalling = callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'connected' || callStatus === 'on_hold';
  const isDisposition = callStatus === 'disposition_needed';

  const renderScriptText = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\[Nome do Contato\]/g, activeLead?.name || 'Tomador')
      .replace(/\[Nome\]/g, activeLead?.name?.split(' ')[0] || 'Tomador')
      .replace(/\[Nome da Empresa\]/g, activeLead?.company || 'sua empresa')
      .replace(/\[Segmento\]/g, activeLead?.segment || 'seu segmento')
      .replace(/\[Seu Nome\]/g, 'Especialista');
  };

  const openingScripts = scripts.filter(s => s.category === 'script_abertura');
  const objectionScripts = scripts.filter(s => s.category === 'objecao');
  const closingScripts = scripts.filter(s => s.category === 'pitch' || s.category === 'pergunta_qualificacao');

  return (
    <div className="voip-modal-overlay" role="dialog" aria-modal="true" aria-label="Estúdio de chamada Prospecta">
      <div className="voip-studio-container">
        {/* Studio Header */}
        <div className="voip-studio-header">
          <div className="studio-brand">
            <div className="telephony-indicator">
              <span className={`pulse-dot ${isCalling ? 'active' : ''}`}></span>
              <strong>Prospecta VoIP &amp; Cold Call HUD</strong>
            </div>

            {/* Mode Switcher Pill */}
            <div className="calling-mode-pill-box">
              <button
                type="button"
                className={`mode-pill ${callingMode === 'pc_voip' ? 'active' : ''}`}
                onClick={() => setCallingMode('pc_voip')}
                disabled={isCalling}
                title="Usar Headset / Microfone do Computador"
              >
                <Headphones size={13} />
                <span>PC Headset (VoIP)</span>
              </button>

              <button
                type="button"
                className={`mode-pill ${callingMode === 'mobile_gsm' ? 'active' : ''}`}
                onClick={() => setCallingMode('mobile_gsm')}
                disabled={isCalling}
                title="Disparar ligação através do Chip GSM do Celular Android"
              >
                <Smartphone size={13} />
                <span>Celular GSM (Chip)</span>
                {networkInfo?.isMobileConnected ? (
                  <span className="wifi-dot connected" title="Celular Conectado via Wi-Fi"></span>
                ) : (
                  <span className="wifi-dot disconnected" title="Celular não detectado na rede local"></span>
                )}
              </button>
            </div>

            {queueIndex >= 0 && (
              <span className="badge-queue">
                Fila: Lead {queueIndex + 1} de {callQueue.length}
              </span>
            )}
          </div>

          <div className="studio-header-actions">
            {queueIndex >= 0 && (
              <button className="btn btn-secondary btn-small" onClick={stopPowerQueue}>
                Encerrar Fila
              </button>
            )}
            <button
              className="btn-icon"
              onClick={confirmClose}
              aria-label="Fechar estúdio de chamada"
              disabled={callStatus === 'dialing' || callStatus === 'ringing' || callStatus === 'connected' || callStatus === 'on_hold'}
              style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Studio Body */}
        <div className="voip-studio-grid">
          {/* Left Panel */}
          <div className="voip-left-panel">
            {/* Mode Status Indicator Banner */}
            {callingMode === 'mobile_gsm' && (
              <div className="mobile-gateway-banner">
                <div className="banner-icon">
                  {networkInfo?.isMobileConnected ? <Wifi size={16} className="text-emerald" /> : <WifiOff size={16} className="text-warning" />}
                </div>
                <div className="banner-text">
                  <div className="banner-title">
                    {networkInfo?.isMobileConnected 
                      ? `Conectado: ${networkInfo.pairedDeviceName || 'Android GSM'}`
                      : 'Modo Gateway Celular (Chip GSM)'}
                  </div>
                  <div className="banner-sub">
                    {networkInfo?.isMobileConnected 
                      ? 'Ao clicar em discar, a chamada abrirá no chip do seu celular.' 
                      : `Conecte o APK do celular no Wi-Fi: ${networkInfo?.fullUrl || 'http://192.168.x.x:3002'}`}
                  </div>
                </div>
              </div>
            )}

            {callStatus === 'idle' && queueIndex >= 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={resumeQueue}
                style={{ width: '100%', marginBottom: 12 }}
              >
                <Play size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
                Retomar fila — Lead {queueIndex + 1} de {callQueue.length}
              </button>
            )}

            {callStatus === 'idle' && (
              <div className="dialpad-studio-box">
                <div className="dialpad-display">
                  <input
                    type="text"
                    placeholder="Digite o número (ex: 5550100101)"
                    value={manualPhone}
                    onChange={e => setManualPhone(e.target.value)}
                    className="dialpad-input"
                  />
                  {manualPhone && (
                    <button className="btn-clear" onClick={() => setManualPhone('')}>
                      &times;
                    </button>
                  )}
                </div>

                <div className="dialpad-grid">
                  {[
                    { k: '1', sub: '' },
                    { k: '2', sub: 'ABC' },
                    { k: '3', sub: 'DEF' },
                    { k: '4', sub: 'GHI' },
                    { k: '5', sub: 'JKL' },
                    { k: '6', sub: 'MNO' },
                    { k: '7', sub: 'PQRS' },
                    { k: '8', sub: 'TUV' },
                    { k: '9', sub: 'WXYZ' },
                    { k: '*', sub: '' },
                    { k: '0', sub: '+' },
                    { k: '#', sub: '' },
                  ].map(item => (
                    <button
                      key={item.k}
                      className="dialpad-btn"
                      onClick={() => handleDialpadPress(item.k)}
                    >
                      <span className="btn-number">{item.k}</span>
                      {item.sub && <span className="btn-sub">{item.sub}</span>}
                    </button>
                  ))}
                </div>

                <button
                  className="btn-call-action"
                  onClick={handleCallManual}
                  disabled={manualPhone.trim().length < 8}
                >
                  <Phone size={18} />
                  <span>
                    {callingMode === 'mobile_gsm' ? 'Discar pelo Chip do Celular' : 'Discar via Headset PC'}
                  </span>
                </button>
              </div>
            )}

            {isCalling && activeLead && (
              <div className="active-call-hud">
                <div className="lead-calling-card">
                  <div className="lead-avatar">
                    <User size={30} />
                  </div>
                  <h3 className="lead-name">{activeLead.name}</h3>
                  <div className="lead-role-comp">
                    {activeLead.role && <span>{activeLead.role} &bull; </span>}
                    <strong>{activeLead.company || 'Empresa'}</strong>
                  </div>
                  <div className="lead-phone-pill">{activeLead.phone}</div>

                  {activeLead.tags && (
                    <div className="lead-tags-container">
                      {activeLead.tags.split(',').map((t, idx) => (
                        <span key={idx} className="lead-tag-pill">
                          <Tag size={10} /> {t.trim()}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="call-live-status-card">
                  <div className="status-label">
                    {callStatus === 'dialing' && (
                      <span className="status-badge dialing">
                        {callingMode === 'mobile_gsm' ? 'Sinalizando Celular GSM...' : 'Discando via VoIP...'}
                      </span>
                    )}
                    {callStatus === 'ringing' && <span className="status-badge ringing">Chamando o Tomador...</span>}
                    {callStatus === 'connected' && (
                      <span className="status-badge connected">
                        {callingMode === 'mobile_gsm' ? 'Em Ligação (Chip Celular)' : 'Em Ligação (Headset PC)'}
                      </span>
                    )}
                    {callStatus === 'on_hold' && <span className="status-badge hold">Chamada em Espera</span>}
                  </div>

                  {/* Indicadores: gravação + status SIP */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, justifyContent: 'center' }}>
                    {isRecording && (
                      <span
                        aria-live="polite"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700,
                          color: '#FCA5A5', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.45)',
                          padding: '3px 8px', borderRadius: 999, fontFamily: 'JetBrains Mono'
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#EF4444', animation: 'pulse-dot 1.4s infinite' }} />
                        GRAVANDO
                      </span>
                    )}
                    {callingMode === 'pc_voip' && (
                      <span
                        style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                          fontFamily: 'JetBrains Mono',
                          color: sipStatus === 'registered' ? '#6EE7B7' : sipStatus === 'failed' ? '#FCA5A5' : 'var(--text-muted)',
                          border: `1px solid ${sipStatus === 'registered' ? 'rgba(16,185,129,0.45)' : sipStatus === 'failed' ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.15)'}`,
                          background: 'rgba(255,255,255,0.04)'
                        }}
                        title={sipStatus === 'registered' ? 'Provedor SIP conectado — chamada pela rede' : 'Sem provedor: simulador de áudio local'}
                      >
                        {sipStatus === 'registered' ? 'SIP conectado' : sipStatus === 'connecting' ? 'SIP conectando…' : sipStatus === 'failed' ? 'SIP falhou' : 'Simulador (sem SIP)'}
                      </span>
                    )}
                  </div>

                  <div className="call-timer">{formatTime(callDuration)}</div>

                  {/* Audio Waveform & Real VU Meter */}
                  {callStatus === 'connected' && (
                    <div>
                      <div className="audio-wave">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                          <div key={i} className={`wave-bar wave-bar-${i}`}></div>
                        ))}
                      </div>

                      {callingMode === 'pc_voip' && (
                        <div className="vu-meter-box">
                          <Mic size={12} className={micLevel > 15 ? 'text-emerald' : 'text-muted'} />
                          <div className="vu-meter-track">
                            <div className="vu-meter-bar" style={{ width: `${micLevel}%` }}></div>
                          </div>
                          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono', color: 'var(--text-muted)' }}>
                            {micLevel}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="in-call-controls">
                  <button
                    className={`btn-control ${isMuted ? 'active-mute' : ''}`}
                    onClick={toggleMute}
                    title="Atalho: M"
                  >
                    {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                    <span>{isMuted ? 'Mutado' : 'Mutar (M)'}</span>
                  </button>

                  <button
                    className={`btn-control ${isOnHold ? 'active-hold' : ''}`}
                    onClick={toggleHold}
                  >
                    {isOnHold ? <Play size={18} /> : <Pause size={18} />}
                    <span>{isOnHold ? 'Retomar' : 'Espera'}</span>
                  </button>

                  <button
                    className="btn-control btn-hangup"
                    onClick={hangupCall}
                  >
                    <PhoneOff size={22} />
                    <span>Desligar</span>
                  </button>
                </div>
              </div>
            )}

            {isDisposition && activeLead && (
              <div className="disposition-panel">
                <div className="disposition-header">
                  <CheckCircle2 className="text-emerald" size={24} />
                  <div>
                    <h4>Desfecho da Chamada</h4>
                    <p>Duração: {formatTime(callDuration)} &bull; {activeLead.name}</p>
                  </div>
                </div>

                <div className="disposition-options">
                  <label className="disposition-section-label" id="disposition-label">Qual foi o resultado? <span style={{ opacity: 0.6 }}>(teclas 1–8)</span></label>
                  <div className="disposition-grid" role="radiogroup" aria-labelledby="disposition-label">
                    {[
                      { id: 'reuniao_agendada', label: 'Reunião Agendada', color: 'success', Icon: CalendarCheck },
                      { id: 'pediu_retorno', label: 'Pediu Retorno', color: 'warning', Icon: PhoneCall },
                      { id: 'conectado', label: 'Conectado / Conversou', color: 'info', Icon: Handshake },
                      { id: 'gatekeeper', label: 'Gatekeeper / Secretária', color: 'neutral', Icon: ShieldAlert },
                      { id: 'caixa_postal', label: 'Caixa Postal', color: 'neutral', Icon: Inbox },
                      { id: 'ocupado', label: 'Linha Ocupada', color: 'neutral', Icon: PhoneMissed },
                      { id: 'sem_interesse', label: 'Sem Interesse', color: 'danger', Icon: CircleX },
                      { id: 'numero_invalido', label: 'Número Inválido', color: 'danger', Icon: Ban },
                    ].map(disp => (
                      <button
                        key={disp.id}
                        type="button"
                        role="radio"
                        aria-checked={selectedDisposition === disp.id}
                        className={`disposition-btn ${selectedDisposition === disp.id ? 'active ' + disp.color : ''}`}
                        onClick={() => setSelectedDisposition(disp.id)}
                      >
                        <disp.Icon size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
                        {disp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="form-group mt-2">
                  <label>Notas da Conversa / Principais Dores:</label>
                  <textarea
                    className="notes-textarea"
                    placeholder="Resumo dos pontos discutidos..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>

                <div className="ai-assist-box">
                  <button
                    type="button"
                    className="btn-ai-sparkle"
                    onClick={handleGenerateAI}
                    disabled={isGeneratingAI}
                  >
                    <Sparkles size={16} />
                    {isGeneratingAI ? 'Analisando...' : 'Resumir com IA & Sentimento'}
                  </button>

                  {aiSummary && (
                    <div className="ai-result-card">
                      <div className="ai-pill" style={{ marginBottom: 4 }}>
                        Sentimento: <strong className={`sentiment-${sentiment}`}>{sentiment.toUpperCase()}</strong>
                      </div>
                      <p style={{ marginBottom: 4 }}><strong>Resumo:</strong> {aiSummary}</p>
                      {nextStep && <p><strong>Próxima Ação:</strong> {nextStep}</p>}
                    </div>
                  )}
                </div>

                <div className="followup-scheduler-box">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={createFollowup}
                      onChange={e => setCreateFollowup(e.target.checked)}
                    />
                    <span>Agendar Tarefa de Retorno Automática</span>
                  </label>

                  {createFollowup && (
                    <div className="followup-inputs">
                      <input
                        type="text"
                        placeholder="Título da tarefa de retorno"
                        value={followupTitle}
                        onChange={e => setFollowupTitle(e.target.value)}
                        className="mb-1"
                      />
                      <input
                        type="datetime-local"
                        value={followupDate}
                        onChange={e => setFollowupDate(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {saveError && (
                  <div role="alert" style={{
                    marginTop: 12, padding: '10px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    color: '#FCA5A5', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.4)'
                  }}>
                    {saveError}
                  </div>
                )}

                <button
                  type="button"
                  className="btn-save-disposition"
                  onClick={handleSaveDisposition}
                  disabled={isSaving}
                  style={isSaving ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                >
                  <span>{isSaving ? 'Salvando…' : 'Salvar Registro & Concluir'}</span>
                  <ArrowRight size={18} />
                </button>

                {queueIndex >= 0 && queueIndex < callQueue.length - 1 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-wrap"
                    onClick={handleSkipLead}
                    style={{ marginTop: 8, width: '100%' }}
                    title="Descartar este lead e ir para o próximo da fila"
                  >
                    Pular lead &amp; próximo (sem salvar) — tecla X fecha a ficha
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Panel: Battlecards HUD */}
          <div className="voip-right-panel">
            <div className="battlecard-tabs">
              <button
                className={`tab-btn ${activeTab === 'script' ? 'active' : ''}`}
                onClick={() => setActiveTab('script')}
              >
                <FileText size={15} />
                <span>Script de Cold Call</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'objecoes' ? 'active' : ''}`}
                onClick={() => setActiveTab('objecoes')}
              >
                <ShieldAlert size={15} />
                <span>Matriz de Objeções</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'qualificacao' ? 'active' : ''}`}
                onClick={() => setActiveTab('qualificacao')}
              >
                <CheckCircle2 size={15} />
                <span>Qualificação BANT</span>
              </button>
            </div>

            <div className="battlecard-content-area">
              {activeTab === 'script' && (
                <div className="script-cards-flow">
                  <div className="hud-section-header">
                    <h4>Roteiro Dinâmico de Abordagem B2B</h4>
                    <span className="hud-badge">Personalizado</span>
                  </div>

                  {openingScripts.map((s, idx) => (
                    <div key={s.id || idx} className="script-card">
                      <div className="script-card-header">
                        <span className="step-tag">Etapa {idx + 1}: Abertura</span>
                        <h5>{s.title}</h5>
                      </div>
                      <p className="script-body">{renderScriptText(s.content)}</p>
                      {s.tips && (
                        <div className="script-tip">
                          <strong>Dica:</strong> {s.tips}
                        </div>
                      )}
                    </div>
                  ))}

                  {closingScripts.map((s, idx) => (
                    <div key={s.id || idx} className="script-card border-accent">
                      <div className="script-card-header">
                        <span className="step-tag accent">Fechamento &amp; Reunião</span>
                        <h5>{s.title}</h5>
                      </div>
                      <p className="script-body">{renderScriptText(s.content)}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'objecoes' && (
                <div className="objections-matrix-flow">
                  <div className="hud-section-header">
                    <h4>Quebra Rápida de Objeções (Battlecards)</h4>
                    <span className="hud-badge warning">Instantâneo</span>
                  </div>

                  {objectionScripts.map((s, idx) => (
                    <div key={s.id || idx} className="objection-card">
                      <div className="objection-title">
                        <ShieldAlert size={16} className="text-warning" />
                        <strong>{s.title}</strong>
                      </div>
                      <div className="objection-response">
                        {renderScriptText(s.content)}
                      </div>
                      {s.tips && (
                        <div className="script-tip">
                          <strong>Tática:</strong> {s.tips}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'qualificacao' && (
                <div className="qualification-flow">
                  <div className="hud-section-header">
                    <h4>Perguntas de Diagnóstico / BANT</h4>
                  </div>

                  <div className="qual-card">
                    <h5>1. Dor &amp; Gargalo Principal</h5>
                    <p>"Como vocês fazem hoje para gerar reuniões qualificadas com tomadores de decisão em escala?"</p>
                  </div>

                  <div className="qual-card">
                    <h5>2. Autoridade &amp; Decisão</h5>
                    <p>"Além de você, quem mais participa da avaliação de melhorias no processo comercial?"</p>
                  </div>

                  <div className="qual-card">
                    <h5>3. Necessidade &amp; Impacto</h5>
                    <p>"Se conseguirmos dobrar o volume de reuniões agendadas no próximo trimestre, qual seria o impacto no faturamento?"</p>
                  </div>

                  <div className="qual-card">
                    <h5>4. Timing &amp; Urgência</h5>
                    <p>"Existe algum projeto ou meta para otimizar a prospecção ativa agora em 2026?"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
