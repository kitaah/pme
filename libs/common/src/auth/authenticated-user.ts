/** Utilisateur authentifie, deduit du jeton JWT emis par Keycloak. */
export interface AuthenticatedUser {
  /** Claim `sub` : identifiant Keycloak (UUID), seul identifiant stocke cote metier. */
  id: string;
  /** Claim `preferred_username`, affiche dans les annonces. */
  username: string;
  /** Roles de realm (`realm_access.roles`). */
  roles: string[];
}

export const ROLE_MEMBER = 'membre';
export const ROLE_MODERATOR = 'moderateur';
