declare module "@mapbox/tiny-sdf" {
  export type TinySDFGlyph = {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    glyphWidth: number;
    glyphHeight: number;
    glyphTop: number;
    glyphLeft: number;
    glyphAdvance: number;
  };
  export default class TinySDF {
    constructor(options?: {
      fontSize?: number;
      buffer?: number;
      radius?: number;
      cutoff?: number;
      fontFamily?: string;
      fontWeight?: string;
      fontStyle?: string;
      lang?: string | null;
    });
    draw(char: string): TinySDFGlyph;
  }
}
