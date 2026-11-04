import { CurrentUser, ROLE_MEMBER, logout } from '../auth';

/**
 * Affiche le nom et le role lus dans le jeton Keycloak : c'est la preuve visible de l'etape
 * "connexion". Le POC ne presente que l'espace membre ; les roles techniques de Keycloak
 * (offline_access, uma_authorization...) et le role moderateur, qui releve du back-office,
 * ne sont pas affiches ici.
 */
export function Header({ user }: Readonly<{ user: CurrentUser }>) {
  const isMember = user.roles.includes(ROLE_MEMBER);
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-blood bg-panel px-6 py-4">
      <h1 className="text-xl">
        La Petite Maison de l'Épouvante <span className="text-sm text-blood">espace troc</span>
      </h1>
      <div className="flex flex-wrap items-center gap-2" aria-label="Utilisateur connecté">
        <span className="font-semibold">{user.displayName}</span>
        <span className="text-ink-muted">({user.username})</span>
        {isMember && <span className="pill border-moss text-moss">Membre</span>}
        <button type="button" className="btn-ghost" onClick={logout}>
          Se déconnecter
        </button>
      </div>
    </header>
  );
}
