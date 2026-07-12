import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildDieGeometry, kindForSides, topFaceIndex, type DieKind } from './geometry';

/**
 * Face-detection math (Master Plan v2, R3.1 / Gate 4). `topFaceIndex` is the
 * single mechanism that reads every landed die — given an orientation, the
 * locator scan must return the face pointing up. These are pure: no renderer,
 * no physics.
 */

const UP = new THREE.Vector3(0, 1, 0);

describe('topFaceIndex', () => {
  it('returns the locator already pointing up under identity orientation', () => {
    const locators = [
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(-1, 0, 0),
    ];
    expect(topFaceIndex(locators, new THREE.Quaternion())).toBe(0);
  });

  it('follows the orientation: a 180° flip about X makes the -Y locator read up', () => {
    const locators = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)];
    const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
    expect(topFaceIndex(locators, flip)).toBe(1);
  });

  it('picks the +X face after a −90° rotation about Z brings it up', () => {
    const locators = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1),
    ];
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    // +X rotated +90° about Z → +Y (up).
    expect(topFaceIndex(locators, q)).toBe(0);
  });
});

const ALL_KINDS: DieKind[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const EXPECTED_FACES: Record<DieKind, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20 };

describe('buildDieGeometry', () => {
  it.each(ALL_KINDS)('builds %s with the right face + locator count', (kind) => {
    const g = buildDieGeometry(kind);
    expect(g.faceCount).toBe(EXPECTED_FACES[kind]);
    expect(g.locators).toHaveLength(EXPECTED_FACES[kind]);
    // Every material group maps to exactly one locator/face.
    expect(g.geometry.groups).toHaveLength(EXPECTED_FACES[kind]);
  });

  it('gives d4 vertex locators and per-face corner data', () => {
    const g = buildDieGeometry('d4');
    expect(g.locators).toHaveLength(4); // vertices, not faces
    expect(g.faceCorners).toHaveLength(4);
    for (const corners of g.faceCorners!) expect(corners).toHaveLength(3);
  });

  it('has unit-length locators (directions from the die centre)', () => {
    for (const kind of ALL_KINDS) {
      for (const loc of buildDieGeometry(kind).locators) {
        expect(loc.length()).toBeCloseTo(1, 5);
      }
    }
  });

  it('detects a distinct face for every axis-up orientation of a d20', () => {
    const g = buildDieGeometry('d20');
    // For each locator, rotate the die so that locator points up, then confirm
    // the scan reads that same locator back — the round-trip R3.1 relies on.
    g.locators.forEach((loc, i) => {
      const q = new THREE.Quaternion().setFromUnitVectors(loc.clone().normalize(), UP);
      expect(topFaceIndex(g.locators, q)).toBe(i);
    });
  });
});

describe('kindForSides', () => {
  it('maps standard sizes to their shapes', () => {
    expect(kindForSides(4)).toBe('d4');
    expect(kindForSides(6)).toBe('d6');
    expect(kindForSides(8)).toBe('d8');
    expect(kindForSides(10)).toBe('d10');
    expect(kindForSides(12)).toBe('d12');
    expect(kindForSides(20)).toBe('d20');
    expect(kindForSides(100)).toBe('d10'); // rendered as a pair by the scene
  });
});
