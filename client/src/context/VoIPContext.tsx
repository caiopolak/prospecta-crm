import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { phoneAudio } from '../utils/audioTones';
import { sipClient, SipStatus, SipConfig } from '../sip/sipClient';

export type CallStatus = 'idle' | 'dialing' | 'ringing' | 'connected' | 'on_hold' | 'disposition_needed' | 'ended';
export type CallingMode = 'pc_voip' | 'mobile_gsm';

export interface ActiveLead {
  id?: number;
  name: string;
  phone: string;
  company?: string;
  company_id?: number;
  role?: string;
  email?: string;
  segment?: string;
  observations?: string;
  tags?: string;
}

export interface NetworkInfo {
  localIp: string;
  port: number;
  fullUrl: string;
  isMobileConnected: boolean;
  pairedDeviceName: string;
  clientCount: number;
  lastSeen: string;
}

export interface VoIPContextType {
  callStatus: CallStatus;
  callingMode: CallingMode;
  setCallingMode: (mode: CallingMode) => void;
  activeLead: ActiveLead | null;
  callDuration: number;
  isMuted: boolean;
  isOnHold: boolean;
  isDialerOpen: boolean;
  micLevel: number;
  networkInfo: NetworkInfo | null;
  sipStatus: SipStatus;
  isRecording: boolean;
  saveError: string | null;
  callQueue: ActiveLead[];
  queueIndex: number;
  dialNumber: (phone: string, lead?: ActiveLead) => void;
  hangupCall: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  openDialer: () => void;
  closeDialer: () => void;
  saveCallDisposition: (data: CallDispositionPayload) => Promise<boolean>;
  startPowerQueue: (leads: ActiveLead[]) => void;
  nextQueueLead: () => void;
  stopPowerQueue: () => void;
  resumeQueue: () => void;
  refreshNetworkInfo: () => void;
  toast: (msg: string, type?: 'success' | 'error') => void;
}

export interface CallDispositionPayload {
  disposition: string;
  notes: string;
  sentiment: string;
  create_followup: boolean;
  followup_date?: string;
  followup_title?: string;
  transcript?: string;
  ai_summary?: string;
  next_step?: string;
}

const VoIPContext = createContext<VoIPContextType | undefined>(undefined);

export const VoIPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callingMode, setCallingMode] = useState<CallingMode>('pc_voip');
  const [activeLead, setActiveLead] = useState<ActiveLead | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isOnHold, setIsOnHold] = useState<boolean>(false);
  const [isDialerOpen, setIsDialerOpen] = useState<boolean>(false);
  const [micLevel, setMicLevel] = useState<number>(0);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [sipStatus, setSipStatus] = useState<SipStatus>('off');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([]);

  // Power Queue
  const [callQueue, setCallQueue] = useState<ActiveLead[]>([]);
  const [queueIndex, setQueueIndex] = useState<number>(-1);

  const timerRef = useRef<any>(null);
  const connectTimeoutRef = useRef<any>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const simVuRef = useRef<any>(null);
  const callStatusRef = useRef<CallStatus>('idle');
  const queueIndexRef = useRef<number>(-1);
  const statsRef = useRef({ dialed: 0, connected: 0, meetings: 0 });
  const autoRecordRef = useRef<boolean>(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recUploadRef = useRef<string>('');

  useEffect(() => { callStatusRef.current = callStatus; }, [callStatus]);
  useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);

  // Persistência: fila e modo de discagem sobrevivem a reload
  // (a chamada ao vivo não pode continuar, mas a posição na fila é restaurada)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('prospecta_queue');
      if (raw) {
        const d = JSON.parse(raw);
        if (Array.isArray(d.queue) && d.queue.length > 0 && d.index >= 0 && d.index < d.queue.length) {
          setCallQueue(d.queue);
          setQueueIndex(d.index);
        }
      }
      const mode = localStorage.getItem('prospecta_mode');
      if (mode === 'pc_voip' || mode === 'mobile_gsm') setCallingMode(mode);
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (callQueue.length > 0 && queueIndex >= 0) {
      sessionStorage.setItem('prospecta_queue', JSON.stringify({ queue: callQueue, index: queueIndex }));
    } else {
      sessionStorage.removeItem('prospecta_queue');
    }
  }, [callQueue, queueIndex]);

  useEffect(() => {
    localStorage.setItem('prospecta_mode', callingMode);
  }, [callingMode]);

  const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500);
  };

  // Fetch Network / Gateway status
  const refreshNetworkInfo = () => {
    fetch('/api/network-info')
      .then(r => r.json())
      .then(data => setNetworkInfo(data))
      .catch(() => {});
  };

  useEffect(() => {
    refreshNetworkInfo();
    const interval = setInterval(refreshNetworkInfo, 8000);
    return () => clearInterval(interval);
  }, []);

  // SIP: carrega configuração e conecta quando for provedor real
  useEffect(() => {
    fetch('/api/sip-config')
      .then(r => r.json())
      .then(cfg => {
        autoRecordRef.current = !cfg || cfg.auto_record !== 0;
        // SIP credentials are intentionally not returned by the API; connect from the settings flow after the user enters them.
      })
      .catch(() => {});
    const unsub = sipClient.subscribe(setSipStatus);
    return () => unsub();
  }, []);

  // Real Microphone Capture & VU Meter when connected in PC mode
  useEffect(() => {
    if (callStatus === 'connected' && callingMode === 'pc_voip' && !isMuted) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(stream => {
            micStreamRef.current = stream;
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;

            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);

            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const updateVu = () => {
              analyser.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
              animFrameRef.current = requestAnimationFrame(updateVu);
            };
            updateVu();
          })
          .catch(err => {
            console.warn('Microfone não acessível ou sem permissão:', err);
            // Fallback simulated VU meter (limpo no cleanup do efeito)
            simVuRef.current = setInterval(() => {
              setMicLevel(Math.floor(Math.random() * 45 + 15));
            }, 200);
          });
      }
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (simVuRef.current) { clearInterval(simVuRef.current); simVuRef.current = null; }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
        micStreamRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setMicLevel(0);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (simVuRef.current) { clearInterval(simVuRef.current); simVuRef.current = null; }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [callStatus, callingMode, isMuted]);

  // Gravação real da chamada (MediaRecorder) — só PC VoIP, quando auto_record ativo
  const startRecording = async () => {
    if (recorderRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recStreamRef.current = stream;
      const mime = (window as any).MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        recStreamRef.current = null;
        if (chunks.length === 0) return;
        const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const b64 = String(reader.result).split(',')[1];
            const res = await fetch('/api/calls/recording', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: b64, mime: blob.type, phone: activeLead?.phone }),
            });
            if (res.ok) {
              const out = await res.json();
              recUploadRef.current = out.url || '';
              toast('Gravação da chamada salva no histórico.');
            }
          } catch (e) {
            console.warn('Falha ao enviar gravação:', e);
          }
        };
        reader.readAsDataURL(blob);
        setIsRecording(false);
      };
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
    } catch (e) {
      console.warn('Não foi possível gravar a chamada:', e);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch (e) {}
    }
    recorderRef.current = null;
    setIsRecording(false);
  };

  useEffect(() => {
    if (callStatus === 'connected' && callingMode === 'pc_voip' && autoRecordRef.current) {
      startRecording();
    }
    if (callStatus === 'disposition_needed' || callStatus === 'ended') {
      stopRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callStatus, callingMode]);

  // Timer loop when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else if (callStatus !== 'on_hold') {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  // Sincroniza mute/hold com a sessão SIP real
  useEffect(() => { sipClient.mute(isMuted); }, [isMuted]);
  useEffect(() => { sipClient.hold(isOnHold); }, [isOnHold]);

  const markConnected = () => {
    if (callStatusRef.current !== 'connected' && callStatusRef.current !== 'on_hold') {
      statsRef.current.connected += 1;
    }
    phoneAudio.playConnectedChime();
    setCallStatus('connected');
  };

  const dialNumber = (phone: string, lead?: ActiveLead) => {
    if (!phone) return;
    setIsDialerOpen(true);
    setCallDuration(0);
    setIsMuted(false);
    setIsOnHold(false);
    setSaveError(null);
    recUploadRef.current = '';
    statsRef.current.dialed += 1;

    const targetLead: ActiveLead = lead || {
      name: 'Chamada Direta',
      phone: phone,
      company: 'Prospecção Externa',
    };

    setActiveLead(targetLead);
    const lastDigit = (phone.replace(/\D/g, '').slice(-1)) || '1';

    if (callingMode === 'mobile_gsm') {
      // Send Dial Signal to Android Phone Gateway
      setCallStatus('dialing');
      phoneAudio.playDtmf(lastDigit);

      fetch('/api/gateway/dial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          leadId: targetLead.id,
          leadName: targetLead.name,
          company: targetLead.company,
          role: targetLead.role
        })
      })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Falha ao enviar comando ao celular. Verifique a conexão Wi-Fi.');
        if (data.sentToDevices === 0) {
          toast('Nenhum celular GSM conectado. Verifique o aplicativo no celular.', 'error');
          setCallStatus('idle');
          return;
        }
        // Simulate network response
        setTimeout(() => {
          setCallStatus('ringing');
          phoneAudio.startRingback();
          connectTimeoutRef.current = setTimeout(() => {
            markConnected();
          }, 4000);
        }, 1200);
      })
      .catch((err: any) => {
        toast(err?.message || 'Falha ao enviar comando ao celular. Verifique a conexão Wi-Fi.', 'error');
        setCallStatus('idle');
      });

    } else {
      // PC WebRTC / VoIP mode
      setCallStatus('dialing');
      phoneAudio.playDtmf(lastDigit);

      // Caminho real: provedor SIP registrado via JsSIP
      if (sipClient.isReady()) {
        const started = sipClient.call(phone, {
          onProgress: () => {
            setCallStatus('ringing');
            phoneAudio.startRingback();
          },
          onAccepted: () => markConnected(),
          onFailed: (reason) => {
            if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
            phoneAudio.playHangupTone();
            setCallStatus('idle');
            toast(`Chamada SIP falhou: ${reason}`, 'error');
          },
          onEnded: () => {
            if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
            if (callStatusRef.current === 'connected' || callStatusRef.current === 'on_hold') {
              phoneAudio.playHangupTone();
              setCallStatus('disposition_needed');
            }
          },
        });
        if (started) return;
      }

      // Simulador Web Audio (sem provedor configurado)
      setTimeout(() => {
        setCallStatus('ringing');
        phoneAudio.startRingback();

        connectTimeoutRef.current = setTimeout(() => {
          markConnected();
        }, 3600);
      }, 1000);
    }
  };

  const hangupCall = () => {
    if (connectTimeoutRef.current) {
      clearTimeout(connectTimeoutRef.current);
      connectTimeoutRef.current = null;
    }
    phoneAudio.playHangupTone();
    if (sipClient.hasActiveSession()) sipClient.hangup();
    setCallStatus('disposition_needed');

    if (callingMode === 'mobile_gsm') {
      fetch('/api/gateway/call-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended', durationSeconds: callDuration })
      }).catch(() => {});
    }
  };

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

  const toggleHold = () => {
    setIsOnHold(prev => {
      const next = !prev;
      if (next) {
        setCallStatus('on_hold');
      } else {
        setCallStatus('connected');
      }
      return next;
    });
  };

  const openDialer = () => setIsDialerOpen(true);

  const closeDialer = () => {
    // Fecha em idle, após salvar (ended) e também no desfecho (com confirmação no modal)
    if (callStatus === 'idle' || callStatus === 'ended' || callStatus === 'disposition_needed') {
      if (callStatus === 'disposition_needed') {
        stopRecording();
        setCallStatus('idle');
        setCallDuration(0);
        setActiveLead(null);
      }
      setIsDialerOpen(false);
    }
  };

  const saveCallDisposition = async (data: CallDispositionPayload): Promise<boolean> => {
    if (!activeLead) return false;
    setSaveError(null);

    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: activeLead.company_id,
          contact_id: activeLead.id,
          phone_number: activeLead.phone,
          call_type: 'outbound',
          status: 'completed',
          disposition: data.disposition,
          duration_seconds: callDuration,
          notes: data.notes,
          sentiment: data.sentiment,
          transcript: data.transcript || '',
          ai_summary: data.ai_summary,
          next_step: data.next_step,
          recording_url: recUploadRef.current || '',
          create_followup: data.create_followup,
          followup_date: data.followup_date,
          followup_title: data.followup_title,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      if (data.disposition === 'reuniao_agendada') statsRef.current.meetings += 1;

      setCallStatus('ended');
      setTimeout(() => {
        setCallStatus('idle');
        setCallDuration(0);

        if (queueIndexRef.current >= 0 && queueIndexRef.current < callQueue.length - 1) {
          nextQueueLead();
        } else if (queueIndexRef.current >= 0) {
          const s = statsRef.current;
          stopPowerQueue();
          toast(`Sessão concluída: ${s.dialed} discados · ${s.connected} conexões · ${s.meetings} reuniões`);
        } else {
          setActiveLead(null);
        }
      }, 800);
      return true;
    } catch (err) {
      console.error('Erro ao salvar chamada:', err);
      setSaveError('Não foi possível salvar o registro. Suas notas foram mantidas — tente novamente.');
      return false;
    }
  };

  const startPowerQueue = (leads: ActiveLead[]) => {
    if (leads.length === 0) return;
    statsRef.current = { dialed: 0, connected: 0, meetings: 0 };
    setCallQueue(leads);
    setQueueIndex(0);
    dialNumber(leads[0].phone, leads[0]);
  };

  const nextQueueLead = () => {
    const nextIdx = queueIndexRef.current + 1;
    if (nextIdx < callQueue.length) {
      setQueueIndex(nextIdx);
      const nextLead = callQueue[nextIdx];
      dialNumber(nextLead.phone, nextLead);
    } else {
      const s = statsRef.current;
      stopPowerQueue();
      toast(`Sessão concluída: ${s.dialed} discados · ${s.connected} conexões · ${s.meetings} reuniões`);
    }
  };

  const stopPowerQueue = () => {
    setCallQueue([]);
    setQueueIndex(-1);
    setCallStatus('idle');
    setActiveLead(null);
    setCallDuration(0);
  };

  const resumeQueue = () => {
    const idx = queueIndexRef.current;
    if (idx >= 0 && callQueue[idx]) {
      dialNumber(callQueue[idx].phone, callQueue[idx]);
    }
  };

  return (
    <VoIPContext.Provider
      value={{
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
        openDialer,
        closeDialer,
        saveCallDisposition,
        startPowerQueue,
        nextQueueLead,
        stopPowerQueue,
        resumeQueue,
        refreshNetworkInfo,
        toast,
      }}
    >
      {children}

      {/* Toast global (feedback de sucesso/erro) */}
      <div
        aria-live="polite"
        style={{
          position: 'fixed', right: 20, bottom: 20, zIndex: 4000,
          display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none'
        }}
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              maxWidth: 340,
              color: t.type === 'error' ? '#FCA5A5' : '#6EE7B7',
              background: t.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              border: `1px solid ${t.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`,
              backdropFilter: 'blur(8px)',
              boxShadow: '0 10px 30px -10px rgba(0,0,0,0.6)'
            }}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </VoIPContext.Provider>
  );
};

export const useVoIP = () => {
  const context = useContext(VoIPContext);
  if (!context) throw new Error('useVoIP must be used within a VoIPProvider');
  return context;
};
