import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { Category } from './category.entity';

/** Categorie telle qu'elle est renvoyee au navigateur : le code (envoye au depot) et le libelle (affiche). */
export interface CategoryView {
  code: string;
  label: string;
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly repository: Repository<Category>,
    private readonly database: DatabaseCircuitBreaker,
  ) {}

  /** Les categories proposees, dans l'ordre d'affichage. */
  async list(): Promise<CategoryView[]> {
    const categories = await this.database.run(() =>
      this.repository.find({ where: { active: true }, order: { sortOrder: 'ASC' } }),
    );
    return categories.map(({ code, label }) => ({ code, label }));
  }

  /** La categorie active portant ce code, ou `null` : inconnue, ou retiree de la liste. */
  findActive(code: string): Promise<Category | null> {
    return this.database.run(() => this.repository.findOneBy({ code, active: true }));
  }
}
