import { CircleCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import { TOAST_DURATION_MS } from './ui/sonner';

/**
 * Notification de confirmation du depot, conforme a la maquette : bordure verte, icone de
 * validation, message, explication, bouton de fermeture et barre de temps restant.
 *
 * La notification n'est jamais la seule trace du depot : l'annonce apparait dans « Mes annonces »
 * avec son statut. Elle dure 8 secondes, se met en pause au survol et au focus, et se ferme au
 * bouton (WCAG 2.2.1).
 */
function ConfirmationToast({ id }: Readonly<{ id: string | number }>) {
  return (
    <div className="w-[380px] max-w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-success bg-panel">
      <div className="flex items-start gap-[13px] px-4 pt-4 pb-[15px]">
        <CircleCheck aria-hidden="true" className="mt-px size-[22px] flex-none text-success" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <p className="mb-[3px] text-[15px] font-semibold text-ink">Annonce soumise pour validation !</p>
          <p className="text-[13px] leading-[1.6] text-ink-muted">Un modérateur la relit avant publication.</p>
        </div>
        <button
          type="button"
          className="inline-flex size-7 flex-none cursor-pointer items-center justify-center rounded-md text-ink-muted"
          aria-label="Fermer la notification"
          onClick={() => toast.dismiss(id)}
        >
          <X aria-hidden="true" className="size-4" strokeWidth={2} />
        </button>
      </div>
      <div className="h-[3px] bg-inset">
        <div className="toast-progress h-[3px] bg-gold" />
      </div>
    </div>
  );
}

/** Affiche la confirmation de depot. */
export function notifyListingSubmitted() {
  toast.custom((id) => <ConfirmationToast id={id} />, { duration: TOAST_DURATION_MS });
}
