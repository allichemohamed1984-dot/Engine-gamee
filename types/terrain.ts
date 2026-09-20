export type TerrainSculptMode =
  | 'none'
  | 'raise'
  | 'lower'
  | 'smooth'
  | 'flatten'
  | 'paint_grass'
  | 'paint_rock'
  | 'paint_sand'
  | 'paint_snow';

export type FoliageType =
  | 'pine_tree'
  | 'oak_tree'
  | 'rock'
  | 'grass_tuft'
  | 'flower'
  | 'crystal'
  | 'bush';

export interface FoliageInstance {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  colorHex?: string;
}

export interface FoliageLayer {
  type: FoliageType;
  name: string;
  instances: FoliageInstance[];
}

export interface TerrainConfig {
  enabled: boolean;
  size: number; // e.g. 60 meters
  resolution: number; // segments, e.g. 64 or 128
  heightScale: number; // max elevation, e.g. 8m
  seed: number;
  roughness: number; // noise frequency
  octaves: number;
  wireframe: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  colors: {
    grass: string;
    rock: string;
    sand: string;
    snow: string;
  };
}

export interface TerrainBrushConfig {
  mode: TerrainSculptMode | 'foliage_paint' | 'foliage_erase';
  radius: number; // 1 to 15 meters
  strength: number; // 0.1 to 2.0
  flattenHeight: number;
  selectedFoliage: FoliageType;
  foliageDensity: number; // 1 to 10
  foliageScaleMin: number;
  foliageScaleMax: number;
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  enabled: false,
  size: 64,
  resolution: 64,
  heightScale: 7.5,
  seed: 42,
  roughness: 0.04,
  octaves: 4,
  wireframe: false,
  castShadow: true,
  receiveShadow: true,
  colors: {
    grass: '#3d7a36',
    rock: '#52525b',
    sand: '#d4b483',
    snow: '#f1f5f9',
  },
};

export const DEFAULT_TERRAIN_BRUSH: TerrainBrushConfig = {
  mode: 'none',
  radius: 4.5,
  strength: 0.6,
  flattenHeight: 1.0,
  selectedFoliage: 'pine_tree',
  foliageDensity: 3,
  foliageScaleMin: 0.7,
  foliageScaleMax: 1.3,
};
