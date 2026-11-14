/**
 * Pied de page du site, conforme a la maquette : quatre colonnes de rubriques, la signature de
 * l'enseigne, puis les mentions legales obligatoires. Comme pour le menu, seuls les liens de
 * l'espace membre existent dans le POC.
 *
 * « Accessibilité : partiellement conforme » est une obligation legale du pied de page (article 47
 * de la loi de 2005) : le niveau reel sera fixe apres l'audit RGAA du site complet.
 */
const COLONNES = [
  {
    titre: 'Boutique',
    liens: ['Figurines et goodies', 'Films, DVD et Blu-ray', 'Bandes dessinées', 'Jeux de société'],
  },
  { titre: 'Le fanzine', liens: ['S’abonner', 'Lire les numéros', 'La newsletter'] },
  { titre: 'Evil Ed', liens: ['Les web séries', 'Les éditions restaurées', 'Soutenir une production'] },
  { titre: "L'entreprise", liens: ['Nos magasins', 'Le Petit Festival', 'Actualités', 'Nous contacter'] },
];

const MENTIONS = [
  'Mentions légales',
  'Conditions générales de vente',
  'Données personnelles',
  'Cookies',
  'Accessibilité : partiellement conforme',
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-panel">
      <div className="mx-auto grid max-w-[1120px] grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-8 px-[clamp(16px,4vw,40px)] pt-11 pb-9">
        {COLONNES.map((colonne) => (
          <div key={colonne.titre}>
            <h2 className="mb-3.5 font-sans text-sm font-semibold tracking-[0.08em] text-gold uppercase">
              {colonne.titre}
            </h2>
            <ul className="text-sm leading-8">
              {colonne.liens.map((lien) => (
                <li key={lien}>
                  <a href="#plateforme" className="lien-pied">
                    {lien}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1120px] px-[clamp(16px,4vw,40px)] pb-9">
        <p className="mb-2.5 text-sm font-semibold text-ink">Le lieu de rêve pour frissonner</p>
        <p className="max-w-[560px] text-[13px] leading-[1.7] text-ink-faint">
          Fanzine, boutique et festival depuis bientôt dix ans. Données hébergées en Europe.
        </p>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-[clamp(16px,4vw,40px)] pt-5 pb-7">
          <p className="text-[13px] text-ink-faint">© {new Date().getFullYear()} La Petite Maison de l'Épouvante</p>
          <nav aria-label="Liens réglementaires">
            <ul className="flex flex-wrap gap-x-[18px] gap-y-2 text-[13px]">
              {MENTIONS.map((mention) => (
                <li key={mention}>
                  <a href="#mentions" className="lien-pied">
                    {mention}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}
