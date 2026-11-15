import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Code de la categorie appliquee quand l'annonce n'en precise aucune (message d'une ancienne version
 * du formulaire, appel direct de l'API). Cette ligne doit exister et rester active : la migration la cree.
 */
export const DEFAULT_CATEGORY_CODE = 'OTHER';

/**
 * Table de reference des categories d'annonce. Les lignes ne sont pas creees par l'application : une
 * migration les insere, et un administrateur peut ensuite en ajouter, renommer, reordonner ou retirer
 * (`active = false`) par SQL, sans redeployer ni modifier le code. `id` est donc un entier court
 * (identite geree par la base), pas un UUID : la table est petite, stable, et reste lisible dans les requetes.
 */
@Entity({ name: 'categories' })
export class Category {
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

  /** Une categorie retiree n'est plus proposee, mais les annonces deja rattachees la conservent. */
  @Column({ type: 'boolean', default: true })
  active: boolean;
}
