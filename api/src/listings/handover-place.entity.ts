import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Code du lieu de remise applique quand l'annonce n'en precise aucun (message d'une ancienne version du
 * formulaire, appel direct de l'API). Cette ligne doit exister et rester active : la migration la cree.
 */
export const DEFAULT_HANDOVER_PLACE_CODE = 'TO_AGREE';

/**
 * Table de reference des lieux de remise : les magasins de l'entreprise, plus « a convenir ». Comme pour les
 * categories, une migration insere les lignes de depart, puis un administrateur ouvre ou ferme un magasin par SQL
 * (`active = false`), sans redeployer. Aucune adresse de membre n'est collectee : seul un magasin ou « a convenir »
 * peut etre choisi.
 */
@Entity({ name: 'handover_places' })
export class HandoverPlace {
  @PrimaryColumn({ type: 'smallint' })
  id: number;

  /** Identifiant metier, stable : c'est lui que l'interface envoie et que l'evenement transporte. */
  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  /** Libelle affiche en francais. */
  @Column({ type: 'varchar', length: 60 })
  label: string;

  /** Ordre d'affichage dans la liste deroulante. */
  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;

  /** Un lieu retire n'est plus propose, mais les annonces deja rattachees le conservent. */
  @Column({ type: 'boolean', default: true })
  active: boolean;
}
