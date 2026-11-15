import { Repository } from 'typeorm';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { CategoriesService } from './categories.service';
import { Category } from './category.entity';

describe('CategoriesService', () => {
  let repository: { find: jest.Mock; findOneBy: jest.Mock };
  let database: DatabaseCircuitBreaker;
  let service: CategoriesService;

  beforeEach(() => {
    repository = { find: jest.fn(), findOneBy: jest.fn() };
    database = new DatabaseCircuitBreaker();
    service = new CategoriesService(repository as unknown as Repository<Category>, database);
  });

  afterEach(() => database.shutdown());

  describe('list', () => {
    it("ne renvoie que les categories proposees, dans l'ordre d'affichage, avec leur code et leur libelle", async () => {
      repository.find.mockResolvedValue([
        { id: 1, code: 'FIGURINES', label: 'Figurines et statues', sortOrder: 1, active: true },
        { id: 8, code: 'OTHER', label: 'Autres', sortOrder: 8, active: true },
      ]);

      await expect(service.list()).resolves.toEqual([
        { code: 'FIGURINES', label: 'Figurines et statues' },
        { code: 'OTHER', label: 'Autres' },
      ]);
      expect(repository.find).toHaveBeenCalledWith({ where: { active: true }, order: { sortOrder: 'ASC' } });
    });
  });

  describe('findActive', () => {
    it('cherche la categorie par son code, parmi les categories proposees', async () => {
      const category = { id: 2, code: 'FILMS', label: 'Films', sortOrder: 2, active: true };
      repository.findOneBy.mockResolvedValue(category);

      await expect(service.findActive('FILMS')).resolves.toBe(category);
      expect(repository.findOneBy).toHaveBeenCalledWith({ code: 'FILMS', active: true });
    });

    it('renvoie null pour un code inconnu ou retire', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findActive('MEUBLES')).resolves.toBeNull();
    });
  });
});
