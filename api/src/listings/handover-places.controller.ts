import { Controller, Get, UseGuards } from '@nestjs/common';
import { ROLE_MEMBER, Roles, RolesGuard } from '@pme/common';
import { HandoverPlacesService } from './handover-places.service';

@UseGuards(RolesGuard)
@Roles(ROLE_MEMBER)
@Controller('v1/handover-places')
export class HandoverPlacesController {
  constructor(private readonly service: HandoverPlacesService) {}

  /** La liste deroulante « Lieu de remise » du formulaire : jamais en dur dans l'interface. */
  @Get()
  list() {
    return this.service.list();
  }
}
