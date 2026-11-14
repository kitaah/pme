import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { ListingForm } from './components/ListingForm';
import { MyListings } from './components/MyListings';
import { CurrentUser, currentUser, initAuth } from './auth';

const CENTERED = 'text-ink-muted grid min-h-screen place-items-center px-4 text-center';

/**
 * Deux pages, et donc un routeur : le depot d'une annonce renvoie vers la liste des annonces du
 * membre, ou il retrouve ce qu'il vient d'envoyer avec son statut. Le site n'etant qu'une page
 * (nginx rend index.html sur toute route inconnue, voir frontend/nginx.conf), le routeur fonctionne
 * aussi apres un rechargement.
 */
export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    <div className="flex min-h-screen flex-col">
      <Header user={user} />
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-[clamp(16px,4vw,40px)] pt-8 pb-14">
        <Routes>
          <Route path="/" element={<ListingForm />} />
          <Route path="/mes-annonces" element={<MyListings />} />
          {/* Toute autre adresse revient au depot : le POC n'a pas de page d'erreur dediee. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
