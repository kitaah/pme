import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
/** Restreint une route aux utilisateurs possedant au moins un des roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
