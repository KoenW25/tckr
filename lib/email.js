import { Resend } from 'resend';
import { calculateBuyerTotal, formatPrice } from '@/lib/fees';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Tckr <noreply@tckr.nl>';

function layout(content) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08);">
        <tr><td style="background:#0f172a;padding:24px 32px;">
          <span style="font-size:20px;">🎟</span>
          <span style="color:#f8fafc;font-size:18px;font-weight:600;margin-left:8px;vertical-align:middle;">Tckr</span>
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
            &copy; ${new Date().getFullYear()} Tckr &mdash; Veilig tickets kopen en verkopen
          </p>
          <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
            <a href="${baseUrl}" style="color:#0ea5e9;text-decoration:none;">tckr.nl</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href, label) {
  return `
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#0ea5e9;border-radius:9999px;padding:12px 28px;">
        <a href="${href}" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">${label}</a>
      </td></tr>
    </table>`;
}

export async function sendWelcomeEmail(to, name) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';
  const safeName = (name || '').trim() || 'daar';
  const unsubscribeUrl = `mailto:noreply@tckr.nl?subject=Uitschrijven%20Tckr&body=Schrijf%20mij%20uit%20voor%20Tckr%20e-mails.%20E-mailadres:%20${encodeURIComponent(to)}`;

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Welkom ${safeName}! Je staat er klaar voor.</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      Tckr is de eerlijke markt voor tickets. Koop en verkoop tickets tegen transparante prijzen.
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#475569;line-height:1.8;">
      <li><strong>Geverifieerde tickets</strong></li>
      <li><strong>Transparante prijzen</strong></li>
      <li><strong>Directe uitbetaling</strong></li>
    </ul>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#22c55e;border-radius:9999px;padding:12px 28px;">
        <a href="${baseUrl}/markt" style="color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;display:inline-block;">Bekijk de markt</a>
      </td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;text-align:center;">
      <a href="${baseUrl}" style="color:#0ea5e9;text-decoration:none;">tckr.nl</a>
      &nbsp;•&nbsp;
      <a href="${unsubscribeUrl}" style="color:#0ea5e9;text-decoration:none;">Uitschrijven</a>
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: 'noreply@tckr.nl',
    to,
    subject: 'Welkom bij Tckr! 🎟',
    html,
  });

  if (error) {
    console.error('[Email] Failed to send welcome email:', error);
  }
  return { data, error };
}

export async function sendBuyerConfirmationEmail(to, eventName, amount, pdfUrl) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Je ticket is bevestigd! ✅</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Je aankoop is succesvol verwerkt. Hier zijn de details:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Evenement</td>
            <td style="font-size:14px;color:#0f172a;font-weight:600;text-align:right;padding-bottom:8px;">${eventName}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding-top:8px;border-top:1px solid #e2e8f0;">Betaald bedrag (incl. servicekosten)</td>
            <td style="font-size:14px;color:#0f172a;font-weight:600;text-align:right;padding-top:8px;border-top:1px solid #e2e8f0;">&euro; ${amount}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.6;">
      Je ticket is nu beschikbaar in je dashboard. Je kunt het daar downloaden.
    </p>
    ${pdfUrl ? button(pdfUrl, 'Download je ticket (PDF)') : ''}
    ${button(`${baseUrl}/dashboard`, 'Ga naar dashboard')}
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Heb je vragen over je aankoop? Reply gerust op deze e-mail.
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Je ticket voor ${eventName} is bevestigd! 🎟`,
    html,
  });

  if (error) {
    console.error('[Email] Failed to send buyer confirmation:', error);
  }
  return { data, error };
}

export async function sendSellerNotificationEmail(to, eventName, amount) {
  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Je ticket is verkocht! 🎉</h1>
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Goed nieuws! Een van je tickets is zojuist verkocht. Hier zijn de details:
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Evenement</td>
            <td style="font-size:14px;color:#0f172a;font-weight:600;text-align:right;padding-bottom:8px;">${eventName}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding-top:8px;border-top:1px solid #e2e8f0;">Ontvangen bedrag</td>
            <td style="font-size:14px;color:#0f172a;font-weight:600;text-align:right;padding-top:8px;border-top:1px solid #e2e8f0;">&euro; ${amount}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:0 0 4px;font-size:14px;color:#475569;line-height:1.6;">
      De uitbetaling wordt binnen <strong>5 werkdagen</strong> op je rekening gestort.
    </p>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
      Heb je vragen over de uitbetaling? Reply gerust op deze e-mail.
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: `Je ticket voor ${eventName} is verkocht! 💰`,
    html,
  });

  if (error) {
    console.error('[Email] Failed to send seller notification:', error);
  }
  return { data, error };
}

export async function sendWaitlistConfirmationEmail(to) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://tckr.nl';

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Je staat op de Tckr wachtlijst! ✅</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      Bedankt voor je aanmelding. We sturen je een e-mail zodra Tckr live gaat.
    </p>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      Intussen kun je alvast meer lezen over hoe Tckr werkt en de markt volgen.
    </p>
    ${button(`${baseUrl}/hoe-het-werkt`, 'Bekijk de FAQ')}
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Heb je vragen? Reply gerust op deze e-mail.
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Je staat op de Tckr wachtlijst 🎟',
    html,
  });

  if (error) {
    console.error('[Email] Failed to send waitlist confirmation:', error);
  }
  return { data, error };
}

export async function sendBidAcceptedEmail(to, name, eventName, amount, paymentUrl) {
  const bidAmount = Number(amount) || 0;
  const totalAmount = calculateBuyerTotal(bidAmount);
  const safeName = (name || '').trim() || 'daar';

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Je bod is geaccepteerd! Betaal nu je ticket 🎟</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      Goed nieuws ${safeName}! Je bod van &euro;${formatPrice(bidAmount)} op <strong>${eventName}</strong> is geaccepteerd.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#22c55e;border-radius:9999px;padding:12px 28px;">
        <a href="${paymentUrl}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;display:inline-block;">Betaal nu &mdash; &euro;${formatPrice(totalAmount)}</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#dc2626;line-height:1.6;">
      Deze link verloopt over 30 minuten.
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Je bod is geaccepteerd! Betaal nu je ticket 🎟',
    html,
  });

  if (error) {
    console.error('[Email] Failed to send bid accepted email:', error);
  }
  return { data, error };
}

export async function sendPrivateSaleEmail(to, eventName, amount, paymentUrl) {
  const totalAmount = Number(amount) || 0;

  const html = layout(`
    <h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Iemand wil een ticket met je delen via Tckr 🎟</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#475569;line-height:1.6;">
      Je hebt een persoonlijke uitnodiging ontvangen om een ticket te kopen voor <strong>${eventName}</strong>.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
      <tr><td style="padding:12px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:13px;color:#64748b;padding-bottom:8px;">Prijs incl. servicekosten</td>
            <td style="font-size:14px;color:#0f172a;font-weight:600;text-align:right;padding-bottom:8px;">&euro; ${formatPrice(totalAmount)}</td>
          </tr>
        </table>
      </td></tr>
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="background:#7c3aed;border-radius:9999px;padding:12px 28px;">
        <a href="${paymentUrl}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;display:inline-block;">Koop dit ticket &mdash; &euro;${formatPrice(totalAmount)}</a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:13px;color:#dc2626;line-height:1.6;">
      Deze link is persoonlijk voor jou aangemaakt en verloopt na 24 uur.
    </p>
  `);

  const { data, error } = await resend.emails.send({
    from: FROM,
    to,
    subject: 'Iemand wil een ticket met je delen via Tckr 🎟',
    html,
  });

  if (error) {
    console.error('[Email] Failed to send private sale email:', error);
  }
  return { data, error };
}
