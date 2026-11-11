import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { AuthenticatedUser, CurrentUser, ROLE_MEMBER, Roles, RolesGuard } from '@pme/common';
import { CreateListingDto } from './create-listing.dto';
import { ListingsService } from './listings.service';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

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

  @Post()
  @HttpCode(201)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListingDto) {
    return this.service.submit(user, dto);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.service.findByOwner(user, parseLimit(limit));
  }
}
