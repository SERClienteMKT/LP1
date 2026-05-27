export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, company, email, phone, website } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Nome e e-mail são obrigatórios.' });

  // Anti-bot: honeypot preenchido
  if (website) return res.status(200).json({ success: true });

  // Anti-bot: nome sem espaço ou sem vogais (string aleatória)
  function looksLikeBot(str) {
    if (!str) return false;
    const vowels = (str.match(/[aeiouáéíóúàèìòùâêîôûãõ]/gi) || []).length;
    return vowels / str.replace(/\s/g,'').length < 0.1;
  }
  if (!name.includes(' ') || looksLikeBot(name) || looksLikeBot(company)) {
    return res.status(200).json({ success: true }); // retorna 200 para não dar dica ao bot
  }

  const RESEND_KEY  = process.env.RESEND_API_KEY;
  const SHEET_URL   = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  const FROM        = 'S.E.R. Cliente <noreply@email.sercliente.com>';
  const INTERNAL    = 'contato@sercliente.com';
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
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<style type="text/css">:root{color-scheme:light}body{color-scheme:light}</style>
<title>Confirmação de solicitação</title></head>
<body style="margin:0;padding:0;background:#F4F3F0;font-family:'Inter',Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3F0;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header verde com logo -->
        <tr><td bgcolor="#003A1A" style="background:#003A1A;background:linear-gradient(135deg,#003A1A 0%,#005A28 60%,#008038 100%) !important;padding:36px 40px;text-align:center">
          <img src="data:image/png;base64,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" alt="S.E.R. Cliente" style="height:64px;display:block;margin:0 auto">
        </td></tr>

        <!-- Corpo -->
        <tr><td style="padding:40px 40px 36px">
          <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#1a1a1a">Olá, ${firstName}! 👋</h2>
          <p style="margin:0 0 24px;font-size:15px;color:#3a3a3a;line-height:1.7">Recebemos a sua mensagem de interesse para conhecer a plataforma <strong>S.E.R. Cliente</strong>.</p>

          <div style="background:#F0FBF4;border-left:3px solid #32CC61;border-radius:0 8px 8px 0;padding:16px 20px;margin:0 0 28px">
            <p style="margin:0;font-size:14px;color:#006B30;font-weight:600">O que acontece agora?</p>
            <p style="margin:6px 0 0;font-size:13px;color:#3a3a3a;line-height:1.6">Um especialista da S.E.R. Cliente entrará em contato, em até <strong>24h</strong>, para agendar uma demonstração da plataforma.</p>
          </div>

          <p style="margin:0;font-size:14px;color:#666;line-height:1.7">Mais informações, enviar e-mail para <a href="mailto:contato@sercliente.com" style="color:#008038;text-decoration:none;font-weight:600">contato@sercliente.com</a>.</p>
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
