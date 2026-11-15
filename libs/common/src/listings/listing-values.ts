/**
 * Valeurs d'une annonce partagees par l'API (qui les ecrit) et le service de moderation (qui les
 * valide a la reception de l'evenement). Les definir ici, une seule fois, evite que les deux
 * listes divergent : un etat ajoute d'un seul cote ferait rejeter les messages vers le flux des
 * messages en echec. Les libelles francais, eux, sont dans le front (frontend/src/api.ts).
 * La categorie et le lieu de remise ne sont pas ici : ce sont des tables de reference de l'API (categories,
 * handover_places), gerees sans deploiement.
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
 * Nature de l'annonce. Le modele et l'API gerent les trois ; seule la vente exige un prix
 * (contrainte en base). Le formulaire du POC n'affiche que l'echange et envoie EXCHANGE.
 */
export enum ListingKind {
  EXCHANGE = 'EXCHANGE',
  GIFT = 'GIFT',
  SALE = 'SALE',
}
