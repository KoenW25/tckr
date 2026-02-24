import { createClient } from '@supabase/supabase-js';
import { sendWaitlistConfirmationEmail } from '@/lib/email';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!email || !isValidEmail(email)) {
      return Response.json({ error: 'Ongeldig e-mailadres.' }, { status: 400 });
    }

    const { data: existing, error: existingError } = await supabaseService
      .from('waitlist')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      console.error('[Waitlist] Existing check failed:', existingError);
      return Response.json({ error: 'Kon wachtlijst niet controleren.' }, { status: 500 });
    }

    if (existing) {
      return Response.json({ status: 'exists' }, { status: 200 });
    }

    const { error: insertError } = await supabaseService
      .from('waitlist')
      .insert({ email });

    if (insertError) {
      if (insertError.code === '23505') {
        return Response.json({ status: 'exists' }, { status: 200 });
      }
      console.error('[Waitlist] Insert failed:', insertError);
      return Response.json({ error: 'Kon je niet inschrijven op de wachtlijst.' }, { status: 500 });
    }

    const { error: mailError } = await sendWaitlistConfirmationEmail(email);
    if (mailError) {
      console.error('[Waitlist] Confirmation email failed:', mailError);
      return Response.json(
        {
          status: 'success_no_email',
          warning:
            'Je staat op de wachtlijst, maar de bevestigingsmail kon niet worden verstuurd.',
        },
        { status: 200 }
      );
    }

    return Response.json({ status: 'success' }, { status: 200 });
  } catch (err) {
    console.error('[Waitlist] Unexpected error:', err);
    return Response.json({ error: 'Interne fout bij aanmelden.' }, { status: 500 });
  }
}
