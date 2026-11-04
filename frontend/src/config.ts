export interface RuntimeConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

declare global {
  interface Window {
    __PME_CONFIG__?: RuntimeConfig;
  }
}

/** Lue dans /config.js (charge avant l'application) : modifiable sans reconstruire l'image. */
export const config: RuntimeConfig = window.__PME_CONFIG__ ?? {
  keycloakUrl: 'http://localhost:8081',
  realm: 'pme',
  clientId: 'pme-web',
};
