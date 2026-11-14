/**
 * Valeurs d'une annonce partagees par l'API (qui les ecrit) et le service de moderation (qui les
 * valide a la reception de l'evenement). Les definir ici, une seule fois, evite que les deux
 * listes divergent : un etat ajoute d'un seul cote ferait rejeter les messages vers le flux des
 * messages en echec. Les libelles francais, eux, sont dans le front (frontend/src/api.ts).
 */

/**
 * Etat de l'objet propose. Grille conventionnelle des places de marche.
 * Quatre niveaux : Neuf, Tres bon etat, Bon etat, Satisfaisant (FAIR). Un objet a reparer n'a pas de
 * niveau a part : le defaut se precise dans la description.
 */
export enum ListingCondition {
  NEW = 'NEW',
  VERY_GOOD = 'VERY_GOOD',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
}

/**
 * Categorie de l'objet : une liste fermee de huit rubriques, dans l'univers de la boutique (horreur
 * et collection). Une liste fixe, validee par le code et par la base, suffit tant que personne ne
 * doit creer ou renommer une categorie depuis l'application ; sinon, une table prendrait le relais.
 * OTHER est la valeur par defaut : une annonce sans categorie (message d'une ancienne version de
 * l'API, ligne deja en base) reste valide.
 */
export enum ListingCategory {
  FIGURINES = 'FIGURINES',
  FILMS = 'FILMS',
  BOOKS = 'BOOKS',
  POSTERS = 'POSTERS',
  MUSIC = 'MUSIC',
  GAMES = 'GAMES',
  CLOTHING = 'CLOTHING',
  OTHER = 'OTHER',
}

/**
 * Nature de l'annonce. Le modele et l'API gerent les trois ; seule la vente exige un prix
 * (contrainte en base). Le formulaire du POC n'affiche que l'echange et envoie EXCHANGE.
 */
export enum ListingKind {
  EXCHANGE = 'EXCHANGE',
  GIFT = 'GIFT',
  SALE = 'SALE',
}

/**
 * Lieu de remise de l'objet : les quatre magasins de l'entreprise, ou un lieu a convenir entre les
 * deux membres. Liste fermee volontairement : aucune adresse ni ville n'est collectee.
 */
export enum HandoverPlace {
  SHOP_ANGOULEME = 'SHOP_ANGOULEME',
  SHOP_AIX = 'SHOP_AIX',
  SHOP_LYON = 'SHOP_LYON',
  SHOP_LONDON = 'SHOP_LONDON',
  TO_AGREE = 'TO_AGREE',
}
