import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatabaseCircuitBreaker } from '../common/database-circuit-breaker';
import { HandoverPlace } from './handover-place.entity';

/** Lieu de remise tel qu'il est renvoye au navigateur : le code (envoye au depot) et le libelle (affiche). */
export interface HandoverPlaceView {
  code: string;
  label: string;
}

@Injectable()
export class HandoverPlacesService {
  constructor(
    @InjectRepository(HandoverPlace) private readonly repository: Repository<HandoverPlace>,
    private readonly database: DatabaseCircuitBreaker,
  ) {}

  /** Les lieux proposes, dans l'ordre d'affichage. */
  async list(): Promise<HandoverPlaceView[]> {
    const places = await this.database.run(() =>
      this.repository.find({ where: { active: true }, order: { sortOrder: 'ASC' } }),
    );
    return places.map(({ code, label }) => ({ code, label }));
  }

  /** Le lieu actif portant ce code, ou `null` : inconnu, ou retire de la liste. */
  findActive(code: string): Promise<HandoverPlace | null> {
    return this.database.run(() => this.repository.findOneBy({ code, active: true }));
  }
}
