'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { calculateServiceFee, calculateBuyerTotal, formatPrice } from '@/lib/fees';

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [events, setEvents] = useState([]);
  const [eventSearch, setEventSearch] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const eventInputRef = useRef(null);

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventName, setNewEventName] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventVenue, setNewEventVenue] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);

  const [ticketId, setTicketId] = useState(null);
  const [askPrice, setAskPrice] = useState('');
  const [savingAskPrice, setSavingAskPrice] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          router.replace('/login');
          return;
        }
        setUser(data.user);
      } finally {
        setCheckingAuth(false);
      }
    }

    fetchUser();
  }, [router]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (eventInputRef.current && !eventInputRef.current.parentElement.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchEvents() {
      const { data, error } = await supabase
        .from('events')
        .select('id, name, date, venue')
        .order('date', { ascending: true });

      if (!error && data) {
        setEvents(data);
      }
    }
    fetchEvents();
  }, []);

  const filteredEvents = useMemo(() => {
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setEventSearch(event.name);
    setShowDropdown(false);
  };

  const handleEventInputChange = (value) => {
    setEventSearch(value);
    setSelectedEvent(null);
    setShowDropdown(true);
  };

  const handleOpenAddEvent = () => {
    setNewEventName(eventSearch.trim());
    setNewEventDate('');
    setNewEventVenue('');
    setShowDropdown(false);
    setShowAddEvent(true);
  };

  const handleAddEvent = async () => {
    if (!newEventName.trim()) {
      setErrorMessage('Vul een eventnaam in.');
      return;
    }
    if (!newEventDate) {
      setErrorMessage('Vul een datum in voor het event.');
      return;
    }

    setAddingEvent(true);
    setErrorMessage('');

    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          name: newEventName.trim(),
          date: newEventDate,
          venue: newEventVenue.trim() || null,
        })
        .select('id, name, date, venue')
        .single();

      if (error) throw error;

      setEvents((prev) => [...prev, data]);
      setSelectedEvent(data);
      setEventSearch(data.name);
      setShowAddEvent(false);
    } catch (err) {
      console.error('Add event error:', err);
      setErrorMessage('Er ging iets mis bij het toevoegen van het event.');
    } finally {
      setAddingEvent(false);
    }
  };

  const handleChooseFileClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    setSuccessMessage('');
    setErrorMessage('');
    setTicketId(null);

    if (!selectedFile) {
      setFile(null);
      setFileName('');
      return;
    }

    if (selectedFile.type !== 'application/pdf') {
      setErrorMessage('Alleen PDF-bestanden zijn toegestaan.');
      setFile(null);
      setFileName('');
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setErrorMessage('Bestand is te groot. Maximaal 10 MB.');
      setFile(null);
      setFileName('');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
  };

  const handleAnalyseTicket = async () => {
    if (!user) {
      setErrorMessage('Je moet ingelogd zijn om een ticket te uploaden.');
      return;
    }

    if (!selectedEvent) {
      setErrorMessage('Kies een event uit de lijst.');
      return;
    }

    if (!file) {
      setErrorMessage('Selecteer eerst een PDF-bestand.');
      return;
    }

    setUploading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/\s+/g, '-');
      const path = `${user.id}/${timestamp}-${safeName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('tickets')
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('tickets')
        .getPublicUrl(uploadData.path);

      const pdfUrl = publicUrlData?.publicUrl || uploadData.path;

      let eventDate = selectedEvent.date || null;
      if (eventDate && !/^\d{4}-\d{2}-\d{2}/.test(eventDate)) {
        const parsed = new Date(eventDate);
        if (!isNaN(parsed.getTime())) {
          eventDate = parsed.toISOString().split('T')[0];
        } else {
          eventDate = null;
        }
      }

      const { data: insertData, error: insertError } = await supabase
        .from('tickets')
        .insert({
          user_id: user.id,
          pdf_url: pdfUrl,
          event_id: selectedEvent.id,
          event_name: selectedEvent.name,
          event_date: eventDate,
          status: 'available',
          ask_price: null,
        })
        .select('id')
        .single();

      if (insertError) {
        throw insertError;
      }

      setTicketId(insertData.id);
      setSuccessMessage(
        'Je ticket is geüpload! Stel nu je vraagprijs in.'
      );
    } catch (error) {
      console.error('Upload error:', error?.message || error?.toString?.() || JSON.stringify(error));
      setErrorMessage(`Er ging iets mis: ${error?.message || 'Onbekende fout. Controleer of de kolommen event_name en event_date bestaan in de tickets tabel.'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAskPrice = async () => {
    console.log('handleSaveAskPrice called', {
      ticketId,
      askPrice,
    });
    if (!ticketId) {
      setErrorMessage('Upload eerst een ticket voordat je een vraagprijs opslaat.');
      return;
    }

    if (!askPrice) {
      setErrorMessage('Vul een vraagprijs in.');
      return;
    }

    const numericPrice = Number(
      String(askPrice).replace(',', '.').replace(/[^0-9.]/g, '')
    );

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMessage('Vul een geldige vraagprijs in.');
      return;
    }

    setSavingAskPrice(true);
    setErrorMessage('');

    try {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ ask_price: numericPrice })
        .eq('id', ticketId);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(
        'Je vraagprijs is opgeslagen en je ticket staat nu op de markt.'
      );
      console.log('ask_price update succeeded for ticket', {
        ticketId,
        askPrice: numericPrice,
      });
      router.push('/dashboard');
    } catch (error) {
      console.error('Update ask_price error (full):', error);
      console.error(
        'Update ask_price error details:',
        error?.message || error?.toString?.() || error
      );
      setErrorMessage('Er ging iets mis bij het opslaan van je vraagprijs.');
    } finally {
      setSavingAskPrice(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <p className="text-sm text-slate-500">Bezig met laden...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Upload je ticket
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sleep een PDF-ticket naar het vlak hieronder of kies een bestand vanaf je computer. We lezen alleen de gegevens die nodig zijn om je ticket te verifiëren.
          </p>
        </header>

        {errorMessage && (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-700">
            {successMessage}
          </div>
        )}

        {/* Event kiezen */}
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Kies je event
          </h2>
          <div className="relative">
            <label className="text-xs font-medium text-slate-700">
              Zoek een event
            </label>
            <input
              ref={eventInputRef}
              type="text"
              value={eventSearch}
              onChange={(e) => handleEventInputChange(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              placeholder="Begin met typen, bijv. Awakenings..."
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />

            {showDropdown && filteredEvents.length > 0 && (
              <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                {filteredEvents.map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => handleSelectEvent(ev)}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-medium text-slate-900">{ev.name}</p>
                      {ev.venue && (
                        <p className="text-[11px] text-slate-400">{ev.venue}</p>
                      )}
                    </div>
                    {ev.date && (
                      <span className="shrink-0 ml-3 text-[11px] text-slate-400">
                        {new Date(ev.date).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showDropdown && eventSearch.trim() && filteredEvents.length === 0 && !showAddEvent && (
              <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-center text-xs text-slate-400">
                  Geen events gevonden voor "{eventSearch}"
                </p>
                <button
                  type="button"
                  onClick={handleOpenAddEvent}
                  className="w-full rounded-full bg-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400"
                >
                  + Event toevoegen
                </button>
              </div>
            )}
          </div>

          {showAddEvent && !selectedEvent && (
            <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-4">
              <h3 className="mb-3 text-xs font-semibold text-slate-900">
                Nieuw event toevoegen
              </h3>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Naam</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder="Bijv. Awakenings Festival"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Datum</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">Locatie (optioneel)</label>
                  <input
                    type="text"
                    value={newEventVenue}
                    onChange={(e) => setNewEventVenue(e.target.value)}
                    placeholder="Bijv. Spaarnwoude"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  disabled={addingEvent}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
                >
                  {addingEvent ? 'Bezig...' : 'Event toevoegen'}
                </button>
              </div>
            </div>
          )}

          {selectedEvent && (
            <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 px-3 py-2 ring-1 ring-emerald-200">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs text-emerald-600">
                ✓
              </div>
              <div className="text-xs">
                <p className="font-medium text-slate-900">{selectedEvent.name}</p>
                <p className="text-slate-500">
                  {selectedEvent.date
                    ? new Date(selectedEvent.date).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : ''}
                  {selectedEvent.venue ? ` — ${selectedEvent.venue}` : ''}
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Drag & drop zone */}
        <section className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-100/60 px-6 py-10 text-center shadow-inner">
          <div className="mx-auto max-w-sm space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              📄
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                Sleep je PDF hierheen
              </p>
              <p className="mt-1 text-xs text-slate-500">
                of klik om een bestand te kiezen vanaf je apparaat.
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleChooseFileClick}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                Bestand kiezen
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <p className="mt-3 text-[11px] text-slate-400">
              Alleen PDF-bestanden, maximaal 10 MB.
            </p>
          </div>
        </section>

        {/* Preview sectie */}
        <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            Voorbeeld van geselecteerd ticket
          </h2>
          <p className="text-xs text-slate-500">
            {fileName
              ? 'Je hebt het volgende bestand geselecteerd:'
              : 'Nog geen bestand geselecteerd. Kies een PDF hierboven om de bestandsnaam hier te zien.'}
          </p>
          <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
            {fileName || 'bestandsnaam.pdf'}
          </div>
        </section>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleAnalyseTicket}
            disabled={uploading}
            className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
          >
            {uploading ? 'Bezig met analyseren...' : 'Ticket analyseren'}
          </button>
        </div>

        {/* Vraagprijs invullen na upload */}
        {ticketId && (
          <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Stel je vraagprijs in
            </h2>
            <p className="text-xs text-slate-500">
              Vul de prijs in waarvoor je je ticket op de markt wilt zetten.
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full max-w-xs">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-xs text-slate-400">
                  €
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={askPrice}
                  onChange={(e) => setAskPrice(e.target.value)}
                  placeholder="Bijv. 75"
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveAskPrice}
                disabled={savingAskPrice}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
              >
                {savingAskPrice
                  ? 'Bezig met opslaan...'
                  : 'Opslaan en op de markt zetten'}
              </button>
            </div>

            <BuyerPreview askPrice={askPrice} />
          </section>
        )}
      </main>
    </div>
  );
}

function BuyerPreview({ askPrice }) {
  const numericPrice = Number(
    String(askPrice || '').replace(',', '.').replace(/[^0-9.]/g, '')
  );
  const hasPrice = Number.isFinite(numericPrice) && numericPrice > 0;

  if (!hasPrice) return null;

  const fee = calculateServiceFee(numericPrice);
  const total = calculateBuyerTotal(numericPrice);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
        Preview: dit betaalt de koper
      </p>
      <div className="flex justify-between">
        <span>Ticketprijs</span>
        <span className="font-medium text-slate-900">€ {formatPrice(numericPrice)}</span>
      </div>
      <div className="flex justify-between">
        <span>Servicekosten (€ 1,00 + 1,5%)</span>
        <span className="font-medium text-slate-900">€ {formatPrice(fee)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
        <span className="font-semibold text-slate-900">Totaal voor koper</span>
        <span className="font-semibold text-emerald-700">€ {formatPrice(total)}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        Je ontvangt als verkoper het volledige bedrag van € {formatPrice(numericPrice)}. De servicekosten zijn voor de koper.
      </p>
    </div>
  );
}


