import { BadRequestException } from '@nestjs/common';
import { AuthenticatedUser } from '@pme/common';
import { CreateListingDto } from './create-listing.dto';
import { ListingCondition } from './listing.enums';
import { ListingsController, MAX_PHOTO_BYTES } from './listings.controller';
import { ListingsService } from './listings.service';

describe('ListingsController', () => {
  const user: AuthenticatedUser = { id: 'u1', username: 'membre', roles: ['membre'] };
  let service: { submit: jest.Mock; findByOwner: jest.Mock };
  let controller: ListingsController;

  beforeEach(() => {
    service = { submit: jest.fn(), findByOwner: jest.fn().mockResolvedValue([]) };
    controller = new ListingsController(service as unknown as ListingsService);
  });

  it('depose l annonce au nom de l utilisateur connecte', async () => {
    const dto: CreateListingDto = { title: 'Figurine', description: 'Edition 2019', condition: ListingCondition.GOOD };
    service.submit.mockResolvedValue({ id: 'l1' });

    await expect(controller.create(user, dto)).resolves.toEqual({ id: 'l1' });
    expect(service.submit).toHaveBeenCalledWith(user, dto, undefined);
  });

  it('transmet au service le contenu de la photo jointe, et lui seul', async () => {
    const dto: CreateListingDto = { title: 'Figurine', description: 'Edition 2019', condition: ListingCondition.GOOD };
    const photo = { buffer: Buffer.from('contenu'), size: 7, mimetype: 'image/png' };
    service.submit.mockResolvedValue({ id: 'l2' });

    await controller.create(user, dto, photo);

    expect(service.submit).toHaveBeenCalledWith(user, dto, photo.buffer);
  });

  it('limite la photo a 5 Mo, en dessous du plafond de 6 Mo de Traefik', () => {
    expect(MAX_PHOTO_BYTES).toBe(5 * 1024 * 1024);
  });

  it.each([
    ['absent', undefined, 50],
    ['vide', '', 50],
    ['compose d espaces', '   ', 50],
    ['valide', '20', 20],
    ['trop petit', '0', 1],
    ['negatif', '-5', 1],
    ['trop grand', '1000', 100],
  ])('liste mes annonces avec un parametre limit %s', async (_label, raw, expected) => {
    await controller.mine(user, raw);

    expect(service.findByOwner).toHaveBeenCalledWith(user, expected);
  });

  it.each(['abc', '1.5'])('refuse (400) un parametre limit non entier : %s', (raw) => {
    expect(() => controller.mine(user, raw)).toThrow(BadRequestException);
    expect(service.findByOwner).not.toHaveBeenCalled();
  });
});
