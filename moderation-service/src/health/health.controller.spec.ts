import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let query: jest.Mock;
  let controller: HealthController;

  beforeEach(() => {
    query = jest.fn();
    controller = new HealthController({ query } as unknown as DataSource);
  });

  it('repond UP a la sonde de vivacite sans interroger la base', () => {
    expect(controller.liveness()).toEqual({ status: 'UP' });
    expect(query).not.toHaveBeenCalled();
  });

  it('repond UP a la sonde de disponibilite quand la base repond', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.readiness()).resolves.toEqual({ status: 'UP' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('repond 503 a la sonde de disponibilite quand la base est injoignable', async () => {
    query.mockRejectedValue(new Error('connexion refusee'));

    await expect(controller.readiness()).rejects.toThrow(ServiceUnavailableException);
  });
});
