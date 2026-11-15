import { HandoverPlacesController } from './handover-places.controller';
import { HandoverPlacesService } from './handover-places.service';

describe('HandoverPlacesController', () => {
  it('renvoie la liste des lieux de remise proposes par le service', async () => {
    const places = [{ code: 'SHOP_LYON', label: 'Magasin de Lyon' }];
    const service = { list: jest.fn().mockResolvedValue(places) };
    const controller = new HandoverPlacesController(service as unknown as HandoverPlacesService);

    await expect(controller.list()).resolves.toBe(places);
  });
});
