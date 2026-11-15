import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  it('renvoie la liste des categories proposees par le service', async () => {
    const categories = [{ code: 'FILMS', label: 'Films' }];
    const service = { list: jest.fn().mockResolvedValue(categories) };
    const controller = new CategoriesController(service as unknown as CategoriesService);

    await expect(controller.list()).resolves.toBe(categories);
  });
});
