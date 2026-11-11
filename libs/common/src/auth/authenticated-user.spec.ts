import { ROLE_MEMBER, ROLE_MODERATOR } from './authenticated-user';

describe('roles metier', () => {
  it('expose les noms des roles du realm Keycloak', () => {
    expect(ROLE_MEMBER).toBe('membre');
    expect(ROLE_MODERATOR).toBe('moderateur');
  });
});
