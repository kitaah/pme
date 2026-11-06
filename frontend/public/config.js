// Valeurs par defaut (developpement). En cluster, ce fichier est remplace par le ConfigMap `frontend-config`.
window.__PME_CONFIG__ = {
  keycloakUrl: 'https://keycloak.localhost',
  realm: 'pme',
  clientId: 'pme-web',
};
