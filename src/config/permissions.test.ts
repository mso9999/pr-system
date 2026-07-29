import { describe, expect, it } from 'vitest';
import {
  getEditableTypes,
  hasEditAccess,
  PERMISSION_LEVELS,
  REFERENCE_DATA_TYPES,
} from './permissions';

describe('scoped reference-data permissions', () => {
  it('keeps the HR-canonical department catalog read-only in PR', () => {
    for (const level of Object.values(PERMISSION_LEVELS)) {
      expect(
        hasEditAccess(level, REFERENCE_DATA_TYPES.departments),
      ).toBe(false);
    }
  });

  it('limits IT Administrators to site maintenance', () => {
    expect(getEditableTypes(PERMISSION_LEVELS.IT)).toEqual([
      REFERENCE_DATA_TYPES.sites,
    ]);
  });
});
