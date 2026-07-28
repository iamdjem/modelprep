import { describe, expect, it } from 'vitest';
import { crc32cBase64, printablesResponseError } from './printables-upload.js';

describe('Printables upload helpers', () => {
  it('computes the CRC32C value used by the live upload form', async () => {
    expect(await crc32cBase64(new Blob(['123456789']))).toBe('4waSgw==');
  });

  it('surfaces mutation field messages', () => {
    expect(printablesResponseError(
      { issues: [{ field: 'summary', messages: ['This field is required.'] }] },
      400,
      'failed',
    )).toBe('This field is required.');
  });
});
