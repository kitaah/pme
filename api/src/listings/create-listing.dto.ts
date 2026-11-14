import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { HandoverPlace, ListingCondition, ListingKind } from './listing.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Un champ multipart laisse vide arrive sous forme de chaine vide, jamais absent : il est traite
 * comme non renseigne, sinon @IsOptional ne s'appliquerait pas et la validation echouerait.
 */
const trimOrUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

/** Prix maximal accepte : 999 999 centimes, soit 9 999,99 EUR. Au-dela, la vente se traite autrement. */
export const MAX_PRICE_CENTS = 999_999;

/**
 * Champs du formulaire de depot. La requete est en `multipart/form-data` (elle porte la photo) :
 * toutes les valeurs arrivent donc en texte, d'ou les conversions explicites ci-dessous.
 */
export class CreateListingDto {
  @Transform(trim)
  @IsString({ message: 'le titre doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'le titre est obligatoire' })
  @Length(3, 100, { message: 'le titre doit contenir entre 3 et 100 caractères' })
  title: string;

  @Transform(trim)
  @IsString({ message: 'la description doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'la description est obligatoire' })
  @MaxLength(1000, { message: 'la description ne doit pas dépasser 1000 caractères' })
  description: string;

  @IsEnum(ListingCondition, {
    message: "l'état doit valoir NEW, VERY_GOOD, GOOD, FAIR ou FOR_PARTS",
  })
  condition: ListingCondition;

  /** Absent : le formulaire du POC ne propose que l'echange. */
  @IsOptional()
  @IsEnum(ListingKind, { message: "le type d'annonce doit valoir EXCHANGE, GIFT ou SALE" })
  kind?: ListingKind;

  /**
   * Obligatoire pour une vente, ignore pour les deux autres types (le service le remet a vide,
   * et une contrainte de base garantit l'invariant). En centimes : jamais un nombre decimal.
   */
  @ValidateIf((dto: CreateListingDto) => dto.kind === ListingKind.SALE)
  @Type(() => Number)
  @IsInt({ message: 'le prix doit être un nombre entier de centimes' })
  @Min(1, { message: 'le prix doit être supérieur à zéro' })
  @Max(MAX_PRICE_CENTS, { message: `le prix ne doit pas dépasser ${MAX_PRICE_CENTS} centimes` })
  priceCents?: number;

  /** Ce que le membre souhaite recevoir en echange. Facultatif : un echange peut rester ouvert. */
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsString({ message: 'la contrepartie souhaitée doit être une chaîne de caractères' })
  @MaxLength(120, { message: 'la contrepartie souhaitée ne doit pas dépasser 120 caractères' })
  wantedInExchange?: string;

  /** Lieu de remise. Absent : « à convenir » est applique par defaut. */
  @Transform(trimOrUndefined)
  @IsOptional()
  @IsEnum(HandoverPlace, {
    message: 'le lieu de remise doit être un magasin de la liste ou TO_AGREE',
  })
  handoverPlace?: HandoverPlace;
}
