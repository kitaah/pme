// Configuration du frontend injectee a l'execution (ConfigMap `frontend-config`).
window.__PME_CONFIG__ = {
  keycloakUrl: 'https://keycloak.localhost',
  realm: 'pme',
  clientId: 'pme-web',
};
