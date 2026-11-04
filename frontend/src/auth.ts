import Keycloak from 'keycloak-js';
import { config } from './config';

export const ROLE_MEMBER = 'membre';

const keycloak = new Keycloak({ url: config.keycloakUrl, realm: config.realm, clientId: config.clientId });

let initPromise: Promise<boolean> | undefined;

/** Redirige vers la page de connexion Keycloak si besoin (Authorization Code + PKCE). */
export function initAuth(): Promise<boolean> {
  // memorise la promesse : React.StrictMode execute les effets deux fois en developpement
  initPromise ??= keycloak.init({ onLoad: 'login-required', pkceMethod: 'S256', checkLoginIframe: false });
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
  void keycloak.logout({ redirectUri: window.location.origin });
}
