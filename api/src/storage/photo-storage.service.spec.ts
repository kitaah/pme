import { ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { S3Config } from '../config/configuration';
import { PhotoStorageService } from './photo-storage.service';

const send = jest.fn();
const clients: Array<{ config: Record<string, unknown> }> = [];

/** Faux client S3 : on verifie ce qu'on lui envoie, jamais le reseau. Les commandes restent les vraies. */
jest.mock('@aws-sdk/client-s3', () => {
  const actual = jest.requireActual('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: jest.fn().mockImplementation((config: Record<string, unknown>) => {
      clients.push({ config });
      return { send };
    }),
  };
});
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));

const config: S3Config = {
  endpoint: 'https://garage:3900',
  publicEndpoint: 'https://garage.localhost',
  region: 'garage',
  bucket: 'pme-photos',
  accessKey: 'GKabc',
  secretKey: 'secret',
  urlTtlSeconds: 300,
};

/** Image reelle, produite par la meme bibliotheque que le service : un vrai PNG, pas une chaine. */
const png = (width = 40, height = 20) =>
  sharp({ create: { width, height, channels: 3, background: '#c9303f' } })
    .png()
    .toBuffer();

describe('PhotoStorageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clients.length = 0;
    send.mockResolvedValue({});
  });

  describe('configuration', () => {
    it('cree deux clients : l ecriture vers l adresse interne, la signature pour l adresse publique', () => {
      const service = new PhotoStorageService(config);

      expect(service.configured).toBe(true);
      expect(clients.map((c) => c.config.endpoint)).toEqual(['https://garage:3900', 'https://garage.localhost']);
      expect(clients[0].config).toMatchObject({ region: 'garage', forcePathStyle: true });
      expect(clients[0].config.credentials).toEqual({ accessKeyId: 'GKabc', secretAccessKey: 'secret' });
    });

    it.each([
      ['sans cle d acces', { accessKey: '' }],
      ['sans cle secrete', { secretKey: '' }],
    ])('reste desactive %s : aucun client n est cree', (_label, override) => {
      const service = new PhotoStorageService({ ...config, ...override });

      expect(service.configured).toBe(false);
      expect(clients).toHaveLength(0);
    });
  });

  describe('store', () => {
    it('re-encode en WebP et enregistre sous pending/<uuid>.webp', async () => {
      const service = new PhotoStorageService(config);

      const stored = await service.store(await png());

      expect(stored.mime).toBe('image/webp');
      expect(stored.key).toMatch(/^pending\/[0-9a-f-]{36}\.webp$/);
      const command = send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toMatchObject({ Bucket: 'pme-photos', Key: stored.key, ContentType: 'image/webp' });
      const written = await sharp(command.input.Body as Buffer).metadata();
      expect(written.format).toBe('webp');
    });

    it('reduit une grande photo a 1600 px au plus, sans agrandir une petite', async () => {
      const service = new PhotoStorageService(config);

      await service.store(await png(3200, 1600));
      await service.store(await png(40, 20));

      const big = await sharp((send.mock.calls[0][0] as PutObjectCommand).input.Body as Buffer).metadata();
      const small = await sharp((send.mock.calls[1][0] as PutObjectCommand).input.Body as Buffer).metadata();
      expect([big.width, big.height]).toEqual([1600, 800]);
      expect([small.width, small.height]).toEqual([40, 20]);
    });

    it('refuse en 415 un fichier que la bibliotheque d images ne sait pas decoder, sans rien enregistrer', async () => {
      const service = new PhotoStorageService(config);

      await expect(service.store(Buffer.from('ceci n est pas une image'))).rejects.toBeInstanceOf(
        UnsupportedMediaTypeException,
      );
      expect(send).not.toHaveBeenCalled();
    });

    it('refuse en 503 quand le stockage n est pas configure : la photo n est pas ignoree en silence', async () => {
      const service = new PhotoStorageService({ ...config, accessKey: '' });

      await expect(service.store(await png())).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('repond 503 quand l enregistrement echoue', async () => {
      send.mockRejectedValue(new Error('garage injoignable'));
      const service = new PhotoStorageService(config);

      await expect(service.store(await png())).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('remove', () => {
    it('supprime l objet', async () => {
      const service = new PhotoStorageService(config);

      await service.remove('pending/a.webp');

      const command = send.mock.calls[0][0] as DeleteObjectCommand;
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect(command.input).toEqual({ Bucket: 'pme-photos', Key: 'pending/a.webp' });
    });

    it('trace l echec sans le laisser remonter : la compensation ne doit pas masquer la cause', async () => {
      send.mockRejectedValue(new Error('garage injoignable'));
      const service = new PhotoStorageService(config);

      await expect(service.remove('pending/a.webp')).resolves.toBeUndefined();
    });

    it('ne fait rien quand le stockage n est pas configure', async () => {
      const service = new PhotoStorageService({ ...config, secretKey: '' });

      await expect(service.remove('pending/a.webp')).resolves.toBeUndefined();
      expect(send).not.toHaveBeenCalled();
    });
  });

  describe('signedUrl', () => {
    it('signe une URL de lecture pour l adresse publique, valable la duree configuree', async () => {
      jest
        .mocked(getSignedUrl)
        .mockResolvedValue('https://garage.localhost/pme-photos/pending/a.webp?X-Amz-Signature=x');
      const service = new PhotoStorageService(config);

      const url = await service.signedUrl('pending/a.webp');

      expect(url).toBe('https://garage.localhost/pme-photos/pending/a.webp?X-Amz-Signature=x');
      const [client, command, options] = jest.mocked(getSignedUrl).mock.calls[0] as unknown as [
        unknown,
        { input: unknown },
        unknown,
      ];
      expect(client).toBeDefined();
      expect(command.input).toEqual({ Bucket: 'pme-photos', Key: 'pending/a.webp' });
      expect(options).toEqual({ expiresIn: 300 });
    });

    it('renvoie null quand le stockage n est pas configure', async () => {
      const service = new PhotoStorageService({ ...config, accessKey: '' });

      await expect(service.signedUrl('pending/a.webp')).resolves.toBeNull();
      expect(getSignedUrl).not.toHaveBeenCalled();
    });

    it('renvoie null quand la signature echoue : la liste des annonces reste affichable', async () => {
      jest.mocked(getSignedUrl).mockRejectedValue(new Error('horloge'));
      const service = new PhotoStorageService(config);

      await expect(service.signedUrl('pending/a.webp')).resolves.toBeNull();
    });
  });
});
