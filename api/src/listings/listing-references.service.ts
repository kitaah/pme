import { BadRequestException, Injectable } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category, DEFAULT_CATEGORY_CODE } from './category.entity';
import { CreateListingDto } from './create-listing.dto';
import { DEFAULT_HANDOVER_PLACE_CODE, HandoverPlace } from './handover-place.entity';
import { HandoverPlacesService } from './handover-places.service';

/** Les lignes des tables de reference auxquelles une annonce est rattachee. */
export interface ListingReferences {
  category: Category;
  handoverPlace: HandoverPlace;
}

/**
 * Retrouve la categorie et le lieu de remise choisis dans une demande de depot. Un code absent prend la valeur par
 * defaut ; un code inconnu, ou retire de la liste, est refuse (400) comme tout champ invalide.
 */
@Injectable()
export class ListingReferencesService {
  constructor(
    private readonly categories: CategoriesService,
    private readonly handoverPlaces: HandoverPlacesService,
  ) {}

  async resolve(dto: CreateListingDto): Promise<ListingReferences> {
    const category = await this.categories.findActive(dto.category ?? DEFAULT_CATEGORY_CODE);
    if (!category) throw new BadRequestException("la catégorie est inconnue ou n'est plus proposée");
    const handoverPlace = await this.handoverPlaces.findActive(dto.handoverPlace ?? DEFAULT_HANDOVER_PLACE_CODE);
    if (!handoverPlace) throw new BadRequestException("le lieu de remise est inconnu ou n'est plus proposé");
    return { category, handoverPlace };
  }
}
