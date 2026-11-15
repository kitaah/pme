import { Controller, Get, UseGuards } from '@nestjs/common';
import { ROLE_MEMBER, Roles, RolesGuard } from '@pme/common';
import { CategoriesService } from './categories.service';

@UseGuards(RolesGuard)
@Roles(ROLE_MEMBER)
@Controller('v1/categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  /** La liste deroulante du formulaire de depot : jamais en dur dans l'interface. */
  @Get()
  list() {
    return this.service.list();
  }
}
