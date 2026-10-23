import * as JsSIP from 'jssip';

export type SipStatus = 'off' | 'connecting' | 'registered' | 'failed';

export interface SipConfig {
  is_simulator: number;
  ws_server?: string;
  sip_domain?: string;
  username?: string;
  password?: string;
  caller_id?: string;
}

export interface SipCallHandlers {
  onProgress?: () => void;
  onAccepted?: () => void;
  onFailed?: (reason: string) => void;
  onEnded?: () => void;
}

export const SIP_LABEL: Record<SipStatus, string> = {
  off: 'SIP desligado',
  connecting: 'Conectando ao provedor…',
  registered: 'SIP registrado — chamadas reais ativas',
  failed: 'Falha na conexão SIP',
};

class SipClient {
  private ua: any = null;
  private session: any = null;
  private remoteAudio: HTMLAudioElement | null = null;
  private status: SipStatus = 'off';
  private listeners = new Set<(s: SipStatus) => void>();
  private config: SipConfig | null = null;
  public lastError: string | null = null;

  subscribe(cb: (s: SipStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.status);
    return () => this.listeners.delete(cb);
  }

  private setStatus(s: SipStatus) {
    this.status = s;
    this.listeners.forEach(cb => cb(s));
  }

  getStatus(): SipStatus {
    return this.status;
  }

  getConfig(): SipConfig | null {
    return this.config;
  }

  isRealConfigured(cfg: SipConfig | null): boolean {
    return !!cfg && cfg.is_simulator === 0 && !!cfg.ws_server && !!cfg.sip_domain && !!cfg.username;
  }

  isReady(): boolean {
    return this.status === 'registered';
  }

  private ensureRemoteAudio(): HTMLAudioElement {
    if (!this.remoteAudio) {
      this.remoteAudio = document.createElement('audio');
      this.remoteAudio.autoplay = true;
      (this.remoteAudio as any).setAttribute('playsinline', 'true');
      document.body.appendChild(this.remoteAudio);
    }
    return this.remoteAudio;
  }

  connect(cfg: SipConfig) {
    this.disconnect();
    this.lastError = null;
    if (!this.isRealConfigured(cfg)) {
      this.setStatus('off');
      return;
    }
    this.config = cfg;
    try {
      const socket = new (JsSIP as any).WebSocketInterface(cfg.ws_server);
      const ua = new (JsSIP as any).UA({
        sockets: [socket],
        uri: `sip:${cfg.username}@${cfg.sip_domain}`,
        password: cfg.password || '',
        display_name: cfg.caller_id || cfg.username,
        register: true,
        session_timers: false,
      });

      this.setStatus('connecting');

      ua.on('connected', () => this.setStatus('connecting'));
      ua.on('registered', () => this.setStatus('registered'));
      ua.on('unregistered', () => this.setStatus('off'));
      ua.on('registrationFailed', (e: any) => {
        this.lastError = (e && (e.cause || e.message)) || 'Falha no registro SIP';
        this.setStatus('failed');
      });
      ua.on('disconnected', () => this.setStatus('off'));

      ua.on('newRTCSession', (data: any) => {
        const sess = data.session;
        if (data.originator === 'remote') {
          // Softphone: atende chamada recebida; se já houver uma ativa, ocupa
          if (this.session && this.session !== sess) {
            try { sess.terminate({ status_code: 486 }); } catch (e) {}
            return;
          }
          this.attachSession(sess, {});
          try { sess.answer(); } catch (e) {}
        }
      });

      ua.start();
      this.ua = ua;
      } catch (e: any) {
      this.lastError = e?.message || 'Falha ao iniciar SIP';
      console.warn('Falha ao iniciar SIP:', e);
      this.setStatus('failed');
    }
  }

  disconnect() {
    try {
      if (this.session) { try { this.session.terminate(); } catch (e) {} this.session = null; }
      if (this.ua) { this.ua.stop(); this.ua = null; }
    } catch (e) {}
    this.setStatus('off');
  }

  private attachSession(sess: any, handlers: SipCallHandlers) {
    this.session = sess;
    const audio = this.ensureRemoteAudio();

    sess.on('progress', () => handlers.onProgress && handlers.onProgress());
    sess.on('accepted', () => handlers.onAccepted && handlers.onAccepted());
    sess.on('confirmed', () => handlers.onAccepted && handlers.onAccepted());

    sess.on('failed', (e: any) => {
      if (this.session === sess) this.session = null;
      handlers.onFailed && handlers.onFailed((e && e.cause) || 'Falha na chamada');
    });
    sess.on('ended', () => {
      if (this.session === sess) this.session = null;
      audio.srcObject = null;
      handlers.onEnded && handlers.onEnded();
    });

    // Áudio remoto: cobre ontrack (unified-plan) e addstream (legado)
    sess.on('peerconnection', (e: any) => {
      const pc = e.peerconnection;
      if (!pc) return;
      pc.ontrack = (ev: any) => {
        const stream = ev.streams && ev.streams[0];
        if (stream) {
          audio.srcObject = stream;
          audio.play().catch(() => {});
        }
      };
    });
    sess.on('addstream', (e: any) => {
      if (e && e.stream) {
        audio.srcObject = e.stream;
        audio.play().catch(() => {});
      }
    });
  }

  call(phone: string, handlers: SipCallHandlers): boolean {
    if (!this.ua || this.status !== 'registered') return false;
    try {
      const target = phone.startsWith('sip:') ? phone : `sip:${phone.replace(/[^\d+*#]/g, '')}@${this.config?.sip_domain}`;
      const session = (this.ua as any).call(target, {
        mediaConstraints: { audio: true },
        rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
      });
      this.attachSession(session, handlers);
      return true;
    } catch (e) {
      console.warn('Erro ao discar via SIP:', e);
      handlers.onFailed && handlers.onFailed('Erro ao iniciar chamada SIP');
      return false;
    }
  }

  hangup() {
    if (this.session) {
      try { this.session.terminate(); } catch (e) {}
      this.session = null;
    }
  }

  mute(muted: boolean) {
    if (!this.session) return;
    try {
      if (muted) this.session.mute({ audio: true });
      else this.session.unmute({ audio: true });
    } catch (e) {}
  }

  hold(on: boolean) {
    if (!this.session) return;
    try {
      if (on) this.session.hold();
      else this.session.unhold();
    } catch (e) {}
  }

  hasActiveSession(): boolean {
    return !!this.session;
  }
}

export const sipClient = new SipClient();
