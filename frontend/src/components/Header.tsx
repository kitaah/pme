import { LogOut, Search, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { CurrentUser, ROLE_MEMBER, logout } from '../auth';

/**
 * En-tete du site, conforme a la maquette : bandeau (logo, recherche, compte) puis bandeau du menu.
 * Il reprend les conventions d'un site marchand et les activites de l'entreprise : boutique,
 * fanzine, collectif Evil Ed, festival, actualites et espace membre. Seul l'espace membre est
 * realise dans le POC : les autres rubriques situent le parcours dans la plateforme complete, leurs
 * liens ne menent nulle part. Le panier est de meme une facade : sa pastille est fixe.
 *
 * Le nom et le role sont lus dans le jeton Keycloak : c'est la preuve visible de l'etape
 * "connexion". Les roles techniques de Keycloak (offline_access, uma_authorization...) et le role
 * moderateur, qui releve du back-office, ne sont pas affiches ici.
 */

/** Rubriques du menu. Seul l'espace membre a une route : les autres sont des liens de facade. */
const RUBRIQUES = ['Boutique', 'Fanzine', 'Evil Ed', 'Festival', 'Actualités'];

/** Articles du panier de facade : le panier n'existe pas dans le POC. */
const ARTICLES_PANIER = 2;

export function Header({ user }: Readonly<{ user: CurrentUser }>) {
  const isMember = user.roles.includes(ROLE_MEMBER);
  return (
    <header>
      <div className="flex flex-wrap items-center gap-5 bg-panel px-[clamp(16px,4vw,40px)] py-4">
        <a href="/" className="flex items-center gap-3 no-underline">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="flex-none text-gold"
            aria-hidden="true"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V21h14V9.5" />
            <path d="M10 21v-6h4v6" />
          </svg>
          <span className="font-display text-xl leading-tight font-bold text-ink">La Petite Maison de l'Épouvante</span>
        </a>

        {/* Recherche de produit : conventionnelle sur un site marchand, hors perimetre du POC.
            Le libelle est visible pour les lecteurs d'ecran, le champ se suffit visuellement. */}
        <form
          className="flex max-w-[420px] min-w-0 flex-[999_1_240px]"
          onSubmit={(event) => event.preventDefault()}
          role="search"
          aria-label="Recherche dans la boutique"
        >
          <label className="sr-only" htmlFor="recherche">
            Rechercher un produit
          </label>
          <input
            id="recherche"
            type="search"
            className="h-11 min-w-0 flex-1 rounded-l-[10px] border border-r-0 border-control bg-inset px-3.5 text-[15px] text-ink placeholder:text-ink-faint"
            placeholder="Figurine, Blu-ray, jeu…"
          />
          <button
            type="submit"
            className="inline-flex h-11 w-[50px] flex-none cursor-pointer items-center justify-center rounded-r-[10px] border border-gold bg-gold text-on-gold"
            aria-label="Lancer la recherche"
            title="Lancer la recherche"
          >
            <Search aria-hidden="true" className="size-[19px]" strokeWidth={2} />
          </button>
        </form>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[15px] font-semibold text-ink">{user.username}</span>
          {isMember && <span className="pill border-success text-success">Membre</span>}
          <a
            href="#panier"
            className="btn-icon relative text-ink-muted no-underline"
            aria-label={`Mon panier, ${ARTICLES_PANIER} articles`}
            title="Mon panier"
          >
            <ShoppingCart aria-hidden="true" className="size-5" strokeWidth={1.6} />
            <span
              aria-hidden="true"
              className="absolute -top-1.5 -right-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blood px-1.5 text-[11px] font-semibold text-white"
            >
              {ARTICLES_PANIER}
            </span>
          </a>
          <button
            type="button"
            className="btn-icon cursor-pointer"
            onClick={logout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
          >
            <LogOut aria-hidden="true" className="size-5" strokeWidth={1.6} />
          </button>
        </div>
      </div>

      <nav aria-label="Navigation principale" className="border-y border-line bg-panel px-[clamp(16px,4vw,40px)]">
        <ul className="flex flex-wrap gap-7">
          {RUBRIQUES.map((rubrique) => (
            <li key={rubrique}>
              <a href={`#${rubrique.toLowerCase().replace(' ', '-')}`} className="lien-nav">
                {rubrique}
              </a>
            </li>
          ))}
          <li>
            {/* Les deux pages du POC (depot, liste des annonces) font partie de l'espace membre : la
                rubrique est donc toujours la rubrique courante, et pas seulement sur « / » (un
                NavLink vers « / » ne serait pas actif sur « /mes-annonces »). Elle porte
                aria-current="page" : l'information n'est pas portee par la seule couleur, le gras et
                le trait sous le lien l'accompagnent. */}
            <Link to="/" className="lien-nav lien-nav-actif" aria-current="page">
              Espace membre
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
