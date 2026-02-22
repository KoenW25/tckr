'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [sellerTickets, setSellerTickets] = useState([]);
  const [loadingSellerTickets, setLoadingSellerTickets] = useState(true);
  const [ticketsError, setTicketsError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const [purchasedTickets, setPurchasedTickets] = useState([]);
  const [loadingPurchased, setLoadingPurchased] = useState(true);

  const [bidsOnMyTickets, setBidsOnMyTickets] = useState([]);
  const [loadingBids, setLoadingBids] = useState(true);
  const [acceptingBidId, setAcceptingBidId] = useState(null);

  const [myBids, setMyBids] = useState([]);
  const [loadingMyBids, setLoadingMyBids] = useState(true);
  const [deletingBidId, setDeletingBidId] = useState(null);

  const [activeTab, setActiveTab] = useState('overzicht');

  const [profile, setProfile] = useState({ phone: '', email: '', iban: '', full_name: '' });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error) setUser(data.user ?? null);
      } finally {
        setLoadingUser(false);
      }
    }
    fetchUser();
  }, []);

  // Seller tickets
  useEffect(() => {
    async function fetchSellerTickets() {
      if (!user) {
        setSellerTickets([]);
        setLoadingSellerTickets(false);
        return;
      }
      setLoadingSellerTickets(true);
      setTicketsError(null);
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('id, pdf_url, status, ask_price, event_name, event_date, event_id, reserved_for, reserved_until')
          .eq('user_id', user.id)
          .order('id', { ascending: false });

        if (error) throw error;

        const eventIds = [...new Set((data ?? []).map((t) => t.event_id).filter(Boolean))];
        let eventMap = {};
        if (eventIds.length > 0) {
          const { data: events } = await supabase
            .from('events')
            .select('id, name, date, venue')
            .in('id', eventIds);
          for (const ev of events ?? []) eventMap[ev.id] = ev;
        }

        const enriched = (data ?? []).map((t) => ({
          ...t,
          eventInfo: eventMap[t.event_id] || null,
        }));

        setSellerTickets(enriched);
      } catch (err) {
        console.error('Error fetching seller tickets:', err);
        setTicketsError('Er ging iets mis bij het ophalen van je tickets.');
      } finally {
        setLoadingSellerTickets(false);
      }
    }
    fetchSellerTickets();
  }, [user]);

  // Purchased tickets (buyer)
  useEffect(() => {
    async function fetchPurchasedTickets() {
      if (!user) {
        setPurchasedTickets([]);
        setLoadingPurchased(false);
        return;
      }
      setLoadingPurchased(true);
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('id, pdf_url, status, ask_price, event_name, event_date, event_id, buyer_id')
          .eq('buyer_id', user.id)
          .eq('status', 'sold')
          .order('id', { ascending: false });

        if (error) throw error;

        const eventIds = [...new Set((data ?? []).map((t) => t.event_id).filter(Boolean))];
        let eventMap = {};
        if (eventIds.length > 0) {
          const { data: events } = await supabase
            .from('events')
            .select('id, name, date, venue')
            .in('id', eventIds);
          for (const ev of events ?? []) eventMap[ev.id] = ev;
        }

        const enriched = (data ?? []).map((t) => ({
          ...t,
          eventInfo: eventMap[t.event_id] || null,
        }));

        setPurchasedTickets(enriched);
      } catch (err) {
        console.error('Error fetching purchased tickets:', err);
      } finally {
        setLoadingPurchased(false);
      }
    }
    fetchPurchasedTickets();
  }, [user]);

  // Bids on my tickets (seller view)
  useEffect(() => {
    async function fetchBidsOnMyTickets() {
      if (!user || sellerTickets.length === 0) {
        setBidsOnMyTickets([]);
        setLoadingBids(false);
        return;
      }
      setLoadingBids(true);
      try {
        const ticketIds = sellerTickets.map((t) => t.id);
        const eventIds = [...new Set(sellerTickets.map((t) => t.event_id).filter(Boolean))];

        const { data: ticketBids, error: tErr } = await supabase
          .from('bids')
          .select('id, ticket_id, event_id, bid_price, user_id, status, created_at')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false });
        if (tErr) throw tErr;

        let eventBids = [];
        if (eventIds.length > 0) {
          const { data: eBids, error: eErr } = await supabase
            .from('bids')
            .select('id, ticket_id, event_id, bid_price, user_id, status, created_at')
            .in('event_id', eventIds)
            .is('ticket_id', null)
            .order('created_at', { ascending: false });
          if (!eErr) eventBids = eBids ?? [];
        }

        const seen = new Set();
        const all = [...(ticketBids ?? []), ...eventBids].filter((b) => {
          if (seen.has(b.id)) return false;
          seen.add(b.id);
          return true;
        });
        all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setBidsOnMyTickets(all);
      } catch (err) {
        console.error('Error fetching bids:', err);
      } finally {
        setLoadingBids(false);
      }
    }
    if (!loadingSellerTickets) fetchBidsOnMyTickets();
  }, [user, sellerTickets, loadingSellerTickets]);

  // My own bids (buyer view)
  useEffect(() => {
    async function fetchMyBids() {
      if (!user) {
        setMyBids([]);
        setLoadingMyBids(false);
        return;
      }
      setLoadingMyBids(true);
      try {
        const { data: bidsData, error: bidsErr } = await supabase
          .from('bids')
          .select('id, ticket_id, event_id, bid_price, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        if (bidsErr) throw bidsErr;

        const eventIds = [...new Set((bidsData ?? []).map((b) => b.event_id).filter(Boolean))];
        let eventNameMap = {};
        if (eventIds.length > 0) {
          const { data: events } = await supabase.from('events').select('id, name, date').in('id', eventIds);
          for (const ev of events ?? []) eventNameMap[ev.id] = { name: ev.name, date: ev.date };
        }

        setMyBids(
          (bidsData ?? []).map((b) => ({
            ...b,
            eventName: eventNameMap[b.event_id]?.name || null,
            eventDate: eventNameMap[b.event_id]?.date || null,
          }))
        );
      } catch (err) {
        console.error('Error fetching my bids:', err);
      } finally {
        setLoadingMyBids(false);
      }
    }
    fetchMyBids();
  }, [user]);

  // Profile
  useEffect(() => {
    async function fetchProfile() {
      if (!user) { setLoadingProfile(false); return; }
      setLoadingProfile(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('phone, email, iban, full_name')
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          setProfile({ phone: data.phone || '', email: data.email || '', iban: data.iban || '', full_name: data.full_name || '' });
        } else {
          setProfile((prev) => ({ ...prev, email: user.email || '', full_name: user.user_metadata?.full_name || '' }));
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    setProfileMessage('');
    try {
      const { error } = await supabase.from('profiles').upsert(
        { user_id: user.id, phone: profile.phone.trim(), email: profile.email.trim(), iban: profile.iban.trim(), full_name: profile.full_name.trim() },
        { onConflict: 'user_id' }
      );
      if (error) throw error;
      setProfileMessage('Je gegevens zijn opgeslagen.');
    } catch (err) {
      console.error('Error saving profile:', err);
      setProfileMessage('Er ging iets mis bij het opslaan.');
    } finally {
      setSavingProfile(false);
    }
  };

  const extractStoragePathFromUrl = (url) => {
    if (!url) return null;
    const marker = '/storage/v1/object/public/tickets/';
    const index = url.indexOf(marker);
    if (index === -1) return url;
    return url.substring(index + marker.length);
  };

  const handleDeleteTicket = async (ticket) => {
    if (!window.confirm('Weet je zeker dat je dit ticket wilt verwijderen?')) return;
    setDeletingId(ticket.id);
    setTicketsError(null);
    try {
      const storagePath = extractStoragePathFromUrl(ticket.pdf_url);
      if (storagePath) {
        const { error: storageError } = await supabase.storage.from('tickets').remove([storagePath]);
        if (storageError) console.error('Error deleting ticket PDF from storage:', storageError);
      }
      const { error: deleteError } = await supabase.from('tickets').delete().eq('id', ticket.id);
      if (deleteError) { setTicketsError('Er ging iets mis bij het verwijderen.'); return; }
      setSellerTickets((prev) => prev.filter((t) => t.id !== ticket.id));
    } catch (err) {
      console.error('Unexpected error deleting ticket:', err);
      setTicketsError('Er ging iets mis bij het verwijderen.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleAcceptBid = async (bid) => {
    if (!window.confirm(`Weet je zeker dat je het bod van € ${Number(bid.bid_price).toFixed(2).replace('.', ',')} wilt accepteren? De koper heeft 2 uur om te betalen.`)) return;
    setAcceptingBidId(bid.id);
    try {
      const reservedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      let targetTicketId = bid.ticket_id;

      if (!targetTicketId && bid.event_id) {
        const availableTicket = sellerTickets.find((t) => t.event_id === bid.event_id && t.status === 'available');
        if (!availableTicket) { setTicketsError('Geen beschikbaar ticket gevonden om aan dit bod te koppelen.'); setAcceptingBidId(null); return; }
        targetTicketId = availableTicket.id;
        await supabase.from('bids').update({ ticket_id: targetTicketId }).eq('id', bid.id);
      }

      const { error: acceptError } = await supabase.from('bids').update({ status: 'accepted' }).eq('id', bid.id);
      if (acceptError) throw acceptError;

      if (targetTicketId) {
        await supabase.from('bids').update({ status: 'rejected' }).eq('ticket_id', targetTicketId).neq('id', bid.id).eq('status', 'pending');
        await supabase.from('tickets').update({ status: 'reserved', reserved_for: bid.user_id, reserved_until: reservedUntil }).eq('id', targetTicketId);
      }

      setBidsOnMyTickets((prev) =>
        prev.map((b) => {
          if (b.id === bid.id) return { ...b, status: 'accepted', ticket_id: targetTicketId };
          if (targetTicketId && b.ticket_id === targetTicketId && b.status === 'pending') return { ...b, status: 'rejected' };
          return b;
        })
      );
      if (targetTicketId) {
        setSellerTickets((prev) =>
          prev.map((t) => (t.id === targetTicketId ? { ...t, status: 'reserved', reserved_for: bid.user_id, reserved_until: reservedUntil } : t))
        );
      }
    } catch (err) {
      console.error('Error accepting bid:', err);
      setTicketsError('Er ging iets mis bij het accepteren van het bod.');
    } finally {
      setAcceptingBidId(null);
    }
  };

  const handleCancelMyBid = async (bid) => {
    if (!window.confirm(`Weet je zeker dat je je bod van € ${Number(bid.bid_price).toFixed(2).replace('.', ',')} wilt intrekken?`)) return;
    setDeletingBidId(bid.id);
    try {
      const { error } = await supabase.from('bids').update({ status: 'cancelled' }).eq('id', bid.id);
      if (error) throw error;
      setMyBids((prev) => prev.map((b) => (b.id === bid.id ? { ...b, status: 'cancelled' } : b)));
    } catch (err) {
      console.error('Error cancelling bid:', err);
    } finally {
      setDeletingBidId(null);
    }
  };

  // Stats
  const activeCount = sellerTickets.filter((t) => t.status === 'available').length;
  const soldCount = sellerTickets.filter((t) => t.status === 'sold').length;
  const boughtCount = purchasedTickets.length;

  const displayName = user?.user_metadata?.full_name?.split?.(' ')?.[0] || user?.email || '';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Welkom{loadingUser ? '' : displayName ? `, ${displayName}` : ''}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Een overzicht van je tickets, biedingen en aankopen.
          </p>
        </header>

        {/* Tabs */}
        <div className="mb-8 flex gap-2">
          {[
            { id: 'overzicht', label: 'Overzicht' },
            { id: 'gegevens', label: 'Mijn gegevens' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/30'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mijn gegevens tab */}
        {activeTab === 'gegevens' && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-100">
            <h2 className="mb-1 text-sm font-semibold text-slate-900">Mijn gegevens</h2>
            <p className="mb-6 text-xs text-slate-500">
              Vul je gegevens in zodat we je kunnen bereiken en uitbetalingen kunnen verwerken.
            </p>
            {loadingProfile ? (
              <p className="text-xs text-slate-500">Bezig met laden...</p>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Volledige naam</label>
                  <input type="text" value={profile.full_name} onChange={(e) => setProfile((p) => ({ ...p, full_name: e.target.value }))} placeholder="Jan Jansen" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">E-mailadres</label>
                  <input type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} placeholder="jan@voorbeeld.nl" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Telefoonnummer</label>
                  <input type="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} placeholder="06 12345678" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">IBAN (rekeningnummer)</label>
                  <input type="text" value={profile.iban} onChange={(e) => setProfile((p) => ({ ...p, iban: e.target.value.toUpperCase() }))} placeholder="NL00 BANK 0000 0000 00" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400" />
                </div>
                <div className="sm:col-span-2 flex items-center gap-4 pt-2">
                  <button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="rounded-full bg-emerald-500 px-6 py-2 text-xs font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60">
                    {savingProfile ? 'Bezig met opslaan...' : 'Opslaan'}
                  </button>
                  {profileMessage && (
                    <p className={`text-xs ${profileMessage.includes('mis') ? 'text-rose-600' : 'text-emerald-600'}`}>{profileMessage}</p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Overzicht tab */}
        {activeTab === 'overzicht' && (
          <>
            {/* Statistieken */}
            <section className="mb-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Actieve tickets</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{activeCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Verkocht</p>
                <p className="mt-2 text-2xl font-semibold text-emerald-600">{soldCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Gekocht</p>
                <p className="mt-2 text-2xl font-semibold text-sky-600">{boughtCount}</p>
              </div>
            </section>

            {/* Verkoper: Mijn aangeboden tickets */}
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Mijn aangeboden tickets</h2>
              {ticketsError && (
                <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{ticketsError}</div>
              )}
              {loadingSellerTickets ? (
                <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Bezig met laden...</div>
              ) : sellerTickets.length === 0 ? (
                <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Je hebt nog geen tickets aangeboden.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Event</th>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Status</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Vraagprijs</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {sellerTickets.map((ticket) => {
                        const name = ticket.eventInfo?.name || ticket.event_name || 'Ticket';
                        const date = ticket.eventInfo?.date || ticket.event_date;
                        return (
                          <tr key={ticket.id}>
                            <td className="px-3 py-2 text-xs text-slate-900">
                              {name}
                              {date && (
                                <span className="ml-1.5 text-[10px] text-slate-400">
                                  {new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <TicketStatus ticket={ticket} />
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-slate-900">
                              {ticket.ask_price != null ? `€ ${Number(ticket.ask_price).toFixed(2).replace('.', ',')}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {ticket.status === 'available' ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTicket(ticket)}
                                  disabled={deletingId === ticket.id}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  {deletingId === ticket.id ? 'Bezig...' : 'Verwijderen'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Koper: Mijn gekochte tickets */}
            <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Mijn gekochte tickets</h2>
              {loadingPurchased ? (
                <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Bezig met laden...</div>
              ) : purchasedTickets.length === 0 ? (
                <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Je hebt nog geen tickets gekocht.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Event</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Betaald</th>
                        <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Ticket</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {purchasedTickets.map((ticket) => {
                        const name = ticket.eventInfo?.name || ticket.event_name || 'Ticket';
                        const date = ticket.eventInfo?.date || ticket.event_date;
                        return (
                          <tr key={ticket.id}>
                            <td className="px-3 py-2 text-xs text-slate-900">
                              {name}
                              {date && (
                                <span className="ml-1.5 text-[10px] text-slate-400">
                                  {new Date(date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-slate-900">
                              {ticket.ask_price != null ? `€ ${Number(ticket.ask_price).toFixed(2).replace('.', ',')}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {ticket.pdf_url ? (
                                <a
                                  href={ticket.pdf_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400"
                                >
                                  Download ticket
                                </a>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Biedingen op mijn tickets (verkoper) */}
            <div className="grid gap-8 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Biedingen op mijn tickets</h2>
                {loadingBids ? (
                  <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Bezig met laden...</div>
                ) : bidsOnMyTickets.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Er zijn nog geen biedingen op je tickets.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Event</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Bod</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Status</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Acties</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {bidsOnMyTickets.map((bid) => {
                          const parent = bid.ticket_id
                            ? sellerTickets.find((t) => t.id === bid.ticket_id)
                            : bid.event_id
                              ? sellerTickets.find((t) => t.event_id === bid.event_id)
                              : null;
                          const label = parent?.eventInfo?.name || parent?.event_name || (bid.event_id ? `Event #${bid.event_id}` : `Bod #${bid.id}`);
                          return (
                            <tr key={bid.id}>
                              <td className="px-3 py-2 text-xs text-slate-900">{label}</td>
                              <td className="px-3 py-2 text-right text-xs font-medium text-sky-700">
                                € {Number(bid.bid_price).toFixed(2).replace('.', ',')}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <BidStatusPill status={bid.status} />
                              </td>
                              <td className="px-3 py-2 text-right text-xs">
                                {bid.status === 'pending' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptBid(bid)}
                                    disabled={acceptingBidId === bid.id}
                                    className="rounded-full bg-emerald-500 px-3 py-1 text-[11px] font-medium text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
                                  >
                                    {acceptingBidId === bid.id ? 'Bezig...' : 'Accepteren'}
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Mijn biedingen (koper) */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Mijn biedingen</h2>
                {loadingMyBids ? (
                  <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Bezig met laden...</div>
                ) : myBids.length === 0 ? (
                  <div className="rounded-xl border border-slate-100 px-4 py-6 text-center text-xs text-slate-500">Je hebt nog geen biedingen geplaatst.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-100">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Event</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Mijn bod</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Status</th>
                          <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Acties</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {myBids.map((bid) => (
                          <tr key={bid.id}>
                            <td className="px-3 py-2 text-xs text-slate-900">
                              {bid.eventName || `Event #${bid.event_id || '—'}`}
                              {bid.eventDate && (
                                <span className="ml-1.5 text-[10px] text-slate-400">
                                  {new Date(bid.eventDate).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right text-xs font-medium text-sky-700">
                              € {Number(bid.bid_price).toFixed(2).replace('.', ',')}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <BidStatusPill status={bid.status} />
                            </td>
                            <td className="px-3 py-2 text-right text-xs">
                              {bid.status === 'pending' ? (
                                <button
                                  type="button"
                                  onClick={() => handleCancelMyBid(bid)}
                                  disabled={deletingBidId === bid.id}
                                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-medium text-rose-700 hover:border-rose-300 hover:bg-rose-100 disabled:opacity-60"
                                >
                                  {deletingBidId === bid.id ? 'Bezig...' : 'Intrekken'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function BidStatusPill({ status }) {
  const config = {
    pending: { label: 'Open', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    accepted: { label: 'Geaccepteerd', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    cancelled: { label: 'Ingetrokken', cls: 'bg-slate-50 text-slate-400 ring-1 ring-slate-200' },
    rejected: { label: 'Afgewezen', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' },
  };
  const c = config[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${c.cls}`}>{c.label}</span>;
}

function TicketStatus({ ticket }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    if (ticket.status !== 'reserved' || !ticket.reserved_until) return;
    function update() {
      const diff = new Date(ticket.reserved_until) - Date.now();
      if (diff <= 0) { setTimeLeft('Verlopen'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(`${h}u ${m}m`);
    }
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [ticket.status, ticket.reserved_until]);

  if (ticket.status === 'reserved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-200">
        Gereserveerd
        {timeLeft && <span className="text-amber-500">({timeLeft})</span>}
      </span>
    );
  }
  if (ticket.status === 'sold') {
    return <span className="inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-200">Verkocht</span>;
  }
  if (ticket.status === 'available') {
    return <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-200">Beschikbaar</span>;
  }
  return <span className="text-slate-600">{ticket.status || '—'}</span>;
}
