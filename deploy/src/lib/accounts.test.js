// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { scrubLegacyCultsAccounts } from './accounts.js';

describe('Cults account migration', () => {
  it('removes legacy renderer passwords and requires browser reconnect', () => {
    const result = scrubLegacyCultsAccounts({
      activeId: 'legacy',
      accounts: [{
        id: 'legacy',
        label: '',
        secret: { email: 'creator@example.com', password: 'must-not-remain' },
        status: 'connected',
      }],
    });

    expect(result.changed).toBe(true);
    expect(result.platformState.accounts[0]).toEqual(expect.objectContaining({
      label: 'creator@example.com',
      secret: null,
      status: 'reconnect',
    }));
    expect(JSON.stringify(result.platformState)).not.toContain('must-not-remain');
  });
});
