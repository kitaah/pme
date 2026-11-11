import { ModerationItem, ModerationStatus } from './moderation-item.entity';

describe('ModerationItem', () => {
  it('connait les trois statuts de moderation', () => {
    expect(Object.values(ModerationStatus)).toEqual(['PENDING', 'ACCEPTED', 'REFUSED']);
  });

  it('peut etre instancie et renseigne', () => {
    const item = new ModerationItem();
    item.status = ModerationStatus.ACCEPTED;

    expect(item.status).toBe('ACCEPTED');
  });
});
