import { afterEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  afterEach(() => {
    delete window.__PME_CONFIG__;
    vi.resetModules();
  });

  it("utilise la configuration de developpement quand /config.js n'a rien defini", async () => {
    const { config } = await import('./config');

    expect(config).toEqual({ keycloakUrl: 'https://keycloak.localhost', realm: 'pme', clientId: 'pme-web' });
  });

  it('utilise la configuration injectee au chargement de la page', async () => {
    window.__PME_CONFIG__ = { keycloakUrl: 'https://sso.exemple.fr', realm: 'prod', clientId: 'pme-prod' };

    const { config } = await import('./config');

    expect(config).toEqual({ keycloakUrl: 'https://sso.exemple.fr', realm: 'prod', clientId: 'pme-prod' });
  });
});
