import { EntityLogicData } from './logic';
import { AtmosphereData, PostProcessingData } from './atmosphere';
import { TerrainConfig, FoliageLayer } from './terrain';
import { HUDConfig } from './hud';

export * from './logic';
export * from './atmosphere';
export * from './terrain';
export * from './hud';

export type ParticlePreset =
  | 'fire'
  | 'smoke'
  | 'sparks'
  | 'rain'
  | 'snow'
  | 'cosmic_dust'
  | 'explosion'
  | 'magic_spell'
  | 'electric_sparks'
  | 'volumetric_smoke'
  | 'aurora';

export interface ParticleEmitterData {
  enabled: boolean;
  preset: ParticlePreset;
  rate: number;
  maxParticles: number;
  size: number;
  speed: number;
  color: string;
  colorEnd?: string;
  lifetime: number;
  spread: number;
  gravity: number;
  loop: boolean;
  burstCount?: number;
}

export type GizmoMode = 'translate' | 'rotate' | 'scale';
export type GizmoSpace = 'world' | 'local';
export type RenderMode = 'shaded' | 'wireframe' | 'normals';

export interface TransformData {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // In degrees for UI
  scale: { x: number; y: number; z: number };
}

export type TexturePreset = 'none' | 'grid' | 'brushed' | 'pebbles' | 'diamond' | 'carbon';

export interface MaterialData {
  color: string;
  roughness: number;
  metalness: number;
  wireframe: boolean;
  opacity: number;
  transparent: boolean;
  emissive?: string;
  emissiveIntensity?: number;
  normalScale?: number;
  hasNormalMap?: boolean;
  hasRoughnessMap?: boolean;
  texturePreset?: TexturePreset;
  customNormalMapUrl?: string;
  customRoughnessMapUrl?: string;
  mapUrl?: string;
  repeatU?: number;
  repeatV?: number;
  toonIntensity?: number; // Add this
  outlineColor?: string; // Add this
  outlineThickness?: number; // Add this
}

export interface LightData {
  color: string;
  intensity: number;
  distance?: number;
}

export type RigidbodyType = 'dynamic' | 'static' | 'kinematic';
export type ColliderShapeType = 'auto' | 'box' | 'sphere' | 'capsule' | 'trimesh' | 'cylinder';

export interface RigidbodyData {
  enabled: boolean;
  type: RigidbodyType;
  mass: number;
  restitution: number; // Bounciness [0..1]
  friction: number; // [0..1]
  linearDamping?: number;
  angularDamping?: number;
  lockRotations?: boolean;
}

export interface ColliderData {
  shape: ColliderShapeType;
  isSensor?: boolean;
  size?: { x: number; y: number; z: number };
  radius?: number;
  height?: number;
}

export interface CharacterControllerData {
  enabled: boolean;
  mode: 'thirdPerson' | 'firstPerson';
  speed: number; // in m/s
  jumpForce: number; // impulse force
  isGrounded?: boolean;
  cameraDistance?: number; // Distance behind player
  cameraHeight?: number;    // Height above player
  cameraOffsetX?: number;   // Lateral offset (e.g. shoulder camera)
  cameraLerpSpeed?: number; // Follow smoothness
}

export interface VehicleControllerData {
  enabled: boolean;
  engineForce: number; // Max acceleration power
  maxSpeed: number; // Max speed in km/h or m/s
  brakeForce: number; // Braking deceleration
  steerAngle: number; // Steering angle in degrees (e.g. 30 deg)
  suspensionStiffness: number; // Spring stiffness
  suspensionDamping: number; // Damper factor
  suspensionRestLength: number; // Rest height off ground
  gripFriction: number; // Tire grip vs drift factor (0.1 = ice drift, 1.0 = high grip)
  cameraDistance: number; // Distance behind vehicle
  cameraHeight: number; // Height above vehicle
  currentSpeedKmH?: number; // Runtime computed speed
}

export interface ScriptData {
  enabled: boolean;
  code?: string;
}

export interface WindZoneConfig {
  enabled: boolean;
  mode: 'directional' | 'vortex' | 'updraft';
  force: number;
  radius: number;
  direction: { x: number; y: number; z: number };
}

export interface FlammableConfig {
  enabled: boolean;
  isBurning: boolean;
  temperature: number;
  ignitionTemperature: number;
  fuel: number;
  maxFuel: number;
  spreadRadius: number;
  burnDamage: number;
  autoIgnite?: boolean;
  charredColor?: string;
}

export interface PhysicsNodeData {
  rigidbody?: RigidbodyData;
  collider?: ColliderData;
  characterController?: CharacterControllerData;
  vehicleController?: VehicleControllerData;
  ragdoll?: RagdollConfig;
  windZone?: WindZoneConfig;
  flammable?: FlammableConfig;
}

export interface ModelInfo {
  format: 'gltf' | 'glb';
  vertexCount: number;
  triangleCount: number;
  meshCount: number;
  fileSize?: string;
  originalName?: string;
  animations?: string[];
}

export interface BlendTreeConfig {
  enabled: boolean;
  mode: '1D_speed' | '2D_directional';
  walkSpeed: number; // m/s, default 2.8
  runSpeed: number; // m/s, default 6.5
  sprintSpeed: number; // m/s, default 9.5
  damping: number; // interpolation smoothing factor, default 10.0
  syncPlaybackSpeed: boolean; // dynamically adapt timeScale to avoid foot sliding
}

export interface IKChainConfig {
  enabled: boolean;
  chainName: 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';
  rootBone: string;
  middleBone: string;
  endBone: string;
  targetOffset: { x: number; y: number; z: number };
  poleVector: { x: number; y: number; z: number };
  weight: number; // 0.0 to 1.0
}

export interface IKConfig {
  enabled: boolean;
  chains: IKChainConfig[];
  footPlanting: boolean; // Automatic ground raycast placement for feet
  groundOffset: number;
}

export type RagdollBodyPart =
  | 'pelvis'
  | 'spine'
  | 'chest'
  | 'head'
  | 'upperArmL'
  | 'lowerArmL'
  | 'upperArmR'
  | 'lowerArmR'
  | 'thighL'
  | 'calfL'
  | 'thighR'
  | 'calfR'
  | 'custom';

export interface RagdollBoneConfig {
  boneName: string;
  part: RagdollBodyPart;
  radius: number; // capsule radius in meters
  height: number; // capsule height in meters
  massRatio?: number;
  parentBoneName?: string;
}

export interface RagdollConfig {
  enabled: boolean;
  active?: boolean;
  totalMass?: number; // default ~75kg
  triggerOnDamage?: boolean; // triggers ragdoll when receiving projectile / attack / health drop
  triggerOnFall?: boolean; // triggers ragdoll on high-speed fall or ground impact
  fallSpeedThreshold?: number; // m/s threshold, default -10 m/s
  damping?: number; // linear/angular damping, default 2.0
  autoGetUp?: boolean; // automatically recover after duration
  getUpDelay?: number; // recovery delay in seconds, default 4.0
  bones?: RagdollBoneConfig[];
}

export interface RigAnimData {
  enabled: boolean;
  rigType: 'biped' | 'quadruped' | 'vehicle' | 'custom';
  animationMapping: {
    idle?: string;
    walk?: string;
    run?: string;
    sprint?: string;
    jump?: string;
    crouch?: string;
    attack?: string;
    interact?: string;
    hit?: string;
    wave?: string;
    die?: string;
  };
  autoAnimate: boolean; // Transitions based on speed
  blendTree?: BlendTreeConfig; // Continuous 1D/2D animation blending
  ik?: IKConfig; // Inverse Kinematics chains & Foot Planting
  ragdoll?: RagdollConfig; // Physical ragdoll collider network
  vehicleWheels?: {
    frontLeft?: string;
    frontRight?: string;
    rearLeft?: string;
    rearRight?: string;
  };
}

export interface SceneNode {
  id: string; // Three.js UUID & ECS Entity ID
  name: string;
  type: 'mesh' | 'light' | 'camera' | 'group' | 'helper';
  subType?:
    | 'cube'
    | 'sphere'
    | 'cylinder'
    | 'plane'
    | 'torus'
    | 'cone'
    | 'player'
    | 'directional'
    | 'point'
    | 'spot'
    | 'ambient'
    | 'model'
    | 'particles'
    | 'vehicle'
    | 'water'
    | 'river'
    | 'triggerVolume'
    | 'navMeshAgent'
    | 'checkpoint';
  visible: boolean;
  castShadow: boolean;
  receiveShadow: boolean;
  transform: TransformData;
  material?: MaterialData;
  light?: LightData;
  physics?: PhysicsNodeData;
  logic?: EntityLogicData;
  particles?: ParticleEmitterData;
  rigAnim?: RigAnimData;
  childrenCount?: number;
  modelInfo?: ModelInfo;
  riverConfig?: any;
}

export interface EngineStats {
  fps: number;
  triangles: number;
  drawCalls: number;
  objectsCount: number;
  physicsBodiesCount?: number;
}

export interface EngineEvents {
  onSelectionChange: (node: SceneNode | null, selectedIds?: string[]) => void;
  onHierarchyChange: (nodes: SceneNode[]) => void;
  onTransformChange: (node: SceneNode) => void;
  onStatsUpdate: (stats: EngineStats) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onModelImportSuccess?: (name: string, info: ModelInfo) => void;
  onModelImportError?: (error: string) => void;
}

export interface WorkPlaneConfig {
  gridVisible: boolean;
  axesVisible: boolean;
  shadowPlaneVisible: boolean;
  gridSize: number;
  gridDivisions: number;
  snapUnit: number;
  height: number;
}

export const DEFAULT_WORK_PLANE_CONFIG: WorkPlaneConfig = {
  gridVisible: true,
  axesVisible: true,
  shadowPlaneVisible: true,
  gridSize: 40,
  gridDivisions: 40,
  snapUnit: 0.5,
  height: 0,
};

export interface SceneExportData {
  version: string;
  generator: string;
  timestamp: string;
  projectName?: string;
  atmosphere?: AtmosphereData;
  postProcessing?: PostProcessingData;
  terrain?: {
    config: TerrainConfig;
    heightmap?: number[];
    foliageLayers?: FoliageLayer[];
  };
  hud?: HUDConfig;
  environment: {
    backgroundColor: string;
    ambientIntensity: number;
    sunIntensity: number;
    sunPosition: { x: number; y: number; z: number };
  };
  nodes: {
    id?: string;
    name: string;
    type: 'mesh' | 'light' | 'camera' | 'group' | 'helper';
    subType?: string;
    transform: TransformData;
    material?: MaterialData;
    light?: LightData;
    physics?: PhysicsNodeData;
    logic?: EntityLogicData;
    rigAnim?: RigAnimData;
    modelInfo?: ModelInfo;
    visible: boolean;
    castShadow: boolean;
    receiveShadow: boolean;
  }[];
}
