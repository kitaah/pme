import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthenticatedUser, CurrentUser, ROLE_MEMBER, Roles, RolesGuard } from '@pme/common';
import { CreateListingDto } from './create-listing.dto';
import { ListingsService } from './listings.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Taille maximale de la photo acceptee par l'API. Traefik coupe plus tot, a 6 Mo de corps de
 * requete (k8s/13-middlewares.yaml) : une image de 5 Mo accompagnee des champs texte passe, un
 * envoi manifestement trop gros n'atteint jamais l'API.
 */
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Fichier recu, tel que multer le remet (son type global `Express.Multer.File` n'est pas declare
 * ici : le tsconfig fixe la liste des types ambiants). Seul le contenu nous interesse : le nom et
 * le type annonces par le navigateur ne sont pas des preuves, c'est le re-encodage qui valide.
 */
export interface UploadedPhoto {
  buffer: Buffer;
  size: number;
  mimetype: string;
}

/**
 * `?limit=` absent OU vide vaut la valeur par defaut : un front qui construit son URL avec un
 * parametre non renseigne ne doit pas recevoir un 400. Toute autre valeur non entiere est refusee.
 */
function parseLimit(raw?: string): number {
  if (raw === undefined || raw.trim() === '') return DEFAULT_LIMIT;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    throw new BadRequestException('Le paramètre « limit » doit être un nombre entier.');
  }
  return Math.min(Math.max(value, 1), MAX_LIMIT);
}

@UseGuards(RolesGuard)
@Roles(ROLE_MEMBER)
@Controller('v1/listings')
export class ListingsController {
  constructor(private readonly service: ListingsService) {}

  /**
   * Depot d'une annonce, en `multipart/form-data` : les champs texte et, facultativement, le
   * fichier `photo`. Le fichier est garde en memoire (il ne fait que traverser l'API, qui le
   * re-encode avant de l'envoyer au stockage objet) : le systeme de fichiers du conteneur reste
   * en lecture seule, comme l'exige son contexte de securite.
   *
   * Un fichier trop gros est refuse par le 413 que NestJS tire de cette limite ; un fichier qui
   * n'est pas une image exploitable, par un 415 (voir PhotoStorageService).
   */
  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto, @UploadedFile() photo?: UploadedPhoto) {
    return this.service.submit(user, dto, photo?.buffer);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.service.findByOwner(user, parseLimit(limit));
  }
}
