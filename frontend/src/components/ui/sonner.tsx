import { Toaster as Sonner } from 'sonner';
// La feuille de la bibliotheque est importee ici, donc compilee avec celle du site. Sans cela, sonner
// l'injecte au demarrage dans une balise <style> que la politique de securite du contenu refuse
// (style-src 'self', voir frontend/nginx.conf) : les notifications existeraient mais sans mise en
// forme, au bas de la page, donc invisibles.
import 'sonner/dist/styles.css';

/**
 * Zone des messages de confirmation (modele shadcn/ui, bibliotheque sonner).
 *
 * Reglages tenus par l'accessibilite (RGAA 4) :
 *   - position en haut a droite, decalee sous l'en-tete : le message ne recouvre jamais le titre
 *     de la page sur laquelle le membre arrive ;
 *   - 8 secondes, le temps de lire le message puis de voir la page des annonces apparaitre. La
 *     duree reste limitee, donc un bouton de fermeture est obligatoire (WCAG 2.2.1), et sonner
 *     suspend le compte a rebours au survol comme au focus clavier ;
 *   - l'information n'est jamais PORTEE par le message : l'annonce deposee apparait dans la liste
 *     avec son statut. Un message manque ne fait donc rien perdre ;
 *   - sonner rend la zone avec role="status" et aria-live : un lecteur d'ecran l'annonce sans
 *     interrompre la lecture en cours.
 *
 * Le contenu de la notification est dessine par components/ConfirmationToast.tsx.
 */
export const TOAST_DURATION_MS = 8000;

export function Toaster() {
  return <Sonner position="top-right" offset={24} duration={TOAST_DURATION_MS} />;
}
