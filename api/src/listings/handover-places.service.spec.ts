import { Repository } from 'typeorm';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { HandoverPlace } from './handover-place.entity';
import { HandoverPlacesService } from './handover-places.service';

describe('HandoverPlacesService', () => {
  let repository: { find: jest.Mock; findOneBy: jest.Mock };
  let database: DatabaseCircuitBreaker;
  let service: HandoverPlacesService;

  beforeEach(() => {
    repository = { find: jest.fn(), findOneBy: jest.fn() };
    database = new DatabaseCircuitBreaker();
    service = new HandoverPlacesService(repository as unknown as Repository<HandoverPlace>, database);
  });

  afterEach(() => database.shutdown());

  describe('list', () => {
    it("ne renvoie que les lieux proposes, dans l'ordre d'affichage, avec leur code et leur libelle", async () => {
      repository.find.mockResolvedValue([
        { id: 1, code: 'SHOP_LYON', label: 'Magasin de Lyon', sortOrder: 1, active: true },
        { id: 5, code: 'TO_AGREE', label: 'À convenir avec le membre', sortOrder: 5, active: true },
      ]);

      await expect(service.list()).resolves.toEqual([
        { code: 'SHOP_LYON', label: 'Magasin de Lyon' },
        { code: 'TO_AGREE', label: 'À convenir avec le membre' },
      ]);
      expect(repository.find).toHaveBeenCalledWith({ where: { active: true }, order: { sortOrder: 'ASC' } });
    });
  });

  describe('findActive', () => {
    it('cherche le lieu par son code, parmi les lieux proposes', async () => {
      const place = { id: 3, code: 'SHOP_LYON', label: 'Magasin de Lyon', sortOrder: 3, active: true };
      repository.findOneBy.mockResolvedValue(place);

      await expect(service.findActive('SHOP_LYON')).resolves.toBe(place);
      expect(repository.findOneBy).toHaveBeenCalledWith({ code: 'SHOP_LYON', active: true });
    });

    it('renvoie null pour un code inconnu ou ferme', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findActive('SHOP_PARIS')).resolves.toBeNull();
    });
  });
});
