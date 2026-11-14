import { randomUUID } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { S3Config } from '../config/configuration';

/** Une photo enregistree : son chemin dans le stockage et son type. */
export interface StoredPhoto {
  key: string;
  mime: string;
}

/** Tout est re-encode dans ce format : une seule extension, un seul type a servir. */
const STORED_MIME = 'image/webp';

/** Cote maximal de l'image enregistree. Une photo de telephone (4000 px) est donc reduite. */
const MAX_SIDE_PX = 1600;
const WEBP_QUALITY = 82;

/** Refus avant tout decodage au-dela de 50 megapixels : une image minuscule peut cacher une bombe. */
const MAX_INPUT_PIXELS = 50_000_000;

/**
 * Photos des annonces, dans le stockage objet S3 (Garage en local, hebergeur europeen ensuite) :
 * le conteneur « Stockage de fichiers » du C4 niveau 2. Rien n'est ecrit dans PostgreSQL, qui ne
 * garde que le chemin de l'objet.
 *
 * Deux clients pour un seul stockage :
 *   - `internal` parle au service du cluster (http://garage:3900) : ecriture et suppression ;
 *   - `publicFacing` n'envoie aucune requete, il ne sert qu'a SIGNER les URL de lecture. La
 *     signature couvre le nom d'hote : elle doit donc etre calculee pour l'adresse publique,
 *     celle que le navigateur utilisera (relation 13 du C4 : le navigateur lit le stockage).
 *
 * Stockage non configure (developpement local, tests d'integration) : le depot d'une annonce sans
 * photo continue de fonctionner, et une photo envoyee est refusee en 503 plutot qu'ignoree en
 * silence. Le POC ne cree que le prefixe `pending/` : la decision du moderateur, qui deplacerait
 * l'objet vers `published/`, est hors perimetre.
 */
@Injectable()
export class PhotoStorageService {
  private readonly logger = new Logger(PhotoStorageService.name);
  private readonly internal?: S3Client;
  private readonly publicFacing?: S3Client;

  constructor(private readonly config: S3Config) {
    if (!this.configured) {
      this.logger.warn("Stockage des photos non configure : le depot d'une photo sera refuse");
      return;
    }
    const credentials = { accessKeyId: config.accessKey, secretAccessKey: config.secretKey };
    const common = { region: config.region, credentials, forcePathStyle: true };
    this.internal = new S3Client({ ...common, endpoint: config.endpoint });
    this.publicFacing = new S3Client({ ...common, endpoint: config.publicEndpoint });
  }

  get configured(): boolean {
    return this.config.accessKey !== '' && this.config.secretKey !== '';
  }

  /**
   * Re-encode l'image puis l'enregistre sous `pending/<uuid>.webp`.
   *
   * Le re-encodage est le controle : seul un fichier que la bibliotheque d'images sait decoder
   * passe, quel que soit son nom ou le type annonce par le navigateur. Il retire au passage les
   * metadonnees EXIF, dont la position GPS de la prise de vue.
   */
  async store(buffer: Buffer): Promise<StoredPhoto> {
    const client = this.internal;
    if (!client) {
      throw new ServiceUnavailableException(
        "Le stockage des photos est momentanement indisponible : l'annonce peut être déposée sans photo.",
      );
    }

    const image = await this.reencode(buffer);
    const key = `pending/${randomUUID()}.webp`;
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: image,
          ContentType: STORED_MIME,
        }),
      );
    } catch (error) {
      this.logger.error(`Enregistrement de la photo impossible : ${String(error)}`);
      throw new ServiceUnavailableException(
        'Le stockage des photos est momentanément indisponible. Réessayez dans un instant.',
      );
    }
    return { key, mime: STORED_MIME };
  }

  /** Supprime l'objet. Une erreur est tracee sans remonter : la compensation ne doit pas masquer la cause. */
  async remove(key: string): Promise<void> {
    if (!this.internal) return;
    try {
      await this.internal.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
    } catch (error) {
      this.logger.error(`Photo ${key} non supprimee : ${String(error)}`);
    }
  }

  /**
   * URL de lecture signee, valable quelques minutes : la photo d'une annonce en attente de
   * moderation n'est jamais publique, et le lien expire de lui-meme.
   */
  async signedUrl(key: string): Promise<string | null> {
    if (!this.publicFacing) return null;
    try {
      return await getSignedUrl(this.publicFacing, new GetObjectCommand({ Bucket: this.config.bucket, Key: key }), {
        expiresIn: this.config.urlTtlSeconds,
      });
    } catch (error) {
      this.logger.error(`URL signee impossible pour ${key} : ${String(error)}`);
      return null;
    }
  }

  private async reencode(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        // Applique l'orientation EXIF avant de la retirer : sans cela, une photo prise en
        // portrait s'afficherait couchee.
        .rotate()
        .resize({ width: MAX_SIDE_PX, height: MAX_SIDE_PX, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch (error) {
      this.logger.warn(`Fichier refuse : ${String(error)}`);
      throw new UnsupportedMediaTypeException(
        'Le fichier envoyé n’est pas une image exploitable. Formats acceptés : JPEG, PNG ou WebP.',
      );
    }
  }
}
