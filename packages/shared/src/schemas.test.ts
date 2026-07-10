import { describe, expect, it } from 'vitest';
import { ProfileTemplateFieldSchema, RoomSchema } from './schemas.js';

describe('RoomSchema', () => {
  const validRoom = {
    id: 'room1',
    name: 'Test Room',
    gmUid: 'uid-gm',
    schemaVersion: 1,
    difficultyDie: 'd6',
    dangerDie: 'd6',
    createdAt: Date.now(),
    profileTemplate: [
      { id: 'name', label: 'Name', type: 'text' },
      { id: 'torches', label: 'Torches', type: 'counter', default: 3 },
      { id: 'combat', label: 'Combat', type: 'roll', default: 'd6' },
    ],
  };

  it('accepts a well-formed room doc', () => {
    expect(() => RoomSchema.parse(validRoom)).not.toThrow();
  });

  it('rejects an unknown profile field type', () => {
    const bad = {
      ...validRoom,
      profileTemplate: [{ id: 'x', label: 'X', type: 'formula' }],
    };
    expect(() => RoomSchema.parse(bad)).toThrow();
  });

  it('rejects a missing gmUid', () => {
    const { gmUid: _drop, ...bad } = validRoom;
    expect(() => RoomSchema.parse(bad)).toThrow();
  });
});

describe('ProfileTemplateFieldSchema', () => {
  it('accepts every field type from the fixed set (Plan §2.5)', () => {
    const types = ['text', 'longtext', 'number', 'counter', 'checkbox', 'roll'];
    for (const type of types) {
      expect(() => ProfileTemplateFieldSchema.parse({ id: 'f', label: 'F', type })).not.toThrow();
    }
  });
});
