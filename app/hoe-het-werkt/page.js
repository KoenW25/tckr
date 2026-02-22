'use client';

import Link from 'next/link';

const faqs = [
  {
    question: 'Hoe controleert Tickr of een ticket echt is?',
    answer:
      'We analyseren de PDF op echtheidskenmerken en controleren waar mogelijk bij de officiële ticketprovider.',
  },
  {
    question: 'Wanneer wordt mijn geld uitbetaald?',
    answer:
      'Uitbetaling vindt in de meeste gevallen binnen enkele werkdagen na het event plaats, zodra het ticket is gebruikt.',
  },
  {
    question: 'Wat als een koper mijn ticket niet kan gebruiken?',
    answer:
      'We hebben een beschermingsregeling voor zowel koper als verkoper. In twijfelgevallen bekijkt ons supportteam de situatie.',
  },
  {
    question: 'Welke kosten rekent Tickr?',
    answer:
      'We rekenen een transparante servicefee per transactie. De exacte kosten zie je altijd vóórdat je een order bevestigt.',
  },
];

export default function HoeHetWerktPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Hoe Tickr werkt
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            In drie stappen van ticket naar uitbetaling. Ontworpen om eerlijk en transparant te zijn voor iedereen.
          </p>
        </header>

        {/* Drie stappen */}
        <section className="mb-12 grid gap-6 md:grid-cols-3">
          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
              1
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              Upload je ticket
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              Sleep een PDF van je ticket naar Tickr. We lezen alleen de gegevens die nodig zijn om je ticket te verifiëren.
            </p>
          </article>

          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              2
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              Stel je prijs in
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              Kies of je direct wilt verkopen of een limietorder plaatst. Je ziet realtime waar andere kopers en verkopers zitten.
            </p>
          </article>

          <article className="flex flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-100">
            <span className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              3
            </span>
            <h2 className="text-sm font-semibold text-slate-900">
              Ontvang je geld
            </h2>
            <p className="mt-2 text-xs text-slate-600">
              Zodra je ticket veilig is overgedragen en gebruikt, storten we de opbrengst op je IBAN. Eerlijk en transparant.
            </p>
          </article>
        </section>

        {/* FAQ */}
        <section className="mb-4">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">
            Veelgestelde vragen
          </h2>
          <div className="space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm shadow-slate-100"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between text-slate-900">
                  <span className="text-sm font-medium">{faq.question}</span>
                  <span className="ml-4 text-xs text-slate-400 group-open:hidden">
                    +
                  </span>
                  <span className="ml-4 hidden text-xs text-slate-400 group-open:inline">
                    –
                  </span>
                </summary>
                <p className="mt-2 text-xs text-slate-600">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

