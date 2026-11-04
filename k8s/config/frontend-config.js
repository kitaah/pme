// Configuration du frontend injectee a l'execution (ConfigMap `frontend-config`).
window.__PME_CONFIG__ = {
  keycloakUrl: 'http://localhost:8081',
  realm: 'pme',
  clientId: 'pme-web',
};
