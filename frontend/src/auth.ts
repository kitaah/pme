import Keycloak from 'keycloak-js';
import { config } from './config';

export const ROLE_MEMBER = 'membre';

const keycloak = new Keycloak({ url: config.keycloakUrl, realm: config.realm, clientId: config.clientId });

let initPromise: Promise<boolean> | undefined;

const LANDING_FLAG = 'pme.landing-done';
const AFTER_LOGIN_PATH = '/mes-annonces';

/**
 * Adresse de retour de Keycloak : « Mes annonces » quand la personne arrive sur l'accueil, une seule fois par onglet.
 * Une adresse precise (lien direct, actualisation de /mes-annonces) est conservee telle quelle, et une actualisation
 * de l'accueil, plus tard dans l'onglet, ne l'en fait pas sortir. Le jeton n'etant garde qu'en memoire, chaque chargement
 * repasse par Keycloak : sans ce drapeau, l'accueil renverrait toujours vers « Mes annonces ».
 */
function loginRedirectUri(): string | undefined {
  try {
    if (window.location.pathname !== '/' || sessionStorage.getItem(LANDING_FLAG)) return undefined;
    sessionStorage.setItem(LANDING_FLAG, '1');
    return `${window.location.origin}${AFTER_LOGIN_PATH}`;
  } catch {
    return undefined; // stockage indisponible : on garde le comportement par defaut
  }
}

/** Redirige vers la page de connexion Keycloak si besoin (Authorization Code + PKCE). */
export function initAuth(): Promise<boolean> {
  // memorise la promesse : React.StrictMode execute les effets deux fois en developpement
  initPromise ??= keycloak.init({
    onLoad: 'login-required',
    pkceMethod: 'S256',
    checkLoginIframe: false,
    redirectUri: loginRedirectUri(),
  });
  return initPromise;
}

export interface CurrentUser {
  username: string;
  displayName: string;
  roles: string[];
}

export function currentUser(): CurrentUser {
  const token = keycloak.tokenParsed as
    { preferred_username?: string; given_name?: string; realm_access?: { roles?: string[] } } | undefined;
  const username = token?.preferred_username ?? 'inconnu';
  return {
    username,
    displayName: token?.given_name ?? username,
    roles: token?.realm_access?.roles ?? [],
  };
}

/** Jeton d'acces valide (renouvele s'il expire dans moins de 30 s). */
export async function accessToken(): Promise<string> {
  try {
    await keycloak.updateToken(30);
  } catch {
    await keycloak.login();
  }
  return keycloak.token ?? '';
}

export function logout(): void {
  try {
    sessionStorage.removeItem(LANDING_FLAG);
  } catch {
    /* stockage indisponible : sans effet */
  }
  void keycloak.logout({ redirectUri: window.location.origin });
}
