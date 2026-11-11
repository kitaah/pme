import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, JwtStrategyConfig } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = {
    keycloak: {
      issuer: 'https://keycloak.localhost/realms/pme',
      jwksUri: 'https://keycloak:8443/realms/pme/protocol/openid-connect/certs',
      allowedClients: ['pme-web', 'pme-cli'],
    },
  } as JwtStrategyConfig;

  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(config);
  });

  it("construit l'utilisateur a partir des claims du jeton", () => {
    const user = strategy.validate({
      sub: 'u1',
      azp: 'pme-web',
      preferred_username: 'membre',
      realm_access: { roles: ['membre'] },
    });

    expect(user).toEqual({ id: 'u1', username: 'membre', roles: ['membre'] });
  });

  it("utilise l'identifiant comme nom et aucun role quand les claims sont absentes", () => {
    expect(strategy.validate({ sub: 'u1', azp: 'pme-cli' })).toEqual({ id: 'u1', username: 'u1', roles: [] });
  });

  it('refuse un jeton sans sujet', () => {
    expect(() => strategy.validate({ azp: 'pme-web' })).toThrow(UnauthorizedException);
  });

  it('refuse un jeton sans client emetteur', () => {
    expect(() => strategy.validate({ sub: 'u1' })).toThrow(UnauthorizedException);
  });

  it("refuse un jeton emis pour un autre client que ceux de l'application", () => {
    expect(() => strategy.validate({ sub: 'u1', azp: 'autre-application' })).toThrow(UnauthorizedException);
  });
});
