import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { KeycloakConfig } from '../config/env';
import { AuthenticatedUser } from './authenticated-user';

export const APP_CONFIG = 'APP_CONFIG';

/** Partie de la configuration d'un service dont la strategie a besoin (fournie sous le jeton APP_CONFIG). */
export interface JwtStrategyConfig {
  keycloak: KeycloakConfig;
}

interface KeycloakJwtPayload {
  sub?: string;
  azp?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
}

/**
 * Valide les jetons Keycloak : signature (cles publiques JWKS), emetteur (`iss`),
 * expiration, puis client emetteur (`azp`). L'API ne gere aucun compte : comme le
 * projet Spring, c'est un simple "resource server" OAuth2.
 *
 * Les cles sont recuperees via l'URL interne du cluster, alors que `iss` reste l'URL
 * publique vue par le navigateur : c'est ce qui evite d'avoir a faire confiance
 * au certificat auto-signe de l'ingress (le truststore Java du projet Spring).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly allowedClients: string[];

  constructor(@Inject(APP_CONFIG) config: JwtStrategyConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer: config.keycloak.issuer,
      secretOrKeyProvider: passportJwtSecret({
        jwksUri: config.keycloak.jwksUri,
        cache: true,
        cacheMaxAge: 10 * 60 * 1000,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      }),
    });
    this.allowedClients = config.keycloak.allowedClients;
  }

  validate(payload: KeycloakJwtPayload): AuthenticatedUser {
    if (!payload.sub || !payload.azp || !this.allowedClients.includes(payload.azp)) {
      throw new UnauthorizedException('Jeton non emis pour cette application');
    }
    return {
      id: payload.sub,
      username: payload.preferred_username ?? payload.sub,
      roles: payload.realm_access?.roles ?? [],
    };
  }
}
