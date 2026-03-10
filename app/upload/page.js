'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLanguage } from '@/lib/LanguageContext';
import { t } from '@/lib/translations';
import supabase from '@/lib/supabase';
import { calculateServiceFee, calculateBuyerTotal, formatPrice } from '@/lib/fees';

const VENUE_SUGGESTIONS = [
  'Lofi',
  'Ziggo Dome',
  'AFAS Live',
  'Paradiso',
  'Melkweg',
  'TivoliVredenburg',
  '013 Poppodium',
  'Doornroosje',
  'Maassilo',
  'Rotterdam Ahoy',
  'Johan Cruijff ArenA',
  'GelreDome',
  'Gashouder',
  'Brabanthallen',
  'Poppodium 013',
];

const COUNTRY_OPTIONS = [
  { code: 'NL', label: 'Nederland' },
  { code: 'BE', label: 'Belgie' },
  { code: 'DE', label: 'Duitsland' },
  { code: 'DK', label: 'Denemarken' },
  { code: 'ES', label: 'Spanje' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'Frankrijk' },
  { code: 'GB', label: 'Verenigd Koninkrijk' },
  { code: 'IE', label: 'Ierland' },
  { code: 'IT', label: 'Italie' },
  { code: 'NO', label: 'Noorwegen' },
  { code: 'PT', label: 'Portugal' },
  { code: 'SE', label: 'Zweden' },
  { code: 'CH', label: 'Zwitserland' },
  { code: 'AT', label: 'Oostenrijk' },
  { code: 'PL', label: 'Polen' },
  { code: 'CZ', label: 'Tsjechie' },
  { code: 'HU', label: 'Hongarije' },
  { code: 'RO', label: 'Roemenie' },
  { code: 'BG', label: 'Bulgarije' },
  { code: 'HR', label: 'Kroatie' },
  { code: 'SI', label: 'Slovenie' },
  { code: 'SK', label: 'Slowakije' },
  { code: 'EE', label: 'Estland' },
  { code: 'LV', label: 'Letland' },
  { code: 'LT', label: 'Litouwen' },
  { code: 'GR', label: 'Griekenland' },
  { code: 'LU', label: 'Luxemburg' },
  { code: 'US', label: 'Verenigde Staten' },
  { code: 'CA', label: 'Canada' },
  { code: 'AU', label: 'Australie' },
  { code: 'NZ', label: 'Nieuw-Zeeland' },
  { code: 'BR', label: 'Brazilie' },
  { code: 'AR', label: 'Argentinie' },
  { code: 'MX', label: 'Mexico' },
  { code: 'ZA', label: 'Zuid-Afrika' },
  { code: 'AE', label: 'Verenigde Arabische Emiraten' },
  { code: 'IN', label: 'India' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'Zuid-Korea' },
  { code: 'SG', label: 'Singapore' },
].sort((a, b) => {
  if (a.code === 'NL') return -1;
  if (b.code === 'NL') return 1;
  return a.label.localeCompare(b.label, 'nl');
});

export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
          <p className="text-sm text-slate-500">Bezig met laden...</p>
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}

function UploadPageContent() {
  const isValidHalfEuroStep = (amount) => {
    const cents = Math.round(Number(amount) * 100);
    return Number.isFinite(cents) && cents % 50 === 0;
  };

  const { lang } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [newEventCity, setNewEventCity] = useState('');
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventCountry, setNewEventCountry] = useState('');
  const [addingEvent, setAddingEvent] = useState(false);

  const [ticketIds, setTicketIds] = useState([]);
  const [detectedTickets, setDetectedTickets] = useState([]);
  const [verificationState, setVerificationState] = useState(null);
  const [askPrice, setAskPrice] = useState('');
  const [saleType, setSaleType] = useState('public');
  const [privateBuyerEmail, setPrivateBuyerEmail] = useState('');
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
        .select('id, name, date, venue, venue_name, city, country_code')
        .order('date', { ascending: true });

      if (!error && data) {
        setEvents(data);
      }
    }
    fetchEvents();
  }, []);

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (!eventId || !events.length || selectedEvent) return;

    const preselected = events.find((ev) => String(ev.id) === String(eventId));
    if (preselected) {
      setSelectedEvent(preselected);
      setEventSearch(preselected.name);
      setShowDropdown(false);
    }
  }, [searchParams, events, selectedEvent]);

  useEffect(() => {
    const shouldOpenAddEvent = searchParams.get('openAddEvent') === 'true';
    const createEventName = searchParams.get('createEvent')?.trim() || '';
    if (!shouldOpenAddEvent || !createEventName || selectedEvent || showAddEvent) return;

    setEventSearch(createEventName);
    setNewEventName(createEventName);
    setShowDropdown(false);
    setShowAddEvent(true);
  }, [searchParams, selectedEvent, showAddEvent]);

  const filteredEvents = useMemo(() => {
    if (!eventSearch.trim()) return events;
    const q = eventSearch.toLowerCase();
    return events.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q) ||
        e.venue_name?.toLowerCase().includes(q) ||
        e.city?.toLowerCase().includes(q) ||
        e.country_code?.toLowerCase().includes(q)
    );
  }, [events, eventSearch]);

  const handleSelectEvent = (event) => {
    setSelectedEvent(event);
    setEventSearch(event.name);
    setShowDropdown(false);
    setTicketIds([]);
    setDetectedTickets([]);
    setVerificationState(null);
    setSaleType('public');
    setPrivateBuyerEmail('');
  };

  const handleEventInputChange = (value) => {
    setEventSearch(value);
    setSelectedEvent(null);
    setShowDropdown(true);
    setTicketIds([]);
    setDetectedTickets([]);
    setVerificationState(null);
    setSaleType('public');
    setPrivateBuyerEmail('');
  };

  const handleOpenAddEvent = () => {
    setNewEventName(eventSearch.trim());
    setNewEventDate('');
    setNewEventCity('');
    setNewEventLocation('');
    setNewEventCountry('');
    setShowDropdown(false);
    setShowAddEvent(true);
  };

  const handleAddEvent = async () => {
    if (!newEventName.trim()) {
      setErrorMessage(t('upload.errName', lang));
      return;
    }
    if (!newEventDate) {
      setErrorMessage(t('upload.errDate', lang));
      return;
    }

    setAddingEvent(true);
    setErrorMessage('');

    try {
      const venueParts = [newEventCity.trim(), newEventLocation.trim()].filter(Boolean);
      const composedVenue = venueParts.length > 0 ? venueParts.join(' - ') : null;
      const countryCode = newEventCountry.trim().toUpperCase() || null;

      const { data, error } = await supabase
        .from('events')
        .insert({
          name: newEventName.trim(),
          date: newEventDate,
          city: newEventCity.trim() || null,
          venue_name: newEventLocation.trim() || null,
          country_code: countryCode,
          venue: composedVenue,
        })
        .select('id, name, date, venue, venue_name, city, country_code')
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

  const verifyTicketFile = async (ticketFile) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Je sessie is verlopen. Log opnieuw in en probeer het opnieuw.');
    }

    const formData = new FormData();
    formData.append('file', ticketFile);

    const verifyRes = await fetch('/api/tickets/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      body: formData,
    });

    const verifyJson = await verifyRes.json().catch(() => ({}));

    if (!verifyRes.ok) {
      throw new Error(verifyJson?.error || 'Ticket verificatie is mislukt.');
    }

    return verifyJson;
  };

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];
    setSuccessMessage('');
    setErrorMessage('');
    setTicketIds([]);
    setDetectedTickets([]);
    setVerificationState(null);
    setSaleType('public');
    setPrivateBuyerEmail('');

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

  const toggleDetectedTicket = (barcodeData) => {
    setDetectedTickets((prev) =>
      prev.map((ticket) =>
        ticket.barcodeData === barcodeData
          ? { ...ticket, selected: !ticket.selected }
          : ticket
      )
    );
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
    setTicketIds([]);
    setDetectedTickets([]);
    setVerificationState(null);
    setSaleType('public');
    setPrivateBuyerEmail('');

    try {
      const verification = await verifyTicketFile(file);
      const verifiedStatus = verification?.verified || 'pending';
      const barcodeData = verification?.barcodeData || null;
      const verificationWarning = verification?.warning || '';
      const detectedTickets = Array.isArray(verification?.tickets) ? verification.tickets : [];
      const normalizedDetectedTickets = detectedTickets.map((ticket) => ({
        page: ticket.page,
        barcodeData: ticket.barcodeData,
        status: ticket.status,
        selected: ticket.status === 'verified',
      }));
      setDetectedTickets(normalizedDetectedTickets);
      setVerificationState({ verifiedStatus, barcodeData, verificationWarning });

      if (normalizedDetectedTickets.length > 0) {
        const uploadableCount = normalizedDetectedTickets.filter(
          (ticket) => ticket.status === 'verified'
        ).length;
        if (uploadableCount > 0) {
          setSuccessMessage(
            `Analyse voltooid: ${uploadableCount} ticket${uploadableCount !== 1 ? 's' : ''} klaar om te uploaden.`
          );
        } else {
          setErrorMessage('Alle gevonden tickets bestaan al op Tckr.');
        }
      } else {
        setSuccessMessage(
          verificationWarning ||
            'Analyse voltooid. We hebben geen barcode gevonden, je kunt het ticket als pending uploaden.'
        );
      }
    } catch (error) {
      console.error('Upload error:', error?.message || error?.toString?.() || JSON.stringify(error));
      setErrorMessage(`Er ging iets mis: ${error?.message || 'Onbekende fout. Controleer of de kolommen event_name en event_date bestaan in de tickets tabel.'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSelectedTickets = async () => {
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
    if (!verificationState) {
      setErrorMessage('Analyseer eerst je ticketbestand.');
      return;
    }

    const selectedVerifiedTickets = detectedTickets.filter(
      (ticket) => ticket.status === 'verified' && ticket.selected
    );
    const hasDetectedTicketCandidates = detectedTickets.some(
      (ticket) => ticket.status === 'verified'
    );
    if (hasDetectedTicketCandidates && selectedVerifiedTickets.length === 0) {
      setErrorMessage('Selecteer minimaal 1 ticket om te uploaden.');
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

      const ticketRowsToInsert =
        selectedVerifiedTickets.length > 0
          ? selectedVerifiedTickets.map((ticket) => ({
              user_id: user.id,
              pdf_url: pdfUrl,
              event_id: selectedEvent.id,
              event_name: selectedEvent.name,
              event_date: eventDate,
              status: 'available',
              ask_price: null,
              barcode_data: ticket.barcodeData,
              verified: 'verified',
            }))
          : [
              {
                user_id: user.id,
                pdf_url: pdfUrl,
                event_id: selectedEvent.id,
                event_name: selectedEvent.name,
                event_date: eventDate,
                status: 'available',
                ask_price: null,
                barcode_data:
                  verificationState.verifiedStatus === 'verified'
                    ? verificationState.barcodeData
                    : null,
                verified: verificationState.verifiedStatus,
              },
            ];

      const { data: insertData, error: insertError } = await supabase
        .from('tickets')
        .insert(ticketRowsToInsert)
        .select('id');

      if (insertError) {
        throw insertError;
      }

      const insertedTicketIds = (insertData ?? []).map((row) => row.id).filter(Boolean);
      setTicketIds(insertedTicketIds);
      setSaleType('public');
      setPrivateBuyerEmail('');
      setSuccessMessage(
        verificationState.verificationWarning
          ? `Je tickets zijn geüpload! ${verificationState.verificationWarning}`
          : `Je ${insertedTicketIds.length > 1 ? `${insertedTicketIds.length} tickets zijn` : 'ticket is'} geüpload. Stel nu je vraagprijs in.`
      );
    } catch (error) {
      console.error('Upload error:', error?.message || error?.toString?.() || JSON.stringify(error));
      setErrorMessage(
        `Er ging iets mis: ${error?.message || 'Onbekende fout. Controleer of de kolommen event_name en event_date bestaan in de tickets tabel.'}`
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSaveAskPrice = async () => {
    console.log('handleSaveAskPrice called', {
      ticketIds,
      askPrice,
    });
    if (!ticketIds.length) {
      setErrorMessage(t('upload.errNoTicket', lang));
      return;
    }

    if (!askPrice) {
      setErrorMessage(t('upload.errNoPrice', lang));
      return;
    }

    if (saleType === 'private') {
      const normalizedEmail = String(privateBuyerEmail || '').trim().toLowerCase();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
      if (!emailOk) {
        setErrorMessage('Vul een geldig e-mailadres van de koper in.');
        return;
      }
    }

    const numericPrice = Number(
      String(askPrice).replace(',', '.').replace(/[^0-9.]/g, '')
    );

    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      setErrorMessage(t('upload.errInvalidPrice', lang));
      return;
    }
    if (!isValidHalfEuroStep(numericPrice)) {
      setErrorMessage(t('upload.errInvalidStep', lang));
      return;
    }

    setSavingAskPrice(true);
    setErrorMessage('');

    try {
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          ask_price: numericPrice,
          is_private: saleType === 'private',
          private_buyer_email:
            saleType === 'private'
              ? String(privateBuyerEmail || '').trim().toLowerCase()
              : null,
        })
        .in('id', ticketIds);

      if (updateError) {
        throw updateError;
      }

      setSuccessMessage(t('upload.savedToListed', lang));
      console.log('ask_price update succeeded for ticket', {
        ticketIds,
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
                      {(ev.city || ev.venue_name || ev.venue || ev.country_code) && (
                        <p className="text-[11px] text-slate-400">
                          {[ev.city, ev.venue_name || ev.venue, ev.country_code].filter(Boolean).join(' - ')}
                        </p>
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
                {t('upload.addEventTitle', lang)}
              </h3>
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('upload.name', lang)}</label>
                  <input
                    type="text"
                    value={newEventName}
                    onChange={(e) => setNewEventName(e.target.value)}
                    placeholder={t('upload.namePlaceholder', lang)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('upload.date', lang)}</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('upload.cityOptional', lang)}</label>
                  <input
                    type="text"
                    value={newEventCity}
                    onChange={(e) => setNewEventCity(e.target.value)}
                    placeholder={t('upload.cityPlaceholder', lang)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('upload.locationOptional', lang)}</label>
                  <input
                    type="text"
                    list="venue-suggestions"
                    value={newEventLocation}
                    onChange={(e) => setNewEventLocation(e.target.value)}
                    placeholder="Bijv. Lofi"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  />
                  <datalist id="venue-suggestions">
                    {VENUE_SUGGESTIONS.map((venue) => (
                      <option key={venue} value={venue} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-700">{t('upload.countryOptional', lang)}</label>
                  <select
                    value={newEventCountry}
                    onChange={(e) => setNewEventCountry(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                  >
                    <option value="">{t('upload.countryPlaceholder', lang)}</option>
                    {COUNTRY_OPTIONS.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('upload.cancel', lang)}
                </button>
                <button
                  type="button"
                  onClick={handleAddEvent}
                  disabled={addingEvent}
                  className="rounded-full bg-sky-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm shadow-sky-500/30 hover:bg-sky-400 disabled:opacity-60"
                >
                  {addingEvent ? t('upload.saving', lang) : t('upload.addEventBtn', lang)}
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
                  {([selectedEvent.city, selectedEvent.venue_name || selectedEvent.venue, selectedEvent.country_code]
                    .filter(Boolean)
                    .join(' - '))
                    ? ` — ${[selectedEvent.city, selectedEvent.venue_name || selectedEvent.venue, selectedEvent.country_code]
                        .filter(Boolean)
                        .join(' - ')}`
                    : ''}
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
                {t('upload.dropzone', lang)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t('upload.dropzoneSub', lang)}
              </p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleChooseFileClick}
                className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
              >
                {t('upload.chooseFile', lang)}
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
              {t('upload.fileLimit', lang)}
            </p>
          </div>
        </section>

        {/* Preview sectie */}
        <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
          <h2 className="text-sm font-semibold text-slate-900">
            {t('upload.preview', lang)}
          </h2>
          <p className="text-xs text-slate-500">
            {fileName ? t('upload.previewSub', lang) : t('upload.noFile', lang)}
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
            {uploading ? t('upload.analyzing', lang) : t('upload.analyzeBtn', lang)}
          </button>
        </div>

        {verificationState && (
          <section className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              Gevonden tickets
            </h2>
            {detectedTickets.length === 0 ? (
              <p className="text-xs text-slate-500">
                Geen barcode gevonden. Je kunt dit PDF-ticket als pending uploaden.
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500">
                  Selecteer welke tickets je online wilt zetten.
                </p>
                <div className="space-y-2">
                  {detectedTickets.map((ticket) => {
                    const isDuplicate = ticket.status === 'duplicate';
                    return (
                      <label
                        key={ticket.barcodeData}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${
                          isDuplicate
                            ? 'border-slate-200 bg-slate-50 text-slate-400'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={Boolean(ticket.selected)}
                            onChange={() => toggleDetectedTicket(ticket.barcodeData)}
                            disabled={isDuplicate}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <div>
                            <p className="font-medium text-slate-900">Pagina {ticket.page}</p>
                            <p className="text-[11px] text-slate-500">
                              {ticket.barcodeData}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isDuplicate
                              ? 'bg-slate-200 text-slate-500'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {isDuplicate ? 'Al geüpload' : 'Klaar voor upload'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleUploadSelectedTickets}
                disabled={uploading}
                className="rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
              >
                {uploading ? 'Bezig met uploaden...' : 'Upload geselecteerde tickets'}
              </button>
            </div>
          </section>
        )}

        {/* Vraagprijs invullen na upload */}
        {ticketIds.length > 0 && (
          <section className="mt-8 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">
              {t('upload.setPrice', lang)}
            </h2>
            <p className="text-xs text-slate-500">
              {ticketIds.length > 1
                ? `Je stelt deze vraagprijs in voor ${ticketIds.length} tickets tegelijk.`
                : t('upload.setPriceSub', lang)}
            </p>
            <p className="text-[11px] text-slate-400">
              {t('upload.tickSizeHint', lang)}
            </p>
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium text-slate-700">Verkooptype</p>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="saleType"
                  checked={saleType === 'public'}
                  onChange={() => setSaleType('public')}
                  className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Openbaar op de markt
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="radio"
                  name="saleType"
                  checked={saleType === 'private'}
                  onChange={() => setSaleType('private')}
                  className="h-4 w-4 border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                Prive verkoop aan specifiek persoon
              </label>
            </div>

            {saleType === 'private' ? (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">E-mailadres koper</label>
                <input
                  type="email"
                  value={privateBuyerEmail}
                  onChange={(e) => setPrivateBuyerEmail(e.target.value)}
                  placeholder="koper@email.nl"
                  className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
            ) : null}

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
                  placeholder={
                    saleType === 'private'
                      ? 'Afgesproken prijs'
                      : t('upload.pricePlaceholder', lang)
                  }
                  className="w-full rounded-full border border-slate-200 bg-white py-2 pl-7 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-sky-400 focus:outline-none focus:ring-1 focus:ring-sky-400"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveAskPrice}
                disabled={savingAskPrice}
                className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-60"
              >
                {savingAskPrice ? t('upload.savingPrice', lang) : t('upload.saveBtn', lang)}
              </button>
            </div>

            <BuyerPreview askPrice={askPrice} lang={lang} />
          </section>
        )}
      </main>
    </div>
  );
}

function BuyerPreview({ askPrice, lang }) {
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
        {t('upload.buyerPreview', lang)}
      </p>
      <div className="flex justify-between">
        <span>{t('upload.ticketPrice', lang)}</span>
        <span className="font-medium text-slate-900">€ {formatPrice(numericPrice)}</span>
      </div>
      <div className="flex justify-between">
        <span>{t('upload.serviceFees', lang)}</span>
        <span className="font-medium text-slate-900">€ {formatPrice(fee)}</span>
      </div>
      <div className="mt-2 flex justify-between border-t border-slate-200 pt-2">
        <span className="font-semibold text-slate-900">{t('upload.totalBuyer', lang)}</span>
        <span className="font-semibold text-emerald-700">€ {formatPrice(total)}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">
        {t('upload.sellerReceives', lang)} € {formatPrice(numericPrice)}{t('upload.sellerReceivesSuffix', lang)}
      </p>
    </div>
  );
}


