import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';
import { ListingCondition } from './listing.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

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

  @IsEnum(ListingCondition, { message: "l'état doit valoir NEW, GOOD ou FAIR" })
  condition: ListingCondition;
}
