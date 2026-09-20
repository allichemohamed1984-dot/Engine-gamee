export type SkyPreset =
  | 'daylight'
  | 'sunset'
  | 'golden_hour'
  | 'cyberpunk'
  | 'scifi_night'
  | 'overcast'
  | 'custom';

export type WaterPreset = 'ocean' | 'lake' | 'tropical' | 'storm' | 'swamp' | 'custom';

export type FogType = 'none' | 'linear' | 'exponential';

export interface WindConfig {
  enabled: boolean;
  speed: number; // in km/h [0..120]
  direction: { x: number; y: number; z: number };
  gustiness: number; // [0..1]
  gustFrequency: number; // in Hz
}

export interface RainConfig {
  enabled: boolean;
  intensity: number; // [0..1]
  isThunder: boolean;
  wetFrictionReduction: number; // [0..0.8]
  dropSize?: number; // scale multiplier [0.2..3.0]
  splashEffects?: boolean; // ripple and splash particles on ground
}

export interface WaterConfig {
  enabled: boolean;
  preset: WaterPreset;
  waterLevel: number; // Y height (default 0 or -1.0)
  followCamera?: boolean; // If true, XZ position follows camera for infinite ocean. If false, fixed selectable XZ transform.
  waterColor: string; // Shallow color (e.g. #0284c7 or #06b6d4)
  deepWaterColor: string; // Deep absorption color (e.g. #032b43 or #021b2b)
  foamColor: string; // Wave crest foam (#ffffff or #e0f2fe)
  clarity: number; // [0..1]
  opacity: number; // [0.2..1.0]
  waveSpeed: number; // [0.1..4.0]
  waveHeight: number; // [0..3.0]
  waveSteepness: number; // [0..1.0]
  waveFrequency: number; // [0.02..0.3]
  sunReflection: number; // Specular shine [0..3.0]
  flowDirection: { x: number; z: number }; // Direction vector
  buoyancyFactor: number; // Archimedes multiplier [0.2..3.0]
  waterDrag: number; // Linear / angular fluid resistance damping [0.2..4.0]
  splashAudio: boolean; // Trigger audio splashes when objects enter/move
}

export interface DayNightCycleConfig {
  enabled: boolean;
  durationMinutes: number; // Duration of full 24h cycle in minutes [0.5..30]
  timeOfDay: number; // Current hour in [0..24] (e.g. 12.0 = Noon, 6.0 = Dawn, 18.0 = Sunset, 0.0 = Midnight)
  isPaused: boolean;
  sunAzimuth: number; // Orbit angle in degrees [0..360]
  starsIntensity: number; // Stars brightness at night [0..2.0]
  moonIntensity: number; // Moonlight brightness [0..3.0]
  smoothShadowRotation: boolean;
}

export interface AtmosphereData {
  skyPreset: SkyPreset;
  sunPosition: { azimuth: number; elevation: number }; // In degrees [0..360, 0..90]
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  skyTopColor: string;
  skyBottomColor: string;
  groundColor: string;
  fog: {
    enabled: boolean;
    type: FogType;
    color: string;
    density: number; // For FogExp2 [0.001 .. 0.1]
    near: number; // For Linear Fog
    far: number;
  };
  wind?: WindConfig;
  rain?: RainConfig;
  water?: WaterConfig;
  dayNightCycle?: DayNightCycleConfig;
}

export interface SSAOConfig {
  enabled: boolean;
  radius: number; // [0.1..3.0]
  intensity: number; // [0.2..3.0]
  bias: number; // [0.001..0.1]
}

export interface PostProcessingData {
  enabled: boolean;
  bloom: {
    enabled: boolean;
    strength: number; // [0..3]
    radius: number; // [0..1]
    threshold: number; // [0..1]
  };
  vignette: {
    enabled: boolean;
    darkness: number; // [0..1.5]
    offset: number; // [0..2]
  };
  colorGrading: {
    enabled: boolean;
    exposure: number; // [0.2..3.0]
    contrast: number; // [0.5..2.0]
    saturation: number; // [0..2.0]
  };
  chromaticAberration: {
    enabled: boolean;
    intensity: number; // [0..0.02]
  };
  ssao?: SSAOConfig;
  fxaa: {
    enabled: boolean;
  };
}

export const DEFAULT_ATMOSPHERE: AtmosphereData = {
  skyPreset: 'daylight',
  sunPosition: { azimuth: 45, elevation: 55 },
  sunColor: '#ffffff',
  sunIntensity: 2.0,
  ambientColor: '#ffffff',
  ambientIntensity: 1.5,
  skyTopColor: '#0284c7',
  skyBottomColor: '#38bdf8',
  groundColor: '#12131C',
  fog: {
    enabled: false,
    type: 'none',
    color: '#12131C',
    density: 0.005,
    near: 15,
    far: 120,
  },
  wind: {
    enabled: false,
    speed: 25,
    direction: { x: 1, y: 0, z: 0.3 },
    gustiness: 0.4,
    gustFrequency: 0.25,
  },
  rain: {
    enabled: false,
    intensity: 0.5,
    isThunder: false,
    wetFrictionReduction: 0.5,
    dropSize: 1.0,
    splashEffects: true,
  },
  water: {
    enabled: false,
    preset: 'ocean',
    waterLevel: -0.5,
    waterColor: '#0284c7',
    deepWaterColor: '#032b43',
    foamColor: '#e0f2fe',
    clarity: 0.65,
    opacity: 0.88,
    waveSpeed: 1.2,
    waveHeight: 0.45,
    waveSteepness: 0.4,
    waveFrequency: 0.08,
    sunReflection: 1.8,
    flowDirection: { x: 1, z: 0.4 },
    buoyancyFactor: 1.4,
    waterDrag: 1.8,
    splashAudio: true,
  },
  dayNightCycle: {
    enabled: false,
    durationMinutes: 4.0,
    timeOfDay: 12.0,
    isPaused: false,
    sunAzimuth: 45,
    starsIntensity: 1.0,
    moonIntensity: 1.2,
    smoothShadowRotation: true,
  },
};

export const DEFAULT_POST_PROCESSING: PostProcessingData = {
  enabled: false,
  bloom: {
    enabled: false,
    strength: 0.85,
    radius: 0.4,
    threshold: 0.75,
  },
  vignette: {
    enabled: false,
    darkness: 0.9,
    offset: 1.1,
  },
  colorGrading: {
    enabled: false,
    exposure: 1.1,
    contrast: 1.05,
    saturation: 1.1,
  },
  chromaticAberration: {
    enabled: false,
    intensity: 0.003,
  },
  ssao: {
    enabled: false,
    radius: 0.8,
    intensity: 1.2,
    bias: 0.02,
  },
  fxaa: {
    enabled: true,
  },
};
