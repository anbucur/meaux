import { Resend } from 'resend';
import { metric } from '@vercel/functions';

const FALLBACK_RECIPIENT = (process.env.ENQUIRY_TO_EMAIL || 'bucuralexandrunicolae@gmail.com').trim();
const EMAIL_DOMAIN = (process.env.RESEND_EMAIL_DOMAIN || 'alexnbucur.space').trim();
const FROM_ADDRESS = `MEAUX Atelier <atelier@${EMAIL_DOMAIN}>`;
const SITE_URL = 'https://www.alexnbucur.space';
const INSTAGRAM_URL = 'https://www.instagram.com/meauxsvision/';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseEmailList(raw) {
  if (!raw) return [];
  const items = Array.isArray(raw) ? raw : String(raw).split(/[,;]+/);
  return Array.from(
    new Set(
      items
        .map((entry) => String(entry || '').trim())
        .filter((entry) => EMAIL_REGEX.test(entry))
    )
  ).slice(0, 5);
}

async function resolveAdminEmailConfig() {
  const fallbackTo = parseEmailList(FALLBACK_RECIPIENT);
  const defaults = {
    to: fallbackTo.length ? fallbackTo : ['bucuralexandrunicolae@gmail.com'],
    cc: [],
    sendClientConfirmation: true,
    source: 'fallback'
  };

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!supabaseUrl || !supabaseKey) return defaults;

  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    Accept: 'application/json'
  };

  try {
    const contentRes = await fetch(
      `${supabaseUrl}/rest/v1/site_content?key=eq.published&select=data&limit=1`,
      { headers, cache: 'no-store' }
    );
    if (contentRes.ok) {
      const rows = await contentRes.json();
      const settings = rows?.[0]?.data?.settings;
      if (settings && typeof settings === 'object') {
        const to = parseEmailList(settings.contactEmail);
        const cc = parseEmailList(settings.enquiryCcEmail).filter((addr) => !to.includes(addr));
        const sendClientConfirmation = settings.sendClientConfirmation !== false;
        if (to.length) {
          return { to, cc, sendClientConfirmation, source: 'site_content' };
        }
      }
    }

    const settingsRes = await fetch(
      `${supabaseUrl}/rest/v1/site_settings?id=eq.default&select=contact_email&limit=1`,
      { headers, cache: 'no-store' }
    );
    if (settingsRes.ok) {
      const rows = await settingsRes.json();
      const to = parseEmailList(rows?.[0]?.contact_email);
      if (to.length) {
        return { to, cc: [], sendClientConfirmation: true, source: 'site_settings' };
      }
    }
  } catch (err) {
    console.error('[api/enquiry] Could not load admin email settings from Supabase:', err);
  }

  return defaults;
}

function formatBriefHtml(brief) {
  return escapeHtml(brief)
    .split(/\r?\n\s*\r?\n/)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px 0;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.78;">${paragraph.replace(/\r?\n/g, '<br>')}</p>`
    )
    .join('')
    .replace(/margin:0 0 14px 0;(?![\s\S]*margin:0 0 14px 0;)/, 'margin:0;');
}

function makeDossierRef() {
  const now = new Date();
  const ym = String(now.getUTCFullYear()).slice(-2) + String(now.getUTCMonth() + 1).padStart(2, '0');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MX-${ym}-${rand}`;
}

function formatAmsterdamTimestamp(date = new Date()) {
  try {
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Amsterdam',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date) + ' CET'
    );
  } catch {
    return date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  }
}

function renderDisciplinePills(disciplines) {
  const list = disciplines.length ? disciplines : ['General Atelier Commission'];
  return list
    .map(
      (item) =>
        `<span style="display:inline-block;margin:0 8px 8px 0;padding:6px 12px;background-color:#121216;border:1px solid #2e2e36;color:#f4f4f2;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.14em;text-transform:uppercase;line-height:1.2;">${escapeHtml(item)}</span>`
    )
    .join('');
}

function buildEmailShell({ preheader, refId, timestamp, kicker, headline, introHtml, bodyHtml, ctaHtml, footerNote }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
  <title>${escapeHtml(kicker)} — MEAUX Atelier</title>
</head>
<body bgcolor="#050506" style="margin:0;padding:0;background-color:#050506;color:#f4f4f2;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#050506" style="background-color:#050506;width:100%;">
    <tr>
      <td align="center" style="padding:36px 16px 48px 16px;">
        <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" bgcolor="#0c0c0f" style="width:100%;max-width:620px;background-color:#0c0c0f;border:1px solid #232329;">
          <!-- Chrome hairline accent -->
          <tr>
            <td height="2" bgcolor="#d4d4d8" style="height:2px;line-height:2px;font-size:2px;background:#d4d4d8;background-image:linear-gradient(90deg,#1a1a20 0%,#f4f4f2 50%,#1a1a20 100%);">&nbsp;</td>
          </tr>

          <!-- Top Atelier Wordmark & Dossier Reference -->
          <tr>
            <td style="padding:26px 32px 22px 32px;border-bottom:1px solid #1e1e24;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" valign="middle">
                    <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:22px;font-weight:800;letter-spacing:-0.04em;text-transform:uppercase;">MEAUX<span style="font-weight:400;color:#d4d4d8;">&#10035;</span></a>
                  </td>
                  <td align="right" valign="middle" style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8e8e93;line-height:1.5;">
                    <div>DOSSIER // ${escapeHtml(refId)}</div>
                    <div style="color:#66666d;">${escapeHtml(timestamp)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Editorial Hero Header -->
          <tr>
            <td style="padding:34px 32px 26px 32px;border-bottom:1px solid #1e1e24;">
              <div style="font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.24em;text-transform:uppercase;color:#9a9aa2;margin-bottom:12px;">
                ${escapeHtml(kicker)}
              </div>
              <h1 style="margin:0 0 14px 0;font-family:Georgia,'Times New Roman',serif;font-size:32px;font-weight:400;font-style:italic;line-height:1.18;color:#ffffff;letter-spacing:-0.01em;">
                ${headline}
              </h1>
              ${introHtml}
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding:28px 32px 30px 32px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- CTA Row -->
          <tr>
            <td style="padding:0 32px 34px 32px;">
              ${ctaHtml}
            </td>
          </tr>

          <!-- Architectural Footer -->
          <tr>
            <td style="padding:22px 32px 26px 32px;border-top:1px solid #1e1e24;background-color:#08080a;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="left" style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;line-height:1.8;">
                    <div style="color:#a1a1aa;">SOFT FORM. SHARP INSTINCT.</div>
                    <div>MEAUX ATELIER · AMSTERDAM · WORLDWIDE</div>
                    ${footerNote ? `<div style="margin-top:6px;color:#52525b;">${escapeHtml(footerNote)}</div>` : ''}
                  </td>
                  <td align="right" valign="top" style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.16em;text-transform:uppercase;line-height:1.8;">
                    <div><a href="${SITE_URL}" style="color:#d4d4d8;text-decoration:none;">alexnbucur.space &#8599;</a></div>
                    <div><a href="${INSTAGRAM_URL}" style="color:#8e8e93;text-decoration:none;">@meauxsvision &#8599;</a></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildStudioDossierHtml(data) {
  const { refId, timestamp, name, email, phone, timeline, disciplines, brief } = data;
  const replySubject = encodeURIComponent(`Re: Atelier Meaux Commission Dossier (${refId})`);
  const replyHref = `mailto:${encodeURIComponent(email)}?subject=${replySubject}`;

  const bodyHtml = `
    <!-- Metadata Specification Grid -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1e1e24;background-color:#09090b;margin-bottom:24px;">
      <tr>
        <td width="50%" valign="top" style="padding:16px 18px;border-right:1px solid #1e1e24;border-bottom:1px solid #1e1e24;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">CLIENT / HOUSE</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:#ffffff;">${escapeHtml(name)}</div>
        </td>
        <td width="50%" valign="top" style="padding:16px 18px;border-bottom:1px solid #1e1e24;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">DIRECT EMAIL</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;"><a href="mailto:${escapeHtml(email)}" style="color:#f4f4f2;text-decoration:underline;">${escapeHtml(email)}</a></div>
        </td>
      </tr>
      <tr>
        <td width="50%" valign="top" style="padding:16px 18px;border-right:1px solid #1e1e24;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">TELEPHONE / WHATSAPP</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#d4d4d8;">${phone ? escapeHtml(phone) : '<span style="color:#52525b;">Not provided</span>'}</div>
        </td>
        <td width="50%" valign="top" style="padding:16px 18px;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">TARGET TIMELINE</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#d4d4d8;">${escapeHtml(timeline || 'Flexible / To be discussed')}</div>
        </td>
      </tr>
    </table>

    <!-- Selected Disciplines -->
    <div style="margin-bottom:24px;">
      <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">DISCIPLINES OF INTEREST</div>
      <div>${renderDisciplinePills(disciplines)}</div>
    </div>

    <!-- Creative Brief -->
    <div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">PROJECT VISION &amp; BRIEF</div>
      <div style="padding:20px 22px;background-color:#08080a;border:1px solid #1e1e24;border-left:2px solid #e4e4e7;">
        ${formatBriefHtml(brief)}
      </div>
    </div>
  `;

  const ctaHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #ffffff;">
          <a href="${replyHref}" style="display:inline-block;padding:14px 26px;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#050506;text-decoration:none;">
            REPLY TO ${escapeHtml(name.split(/\s+/)[0] || 'CLIENT').toUpperCase()} &#8599;
          </a>
        </td>
        <td width="14">&nbsp;</td>
        <td style="border:1px solid #2e2e36;">
          <a href="${SITE_URL}/#enquiries" style="display:inline-block;padding:14px 20px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#d4d4d8;text-decoration:none;">
            OPEN PORTAL &#8599;
          </a>
        </td>
      </tr>
    </table>
  `;

  return buildEmailShell({
    preheader: `New MEAUX commission dossier from ${name} — ${disciplines.join(', ') || 'General Commission'}`,
    refId,
    timestamp,
    kicker: 'INCOMING COMMISSION DOSSIER',
    headline: escapeHtml(name),
    introHtml: `<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.65;color:#a1a1aa;">A new commission brief has been submitted through the Meaux Atelier portal. Hit reply directly to respond to <strong style="color:#ffffff;font-weight:600;">${escapeHtml(email)}</strong>.</p>`,
    bodyHtml,
    ctaHtml,
    footerNote: 'Delivered via Atelier Meaux Portal · Reply directly to reach the client.'
  });
}

function buildClientConfirmationHtml(data) {
  const { refId, timestamp, name, timeline, disciplines, brief } = data;
  const firstName = name.split(/\s+/)[0] || name;

  const bodyHtml = `
    <div style="margin-bottom:22px;">
      <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">YOUR RECORDED SCOPE</div>
      <div>${renderDisciplinePills(disciplines)}</div>
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #1e1e24;background-color:#09090b;margin-bottom:22px;">
      <tr>
        <td width="50%" valign="top" style="padding:15px 18px;border-right:1px solid #1e1e24;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">DOSSIER REFERENCE</div>
          <div style="font-family:'Courier New',Courier,monospace;font-size:13px;color:#ffffff;letter-spacing:0.08em;">${escapeHtml(refId)}</div>
        </td>
        <td width="50%" valign="top" style="padding:15px 18px;">
          <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:6px;">TARGET TIMELINE</div>
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;color:#d4d4d8;">${escapeHtml(timeline || 'To be discussed')}</div>
        </td>
      </tr>
    </table>

    <div>
      <div style="font-family:'Courier New',Courier,monospace;font-size:9px;letter-spacing:0.2em;text-transform:uppercase;color:#71717a;margin-bottom:10px;">BRIEF SUMMARY</div>
      <div style="padding:18px 20px;background-color:#08080a;border:1px solid #1e1e24;border-left:2px solid #52525b;">
        ${formatBriefHtml(brief)}
      </div>
    </div>
  `;

  const ctaHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #ffffff;">
          <a href="${SITE_URL}" style="display:inline-block;padding:14px 26px;font-family:'Courier New',Courier,monospace;font-size:11px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#050506;text-decoration:none;">
            RETURN TO THE ATELIER &#8599;
          </a>
        </td>
        <td width="14">&nbsp;</td>
        <td style="border:1px solid #2e2e36;">
          <a href="${INSTAGRAM_URL}" style="display:inline-block;padding:14px 20px;font-family:'Courier New',Courier,monospace;font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#d4d4d8;text-decoration:none;">
            @MEAUXSVISION &#8599;
          </a>
        </td>
      </tr>
    </table>
  `;

  return buildEmailShell({
    preheader: `Your MEAUX Atelier commission dossier (${refId}) has been received.`,
    refId,
    timestamp,
    kicker: 'DOSSIER REGISTERED // ATELIER MEAUX',
    headline: `Thank you, ${escapeHtml(firstName)}.`,
    introHtml: `<p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;line-height:1.72;color:#b4b4bc;">Your commission dossier has been received. Every inquiry is reviewed personally by Mohammed to ensure alignment with the atelier's creative direction and seasonal calendar. You can expect a personal response within <strong style="color:#ffffff;font-weight:600;">24 to 48 hours</strong>.</p>`,
    bodyHtml,
    ctaHtml,
    footerNote: 'Strict confidentiality is maintained for every commission dossier. Simply reply to this email to add references or notes.'
  });
}

function buildPlainTextDossier(data) {
  const { refId, timestamp, name, email, phone, timeline, disciplines, brief } = data;
  return [
    `MEAUX✳ ATELIER — COMMISSION DOSSIER (${refId})`,
    `Received: ${timestamp}`,
    `================================================`,
    `CLIENT / HOUSE : ${name}`,
    `EMAIL          : ${email}`,
    `PHONE          : ${phone || 'Not provided'}`,
    `TIMELINE       : ${timeline || 'Flexible'}`,
    `DISCIPLINES    : ${disciplines.join(', ') || 'General Commission'}`,
    ``,
    `PROJECT VISION & BRIEF:`,
    brief,
    ``,
    `================================================`,
    `MEAUX Atelier · Amsterdam · Worldwide`,
    SITE_URL
  ].join('\n');
}

export async function POST(request) {
  const startedAt = performance.now();

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      metric('enquiry.submitted', 1, { outcome: 'validation_error' });
      return Response.json({ ok: false, error: 'Invalid request payload.' }, { status: 400 });
    }

    // Silent honeypot check for automated bots
    if (body && typeof body.website === 'string' && body.website.trim().length > 0) {
      metric('enquiry.submitted', 1, { outcome: 'honeypot' });
      return Response.json({ ok: true, refId: makeDossierRef(), ignored: true }, { status: 200 });
    }

    const name = String(body?.name || '').trim().slice(0, 160);
    const email = String(body?.email || '').trim().slice(0, 200);
    const phone = String(body?.phone || '').trim().slice(0, 80);
    const timeline = String(body?.timeline || '').trim().slice(0, 120);
    const brief = String(body?.brief || '').trim().slice(0, 6000);
    const disciplines = Array.isArray(body?.disciplines)
      ? body.disciplines.map((d) => String(d).trim().slice(0, 80)).filter(Boolean).slice(0, 10)
      : [];

    if (!name || !email || !brief) {
      metric('enquiry.submitted', 1, { outcome: 'validation_error' });
      return Response.json(
        { ok: false, error: 'Please provide your name, email address, and project brief.' },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      metric('enquiry.submitted', 1, { outcome: 'validation_error' });
      return Response.json(
        { ok: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[api/enquiry] Missing RESEND_API_KEY environment variable.');
      metric('enquiry.submitted', 1, { outcome: 'error' });
      return Response.json(
        { ok: false, error: 'Email delivery service is not configured yet.' },
        { status: 500 }
      );
    }

    // Resolve recipient email(s) & confirmation preference live from Admin settings in Supabase
    const emailConfig = await resolveAdminEmailConfig();
    const primaryRecipient = emailConfig.to[0];

    const resend = new Resend(apiKey);
    const refId = makeDossierRef();
    const timestamp = formatAmsterdamTimestamp();
    const payload = { refId, timestamp, name, email, phone, timeline, disciplines, brief };
    const disciplineSummary = disciplines.length ? disciplines.join(', ') : 'General Commission';

    // 1. Send formatted Atelier Dossier to the Admin-configured recipient(s)
    const studioEmailParams = {
      from: FROM_ADDRESS,
      to: emailConfig.to,
      replyTo: email,
      subject: `MEAUX✳ Dossier ${refId} — ${name} (${disciplineSummary})`,
      html: buildStudioDossierHtml(payload),
      text: buildPlainTextDossier(payload)
    };
    if (emailConfig.cc.length) {
      studioEmailParams.cc = emailConfig.cc;
    }

    const studioResult = await resend.emails.send(studioEmailParams);

    if (studioResult.error) {
      console.error('[api/enquiry] Resend studio email error:', studioResult.error);
      metric('enquiry.submitted', 1, { outcome: 'error' });
      return Response.json(
        { ok: false, error: 'Could not dispatch your dossier email right now. Please try again shortly.' },
        { status: 502 }
      );
    }

    // 2. Send matching luxury confirmation receipt to the client (if enabled in Admin settings)
    let clientReceiptSent = false;
    if (emailConfig.sendClientConfirmation) {
      try {
        const receiptResult = await resend.emails.send({
          from: FROM_ADDRESS,
          to: [email],
          replyTo: primaryRecipient,
          subject: `MEAUX✳ Atelier — Dossier Received (${refId})`,
          html: buildClientConfirmationHtml(payload),
          text: `Thank you, ${name}.\n\nYour MEAUX Atelier commission dossier (${refId}) has been received.\nMohammed reviews every inquiry personally and will respond within 24–48 hours.\n\nScope: ${disciplineSummary}\nTimeline: ${timeline || 'To be discussed'}\n\nMEAUX Atelier · Amsterdam · Worldwide\n${SITE_URL}`
        });
        clientReceiptSent = !receiptResult.error;
        if (receiptResult.error) {
          console.error('[api/enquiry] Resend client confirmation error:', receiptResult.error);
        }
      } catch (receiptErr) {
        console.error('[api/enquiry] Unexpected client receipt failure:', receiptErr);
      }
    }

    metric('enquiry.submitted', 1, { outcome: 'success', config_source: emailConfig.source });
    return Response.json(
      {
        ok: true,
        refId,
        emailId: studioResult.data?.id || null,
        clientReceiptSent
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('[api/enquiry] Unhandled error:', err);
    metric('enquiry.submitted', 1, { outcome: 'error' });
    return Response.json(
      { ok: false, error: 'Unexpected error while transmitting your dossier.' },
      { status: 500 }
    );
  } finally {
    metric('enquiry.email_duration_ms', Math.round(performance.now() - startedAt), { provider: 'resend' });
  }
}
