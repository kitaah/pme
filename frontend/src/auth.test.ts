import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accessToken, currentUser, initAuth, logout, ROLE_MEMBER } from './auth';

const keycloak = vi.hoisted(() => ({
  init: vi.fn(),
  updateToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  token: undefined as string | undefined,
  tokenParsed: undefined as unknown,
}));

vi.mock('keycloak-js', () => ({
  default: vi.fn(function () {
    return keycloak;
  }),
}));

describe('auth', () => {
  beforeEach(() => {
    keycloak.init.mockReset().mockResolvedValue(true);
    keycloak.updateToken.mockReset().mockResolvedValue(true);
    keycloak.login.mockReset().mockResolvedValue(undefined);
    keycloak.logout.mockReset().mockResolvedValue(undefined);
    keycloak.token = 'jeton-valide';
    keycloak.tokenParsed = undefined;
  });

  it('expose le role metier des membres', () => {
    expect(ROLE_MEMBER).toBe('membre');
  });

  it("n'initialise Keycloak qu'une seule fois (React.StrictMode rejoue les effets)", async () => {
    const first = initAuth();
    const second = initAuth();

    expect(second).toBe(first);
    await expect(first).resolves.toBe(true);
    expect(keycloak.init).toHaveBeenCalledTimes(1);
    expect(keycloak.init).toHaveBeenCalledWith(
      expect.objectContaining({ onLoad: 'login-required', pkceMethod: 'S256' }),
    );
  });

  it("deduit l'utilisateur courant du jeton", () => {
    keycloak.tokenParsed = {
      preferred_username: 'membre',
      given_name: 'Morgane',
      realm_access: { roles: ['membre'] },
    };

    expect(currentUser()).toEqual({ username: 'membre', displayName: 'Morgane', roles: ['membre'] });
  });

  it("utilise l'identifiant comme nom affiche quand le prenom est absent", () => {
    keycloak.tokenParsed = { preferred_username: 'membre' };

    expect(currentUser()).toEqual({ username: 'membre', displayName: 'membre', roles: [] });
  });

  it('renvoie un utilisateur « inconnu » quand il n y a pas de jeton', () => {
    expect(currentUser()).toEqual({ username: 'inconnu', displayName: 'inconnu', roles: [] });
  });

  it("renvoie le jeton d'acces apres l'avoir renouvele s'il expire dans moins de 30 s", async () => {
    await expect(accessToken()).resolves.toBe('jeton-valide');

    expect(keycloak.updateToken).toHaveBeenCalledWith(30);
    expect(keycloak.login).not.toHaveBeenCalled();
  });

  it('renvoie le formulaire de connexion quand le renouvellement echoue', async () => {
    keycloak.updateToken.mockRejectedValue(new Error('session expiree'));

    await expect(accessToken()).resolves.toBe('jeton-valide');

    expect(keycloak.login).toHaveBeenCalledTimes(1);
  });

  it("renvoie une chaine vide quand Keycloak n'a pas de jeton", async () => {
    keycloak.token = undefined;

    await expect(accessToken()).resolves.toBe('');
  });

  it("deconnecte l'utilisateur et le ramene sur l'application", () => {
    logout();

    expect(keycloak.logout).toHaveBeenCalledWith({ redirectUri: window.location.origin });
  });
});
