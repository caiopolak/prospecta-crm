// src/ai/index.ts
// Funções puras de IA para o CRM. Hoje usam lógica mock determinística;
// depois serão plugadas à API Gemini sem mudar a interface pública.

export function summarizeCall(transcript: string, disposition: string): string {
  const words = transcript.split(/\s+/).filter(Boolean).length;
  return `[Mock] Resumo da chamada: ${disposition}. Transcrição com ${words} palavras.`;
}

export function suggestNextStep(disposition: string): string {
  switch (disposition) {
    case 'reuniao_agendada':
      return 'Confirmar reunião por e-mail e enviar lembrete 24h antes.';
    case 'pediu_retorno':
      return 'Retornar a ligação no horário combinado com o cliente.';
    case 'conectado':
      return 'Enviar proposta comercial com base nas necessidades discutidas.';
    case 'gatekeeper':
      return 'Identificar o decisor e agendar nova tentativa com ele.';
    case 'caixa_postal':
      return 'Enviar mensagem de voz ou e-mail solicitando retorno.';
    case 'ocupado':
      return 'Tentar novamente em outro horário ou enviar e-mail.';
    case 'sem_interesse':
      return 'Mover o lead para "Perdido" e registrar o motivo.';
    case 'numero_invalido':
      return 'Corrigir o número no cadastro do contato.';
    default:
      return 'Avaliar a conversa e definir próxima ação.';
  }
}

export function detectObjections(transcript: string): string[] {
  const lower = transcript.toLowerCase();
  const objections: string[] = [];
  if (lower.includes('caro') || lower.includes('preço') || lower.includes('valor')) {
    objections.push('preço');
  }
  if (lower.includes('não tenho tempo') || lower.includes('ocupado demais')) {
    objections.push('tempo');
  }
  if (lower.includes('já tenho') || lower.includes('não preciso') || lower.includes('não faz sentido')) {
    objections.push('necessidade');
  }
  if (lower.includes('não decido') || lower.includes('preciso pensar') || lower.includes('falar com meu')) {
    objections.push('autoridade');
  }
  return objections;
}

export function scoreLead(leadData: {
  position?: string;
  segment?: string;
  notes?: string;
  phone?: string;
}): number {
  let score = 50;
  if (leadData.position && /diretor|gerente|ceo|proprietário|sócio|head/i.test(leadData.position)) score += 20;
  if (leadData.segment && /indústria|tecnologia|saúde|educação|financeiro/i.test(leadData.segment)) score += 10;
  if (leadData.notes && leadData.notes.length > 100) score += 10;
  if (leadData.phone && leadData.phone.replace(/\D/g, '').length >= 10) score += 10;
  return Math.min(100, score);
}

export function generateCoachTip(disposition: string, objections: string[]): string {
  if (objections.includes('preço')) {
    return 'Foque no valor e no ROI, não no preço. Use cases de sucesso de clientes parecidos.';
  }
  if (objections.includes('autoridade')) {
    return 'Tente agendar uma reunião com quem decide, ou ofereça enviar material para apresentação interna.';
  }
  if (objections.includes('necessidade')) {
    return 'Refazer o diagnóstico de dor antes de apresentar a solução. Use perguntas abertas.';
  }
  if (objections.includes('tempo')) {
    return 'Respeite o tempo: ofereça uma versão curta da proposta ou um follow-up de 15 minutos.';
  }
  switch (disposition) {
    case 'reuniao_agendada':
      return 'Excelente! Prepare uma apresentação personalizada para a reunião.';
    case 'sem_interesse':
      return 'Mantenha a porta aberta: "Sem problema, posso retornar em alguns meses?"';
    case 'ocupado':
      return 'Respeite o tempo do cliente e combine um melhor horário.';
    default:
      return 'Pratique a escuta ativa e faça perguntas de qualificação.';
  }
}
