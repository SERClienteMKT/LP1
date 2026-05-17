export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, company, email, phone } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const SHEET_URL   = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  const FROM        = 'S.E.R. Cliente <noreply@email.sercliente.com>';
  const INTERNAL    = 'comercial@email.sercliente.com';
  const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  try {
    // ── 1. Google Sheets ────────────────────────────────────────────────
    if (SHEET_URL) {
      await fetch(SHEET_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: now,
          name,
          company: company || '',
          email,
          phone: phone || '',
          stage: 'Novo Lead',
          source: 'Landing Page'
        })
      });
    }

    // ── 2. E-mail interno ───────────────────────────────────────────────
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [INTERNAL],
        subject: `🟢 Novo Lead — ${name}${company ? ' · ' + company : ''}`,
        html: buildInternalEmail(name, company, email, phone, now)
      })
    });

    // ── 3. E-mail de confirmação para o lead ────────────────────────────
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM,
        to: [email],
        reply_to: INTERNAL,
        subject: 'Recebemos sua solicitação — S.E.R. Cliente',
        html: buildLeadEmail(name)
      })
    });

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('submit-lead error:', err);
    return res.status(500).json({ error: 'Erro ao processar. Tente novamente.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// E-MAIL INTERNO
// ═══════════════════════════════════════════════════════════════════════
function buildInternalEmail(name, company, email, phone, timestamp) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Novo Lead</title></head>
<body style="margin:0;padding:0;background:#F4F3F0;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F0;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header verde -->
        <tr><td style="background:linear-gradient(135deg,#003A1A 0%,#005A28 60%,#008038 100%);padding:32px 40px">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.6);letter-spacing:.1em;text-transform:uppercase">S.E.R. Cliente · CRM</p>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:#fff">🟢 Novo Lead Recebido</h1>
          <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.7)">${timestamp}</p>
        </td></tr>

        <!-- Dados do lead -->
        <tr><td style="padding:32px 40px">
          <p style="margin:0 0 20px;font-size:15px;color:#3a3a3a">Um novo lead chegou pela landing page. Aqui estão os dados:</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E8E6E3;border-radius:12px;overflow:hidden">
            ${row('Nome completo', name)}
            ${row('Empresa', company || '—')}
            ${row('E-mail', `<a href="mailto:${email}" style="color:#008038;text-decoration:none">${email}</a>`)}
            ${row('Telefone / WhatsApp', phone || '—')}
            ${row('Estágio', '<span style="background:#E8F7EE;color:#006B30;padding:3px 10px;border-radius:100px;font-size:12px;font-weight:600">Novo Lead</span>')}
            ${row('Origem', 'Landing Page')}
          </table>

          <div style="margin:28px 0 0;text-align:center">
            <a href="mailto:${email}" style="display:inline-block;background:#008038;color:#fff;text-decoration:none;padding:14px 32px;border-radius:100px;font-size:14px;font-weight:600">Responder ao lead</a>
          </div>
        </td></tr>

        <tr><td style="background:#F8F7F5;padding:20px 40px;border-top:1px solid #EEECEA">
          <p style="margin:0;font-size:12px;color:#aaa;text-align:center">S.E.R. Cliente · CNPJ 43.889.876/0001-43 · <a href="mailto:contato@sercliente.com" style="color:#aaa">contato@sercliente.com</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}

function row(label, value) {
  return `<tr style="border-bottom:1px solid #F0EFEC">
    <td style="padding:12px 18px;font-size:13px;color:#888;font-weight:500;width:40%;background:#FAFAF8">${label}</td>
    <td style="padding:12px 18px;font-size:14px;color:#1a1a1a;font-weight:400">${value}</td>
  </tr>`;
}

// ═══════════════════════════════════════════════════════════════════════
// E-MAIL PARA O LEAD
// ═══════════════════════════════════════════════════════════════════════
function buildLeadEmail(name) {
  const firstName = name.split(' ')[0];
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confirmação de solicitação</title></head>
<body style="margin:0;padding:0;background:#F4F3F0;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F0;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header verde com logo -->
        <tr><td style="background:linear-gradient(135deg,#003A1A 0%,#005A28 60%,#008038 100%);padding:36px 40px;text-align:center">
          <img src="https://www.sercliente.com/fotos/Logo%20branco.png" alt="S.E.R. Cliente" style="height:64px;display:block;margin:0 auto">
        </td></tr>

        <!-- Corpo -->
        <tr><td style="padding:40px 40px 32px">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a1a">Olá, ${firstName}! 👋</h2>
          <p style="margin:0 0 16px;font-size:15px;color:#3a3a3a;line-height:1.7">Recebemos sua solicitação com sucesso. Ficamos felizes com o seu interesse na <strong>S.E.R. Cliente</strong>.</p>
          <p style="margin:0 0 24px;font-size:15px;color:#3a3a3a;line-height:1.7">Nossa equipe entrará em contato em até <strong>48 horas</strong> para apresentar a plataforma e entender como podemos apoiar a gestão de feedbacks da sua operação.</p>

          <div style="background:#F0FBF4;border-left:3px solid #32CC61;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 28px">
            <p style="margin:0;font-size:14px;color:#006B30;font-weight:600">O que acontece agora?</p>
            <p style="margin:6px 0 0;font-size:13px;color:#3a3a3a;line-height:1.6">Um especialista da S.E.R. Cliente agendará uma demonstração personalizada para o contexto da sua empresa.</p>
          </div>

          <p style="margin:0;font-size:14px;color:#666;line-height:1.7">Caso precise entrar em contato antes, responda a este e-mail ou escreva para <a href="mailto:comercial@email.sercliente.com" style="color:#008038;text-decoration:none;font-weight:600">comercial@email.sercliente.com</a>.</p>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:0 40px 36px;text-align:center">
          <a href="https://www.sercliente.com" style="display:inline-block;background:#008038;color:#fff;text-decoration:none;padding:14px 36px;border-radius:100px;font-size:14px;font-weight:600">Conhecer a plataforma</a>
        </td></tr>

        <tr><td style="background:#F8F7F5;padding:20px 40px;border-top:1px solid #EEECEA">
          <p style="margin:0;font-size:12px;color:#aaa;text-align:center;line-height:1.7">S.E.R. Cliente · CNPJ 43.889.876/0001-43<br>
          Você recebeu este e-mail porque solicitou uma demonstração em nosso site.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;
}
