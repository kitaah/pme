import * as common from './index';

describe('API publique de @pme/common', () => {
  it('expose tout ce dont les services ont besoin', () => {
    expect(Object.keys(common)).toEqual(
      expect.arrayContaining([
        'APP_CONFIG',
        'CurrentUser',
        'IS_PUBLIC_KEY',
        'JwtAuthGuard',
        'JwtStrategy',
        'NatsClient',
        'ProblemDetailsFilter',
        'Public',
        'ROLES_KEY',
        'ROLE_MEMBER',
        'ROLE_MODERATOR',
        'Roles',
        'RolesGuard',
        'csv',
        'httpMetricsMiddleware',
        'loadDatabaseConfig',
        'loadKeycloakConfig',
        'loadNatsConfig',
        'num',
        'registry',
        'required',
      ]),
    );
  });
});
