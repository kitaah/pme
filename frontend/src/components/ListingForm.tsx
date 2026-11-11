import { FormEvent, useState } from 'react';
import { ApiError, CONDITION_LABELS, Condition, api } from '../api';

type Message = { kind: 'ok' | 'error'; text: string; details?: string[] };

const MESSAGE_STYLES: Record<Message['kind'], string> = {
  ok: 'border-moss bg-moss/10',
  error: 'border-blood bg-blood/10',
};

export function ListingForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<Condition>('GOOD');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await api.createListing({ title, description, condition });
      setMessage({ kind: 'ok', text: 'Annonce déposée : elle est en attente de modération.' });
      setTitle('');
      setDescription('');
      onSubmitted();
    } catch (error) {
      const apiError = error instanceof ApiError ? error : undefined;
      setMessage({
        kind: 'error',
        text: apiError?.message ?? 'Une erreur est survenue.',
        details: apiError?.errors,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="form-title">
      <h2 id="form-title" className="card-title">
        Proposer un objet à échanger
      </h2>
      <form onSubmit={submit} noValidate>
        <label className="label" htmlFor="title">
          Titre
        </label>
        <input
          id="title"
          className="field"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Figurine Pyramid Head"
        />

        <label className="label" htmlFor="description">
          Description
        </label>
        <textarea
          id="description"
          className="field resize-y"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Édition, état, ce que vous cherchez en échange…"
        />

        <label className="label" htmlFor="condition">
          État
        </label>
        <select
          id="condition"
          className="field"
          value={condition}
          onChange={(e) => setCondition(e.target.value as Condition)}
        >
          {(Object.keys(CONDITION_LABELS) as Condition[]).map((key) => (
            <option key={key} value={key}>
              {CONDITION_LABELS[key]}
            </option>
          ))}
        </select>

        <button type="submit" className="btn" disabled={busy}>
          {busy ? 'Envoi…' : "Déposer l'annonce"}
        </button>
      </form>

      <div aria-live="polite">
        {message && (
          <div
            className={`notice ${MESSAGE_STYLES[message.kind]}`}
            role={message.kind === 'error' ? 'alert' : 'status'}
          >
            {message.text}
            {message.details && message.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {message.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
