import { useEffect, useState } from 'react';
import { ListingForm } from './components/ListingForm';
import { MyListings } from './components/MyListings';
import { Header } from './components/Header';
import { CurrentUser, currentUser, initAuth } from './auth';

const CENTERED = 'text-ink-muted grid min-h-screen place-items-center px-4 text-center';

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    initAuth()
      .then((authenticated) => authenticated && setUser(currentUser()))
      .catch(() => setError("Impossible de joindre le serveur d'authentification."));
  }, []);

  if (error) {
    return (
      <main className={CENTERED} role="alert">
        {error}
      </main>
    );
  }
  if (!user) {
    return (
      <main className={CENTERED} aria-busy="true">
        Connexion en cours…
      </main>
    );
  }

  return (
    <>
      <Header user={user} />
      <main className="mx-auto mt-6 mb-10 grid max-w-6xl grid-cols-1 items-start gap-4 px-4 lg:grid-cols-2">
        <ListingForm onSubmitted={() => setRefreshKey((k) => k + 1)} />
        <MyListings refreshKey={refreshKey} />
      </main>
    </>
  );
}
