/**
 * Minimal ambient typings for `clipper-lib` (pure-JS Clipper1), used ONLY by the
 * offset spike (`offset-spike.ts`) to measure a true polygon offset against the
 * `bufferPolyline` stand-in (SPEC §8.1 / REVIEW M6). Not part of the shipped
 * library surface. The published package ships no types; this covers just the
 * `ClipperOffset` surface the spike touches.
 */
declare module 'clipper-lib' {
  export interface IntPoint {
    X: number;
    Y: number;
  }
  export type Path = IntPoint[];
  export type Paths = Path[];

  export const JoinType: { jtSquare: number; jtRound: number; jtMiter: number };
  export const EndType: {
    etOpenSquare: number;
    etOpenRound: number;
    etOpenButt: number;
    etClosedLine: number;
    etClosedPolygon: number;
  };

  export class ClipperOffset {
    constructor(miterLimit?: number, arcTolerance?: number);
    AddPath(path: Path, joinType: number, endType: number): void;
    Execute(solution: Paths, delta: number): void;
  }

  export const Clipper: {
    Area(path: Path): number;
    Orientation(path: Path): boolean;
  };

  const ClipperLib: {
    JoinType: typeof JoinType;
    EndType: typeof EndType;
    ClipperOffset: typeof ClipperOffset;
    Clipper: typeof Clipper;
  };
  export default ClipperLib;
}
