import { Module } from '@nestjs/common';
import { S3Config, loadConfiguration } from '../config/configuration';
import { PhotoStorageService } from './photo-storage.service';

/**
 * Acces au stockage objet. La configuration est injectee (et non lue dans le service) pour que
 * les tests puissent fournir la leur, comme pour le disjoncteur et le client NATS.
 */
@Module({
  providers: [{ provide: S3Config, useFactory: () => loadConfiguration().s3 }, PhotoStorageService],
  exports: [PhotoStorageService],
})
export class StorageModule {}
