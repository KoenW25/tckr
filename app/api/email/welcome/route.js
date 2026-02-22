import { createClient } from '@supabase/supabase-js';
import { sendWelcomeEmail } from '@/lib/email';

const supabaseService = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseService.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Only send welcome email to users created in the last 2 minutes
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffMs = now - createdAt;
    const TWO_MINUTES = 2 * 60 * 1000;

    if (diffMs > TWO_MINUTES) {
      return Response.json({ message: 'Not a new user, skipping' }, { status: 200 });
    }

    const email = user.email;
    if (!email) {
      return Response.json({ error: 'No email found' }, { status: 400 });
    }

    await sendWelcomeEmail(email);
    console.log('[Welcome Email] Sent to', email);

    return Response.json({ message: 'Welcome email sent' }, { status: 200 });
  } catch (err) {
    console.error('[Welcome Email] Error:', err);
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
