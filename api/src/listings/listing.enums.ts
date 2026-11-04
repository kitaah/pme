/** Etat de l'objet propose. */
export enum ListingCondition {
  NEW = 'NEW',
  GOOD = 'GOOD',
  FAIR = 'FAIR',
}

/** Cycle de vie d'une annonce. Le POC s'arrete a PENDING_MODERATION. */
export enum ListingStatus {
  PENDING_MODERATION = 'PENDING_MODERATION',
  PUBLISHED = 'PUBLISHED',
  REJECTED = 'REJECTED',
}
