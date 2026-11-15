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

  describe("adresse de retour apres la connexion", () => {
    // initAuth memorise sa promesse au niveau du module : chaque cas recharge le module pour repartir de zero.
    async function initAt(path: string) {
      sessionStorage.clear();
      return initFrom(path);
    }
    async function initFrom(path: string) {
      window.history.pushState({}, '', path);
      vi.resetModules();
      const fresh = await import('./auth');
      keycloak.init.mockClear();
      await fresh.initAuth();
      return keycloak.init.mock.calls[0][0] as { redirectUri?: string };
    }

    it("renvoie vers « Mes annonces » quand la personne arrive sur l'accueil", async () => {
      const options = await initAt('/');

      expect(options.redirectUri).toBe(`${window.location.origin}/mes-annonces`);
    });

    it("ne renvoie plus vers « Mes annonces » quand l'accueil est actualise dans le meme onglet", async () => {
      await initAt('/');
      const options = await initFrom('/');

      expect(options.redirectUri).toBeUndefined();
    });

    it('garde une adresse precise (lien direct, actualisation) telle quelle', async () => {
      const options = await initAt('/mes-annonces');

      expect(options.redirectUri).toBeUndefined();
    });

    it("garde le comportement par defaut quand le stockage de l'onglet est indisponible", async () => {
      const broken = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('stockage refuse');
      });
      const options = await initAt('/');
      broken.mockRestore();

      expect(options.redirectUri).toBeUndefined();
    });

    it("se deconnecte meme quand le stockage de l'onglet est indisponible", () => {
      const broken = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('stockage refuse');
      });
      logout();
      broken.mockRestore();

      expect(keycloak.logout).toHaveBeenCalled();
    });

    it("renvoie de nouveau vers « Mes annonces » a la connexion suivante, apres une deconnexion", async () => {
      await initAt('/');
      logout();
      const options = await initFrom('/');

      expect(options.redirectUri).toBe(`${window.location.origin}/mes-annonces`);
    });
  });
});
