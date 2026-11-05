// Configuration du frontend injectee a l'execution (ConfigMap `frontend-config`).
window.__PME_CONFIG__ = {
  keycloakUrl: 'http://keycloak.localhost',
  realm: 'pme',
  clientId: 'pme-web',
};
