import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { CelShaderPass } from './vfx/CelShaderPass';
import {
  GizmoMode,
  GizmoSpace,
  RenderMode,
  SceneNode,
  TransformData,
  MaterialData,
  LightData,
  PhysicsNodeData,
  RigAnimData,
  EngineEvents,
  EngineStats,
  ModelInfo,
  SceneExportData,
  TexturePreset,
  AtmosphereData,
  PostProcessingData,
  SkyPreset,
  TerrainConfig,
  TerrainBrushConfig,
  DEFAULT_TERRAIN_BRUSH,
  DEFAULT_TERRAIN_CONFIG,
  HUDConfig,
  DEFAULT_HUD_CONFIG,
  WorkPlaneConfig,
  DEFAULT_WORK_PLANE_CONFIG,
  RagdollBoneConfig,
  ParticleEmitterData,
} from '../types/engine';
import { TextureGenerator } from './textureGenerator';
import {
  ECSWorld,
  TransformComponent,
  MeshComponent,
  LightComponent,
  RigidbodyComponent,
  ColliderComponent,
  CharacterControllerComponent,
  RigAnimComponent,
  ToonMaterialComponent,
  OutlineComponent,
  Entity,
} from './ecs/ECS';
import { PhysicsSystem } from './ecs/PhysicsSystem';
import { ToonMaterialSystem } from './ecs/ToonMaterialSystem';
import { PhysicsManager } from './physics/PhysicsManager';
import { RagdollSystem } from './physics/RagdollSystem';
import { LogicExecutor } from './logic/LogicExecutor';
import { EntityLogicData, GraphNodeData } from '../types/logic';
import { AtmosphereManager } from './atmosphere/AtmosphereManager';
import { TerrainGenerator } from './terrain/TerrainGenerator';
import { FoliagePainter } from './terrain/FoliagePainter';
import { ParticleManager } from './vfx/ParticleManager';
import { soundManager, SFXType } from './SoundManager';
import { AnimationManager } from './animation/AnimationManager';
import { EnvironmentalPhysicsManager } from './physics/EnvironmentalPhysicsManager';
import { WaterManager } from './water/WaterManager';
import { RiverMesh, RiverConfig } from './water/RiverMesh';
import { NavMeshManager } from './navigation/NavMeshManager';
import { TriggerVolumeManager } from './navigation/TriggerVolumeManager';

export class SceneManager {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  private orbitControls!: OrbitControls;
  private transformControls!: TransformControls;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private groundPlane: THREE.Plane;

  // 3D Work Plane & Environment
  public workPlaneConfig: WorkPlaneConfig = { ...DEFAULT_WORK_PLANE_CONFIG };
  private workPlaneGroup!: THREE.Group;
  private majorGridHelper!: THREE.GridHelper;
  private minorGridHelper!: THREE.GridHelper;
  private axisLinesGroup!: THREE.Group;
  private axesHelper!: THREE.AxesHelper;
  private floorShadowPlane!: THREE.Mesh;
  private dirLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private rimLight!: THREE.DirectionalLight;

  // ECS, Atmosphere, Terrain & Foliage Engine
  public ecsWorld: ECSWorld;
  public physicsManager: PhysicsManager;
  public physicsSystem: PhysicsSystem;
  public logicExecutor: LogicExecutor;
  public navMeshManager: NavMeshManager;
  public triggerVolumeManager: TriggerVolumeManager;
  public atmosphereManager!: AtmosphereManager;
  public waterManager!: WaterManager;
  public riverMeshes: RiverMesh[] = [];
  public terrainGenerator!: TerrainGenerator;
  public foliagePainter!: FoliagePainter;
  public particleManager!: ParticleManager;
  public animationManager!: AnimationManager;
  public terrainBrush: TerrainBrushConfig = { ...DEFAULT_TERRAIN_BRUSH };
  public hudConfig: HUDConfig = { ...DEFAULT_HUD_CONFIG };
  private brushMarkerMesh!: THREE.Mesh;
  private isSculptingBrush: boolean = false;
  private lastFrameTime: number = performance.now();

  // State
  private objects: Map<string, THREE.Object3D> = new Map();
  private selectedObject: THREE.Object3D | null = null;
  public selectedObjects: THREE.Object3D[] = [];
  private multiSelectGroup: THREE.Group | null = null;
  private isDragSelecting: boolean = false;
  private selectionBoxElement: HTMLDivElement | null = null;
  private selectionStartPos: { x: number; y: number } = { x: 0, y: 0 };

  // History State
  private undoStack: Array<SceneExportData> = [];
  private redoStack: Array<SceneExportData> = [];
  private maxHistory: number = 50;

  private animationFrameId: number | null = null;
  private events: EngineEvents;

  // Configuration
  private gizmoMode: GizmoMode = 'translate';
  private gizmoSpace: GizmoSpace = 'world';
  private renderMode: RenderMode = 'shaded';
  private snappingEnabled: boolean = false;
  private translateSnapValue: number = 0.5;
  private rotateSnapValue: number = (15 * Math.PI) / 180;
  private isPlaying: boolean = false;

  // Raycast click detection state
  private pointerDownPos: { x: number; y: number } = { x: 0, y: 0 };
  private isTransformDragging: boolean = false;

  // Camera Follow Rotation State
  private manualCameraYaw: number = 0;
  private manualCameraPitch: number = 0;
  private isRotatingCamera: boolean = false;
  private lastPointerPos: { x: number; y: number } = { x: 0, y: 0 };

  // Stats calculation
  private frameCount: number = 0;
  private lastFpsTime: number = performance.now();
  private currentFps: number = 60;

  // Override materials for render modes
  private normalMaterial: THREE.MeshNormalMaterial;
  private originalMaterials: Map<string, THREE.Material | THREE.Material[]> = new Map();

  // Loaders
  private gltfLoader: GLTFLoader;
  private mixers: Map<string, THREE.AnimationMixer> = new Map();
  private smoothedEntitySpeeds: Map<string, number> = new Map();
  private blendTreeActions: Map<string, Map<string, THREE.AnimationAction>> = new Map();
  private activeProjectiles: Array<{
    id: string;
    mesh: THREE.Mesh;
    direction: THREE.Vector3;
    speed: number;
    damage: number;
    timer: number;
  }> = [];
  private dracoLoader: DRACOLoader | null = null;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private celShaderPass!: CelShaderPass;

  constructor(container: HTMLElement, events: EngineEvents) {
    this.container = container;
    this.events = events;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.normalMaterial = new THREE.MeshNormalMaterial();

    // Initialize ECS World and Physics Manager
    this.ecsWorld = new ECSWorld();
    this.physicsManager = new PhysicsManager(this.ecsWorld);
    this.physicsSystem = new PhysicsSystem(this.physicsManager);
    this.ecsWorld.addSystem(this.physicsSystem);
    this.ecsWorld.addSystem(new ToonMaterialSystem());
    this.navMeshManager = new NavMeshManager();
    this.triggerVolumeManager = new TriggerVolumeManager();
    this.logicExecutor = new LogicExecutor(this.ecsWorld);
    this.logicExecutor.navMeshManager = this.navMeshManager;
    this.logicExecutor.triggerVolumeManager = this.triggerVolumeManager;
    this.logicExecutor.onPlaySkeletalAnimation = (id, name) => this.playSkeletalAnimation(id, name);
    this.logicExecutor.onShootProjectile = (id, prefab, speed, damage) => this.shootProjectile(id, prefab, speed, damage);
    this.logicExecutor.onDamageEntity = (id, damage, health) => {
      const targetEntity = this.ecsWorld.getEntity(id) || this.getPlayerEntity();
      if (targetEntity) {
        const rigComp = targetEntity.getComponent<RigAnimComponent>('RigAnim');
        const ragdollCfg = rigComp?.ragdoll;
        if (ragdollCfg && ragdollCfg.enabled && ragdollCfg.triggerOnDamage) {
          // Trigger ragdoll with impact knockback
          const knockback = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            health <= 0 ? -1.5 : 1.5,
            -3.0
          );
          this.triggerRagdoll(targetEntity.id, knockback);
        }
      }
    };

    // Pre-initialize Rapier WebAssembly in background
    PhysicsManager.initRapier().catch((err) => {
      console.warn('Rapier 3D WebAssembly initialization deferred:', err);
    });

    // Initialize GLTF & DRACO loader
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
      console.error(`Erreur de chargement de ressource: ${url}`);
      this.events.onModelImportError?.(`Ressource manquante: ${url.split('/').pop()}. Utilisez le format .GLB pour inclure toutes les textures.`);
    };

    this.gltfLoader = new GLTFLoader(loadingManager);
    try {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
      this.dracoLoader.setDecoderConfig({ type: 'js' });
      this.gltfLoader.setDRACOLoader(this.dracoLoader);
    } catch {
      console.warn('Draco decoder CDN initialization deferred.');
    }

    this.init();
  }

  private init(): void {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    // 1. Scene & Clear Color (#12131C)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#12131C');
    this.logicExecutor.scene = this.scene;
    this.triggerVolumeManager.setScene(this.scene);

    // 2. Camera (FOV 60, near: 0.1, far: 1000, pos: (3, 3, 5), lookAt: (0, 0, 0))
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(3, 3, 5);
    this.camera.lookAt(0, 0, 0);
    this.physicsManager.characterSystem.setCamera(this.camera);

    // 3. Renderer with ClearColor #12131C
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#12131C', 1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Explicit canvas element styling
    const canvas = this.renderer.domElement;
    canvas.id = 'aether-three-canvas';
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.outline = 'none';
    canvas.style.touchAction = 'none';
    canvas.style.userSelect = 'none';

    // Remove any previous canvas to avoid duplicates
    const existingCanvases = this.container.querySelectorAll('canvas');
    existingCanvases.forEach((c) => c.remove());

    this.container.appendChild(canvas);
    
    // Initialize Post-Processing
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    // Add Cel-Shading earlier in the chain, after RenderPass
    this.celShaderPass = new CelShaderPass();
    this.celShaderPass.setResolution(width, height);
    this.composer.addPass(this.celShaderPass);
    
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.5, 0.4, 0.85);
    this.composer.addPass(this.bloomPass);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.uniforms.resolution.value.set(1 / width, 1 / height);
    this.composer.addPass(fxaaPass);

    // 4. OrbitControls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.05;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.maxPolarAngle = Math.PI / 2 + 0.05;
    this.orbitControls.minDistance = 0.5;
    this.orbitControls.maxDistance = 200;
    this.orbitControls.update();

    // 5. TransformControls
    this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
    this.transformControls.size = 0.85;
    this.transformControls.setMode(this.gizmoMode);
    this.transformControls.setSpace(this.gizmoSpace);

    this.transformControls.addEventListener('dragging-changed', (event) => {
      const isDragging = Boolean((event as { value?: boolean }).value);
      console.log(`[Gizmo] Dragging state: ${isDragging}`);
      this.isTransformDragging = isDragging;
      this.orbitControls.enabled = !isDragging;
      if (isDragging) this.isRotatingCamera = false;

      if (!isDragging) {
        if (this.multiSelectGroup) {
          // Temporarily dissolve to commit world positions, rotations, scales to ECS/three
          this.dissolveMultiSelectGroup();
          // Notify transform updates for each component
          this.selectedObjects.forEach((obj) => {
            const node = this.toSceneNode(obj);
            this.events.onTransformChange(node);
          });
          // Regroup at new composite center
          this.recreateMultiSelectGroup();
        } else if (this.selectedObject) {
          const entity = this.ecsWorld.getEntity(this.selectedObject.uuid);
          if (entity) {
            const trans = entity.getComponent<TransformComponent>('Transform');
            if (trans) trans.syncFromObject3D(this.selectedObject);
          }
        }
        this.saveHistoryState();
      }
    });

    this.transformControls.addEventListener('change', () => {
      if (this.selectedObject) {
        if (this.waterManager && this.selectedObject === this.waterManager.waterMesh) {
          this.waterManager.config.waterLevel = this.selectedObject.position.y;
        }
        const node = this.toSceneNode(this.selectedObject);
        this.events.onTransformChange(node);
      }
    });

    const gizmo = this.transformControls.getHelper();
    gizmo.name = '__AETHER_GIZMO_HELPER__';
    this.scene.add(gizmo);

    // 6. Environment Helpers & Lights (Ambient 1.5 + Directional (5, 10, 7) 2.0)
    this.setupEnvironment();

    // 7. Initial Demo Objects
    this.seedInitialScene();

    // 8. Event Listeners
    this.bindEvents();

    // 9. Start Loop
    this.animate();

    // Notify initial hierarchy
    this.notifyHierarchy();

    // Seed the initial history state
    this.saveHistoryState();
  }

  private setupEnvironment(): void {
    // 1. Build the high-contrast 3D Work Plane Group (Plan de travail 3D)
    this.createWorkPlane();

    // 2. Ambient Light (Intensité 1.5)
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.ambientLight.name = '__AETHER_AMBIENT_LIGHT__';
    this.scene.add(this.ambientLight);

    // 3. Primary Directional Light (Position x: 5, y: 10, z: 7, Intensité 2.0)
    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.dirLight.position.set(5, 10, 7);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 50;
    this.dirLight.shadow.camera.left = -15;
    this.dirLight.shadow.camera.right = 15;
    this.dirLight.shadow.camera.top = 15;
    this.dirLight.shadow.camera.bottom = -15;
    this.dirLight.shadow.bias = -0.0005;
    this.dirLight.shadow.radius = 2.5;
    this.dirLight.name = 'Directional Sun Light';
    this.scene.add(this.dirLight);

    // 4. Rim light for depth
    this.rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    this.rimLight.position.set(-6, 6, -6);
    this.rimLight.name = '__AETHER_RIM_LIGHT__';
    this.scene.add(this.rimLight);

    // 5. Initialize Atmosphere Manager
    this.atmosphereManager = new AtmosphereManager(
      this.scene,
      this.camera,
      this.renderer,
      this.dirLight,
      this.ambientLight
    );

    // 5b. Initialize Water & Ocean Gerstner Wave System
    this.waterManager = new WaterManager(this.scene, this.atmosphereManager.atmosphere.water);
    this.syncWaterMeshRegistration();

    // 6. Initialize Procedural Terrain Generator (hidden when disabled so work plane is pristine)
    this.terrainGenerator = new TerrainGenerator();
    this.terrainGenerator.mesh.visible = this.terrainGenerator.config.enabled;
    this.scene.add(this.terrainGenerator.mesh);
    this.physicsManager.setTerrainGenerator(this.terrainGenerator);

    // 7. Initialize Foliage & Rocks Instanced Painter
    this.foliagePainter = new FoliagePainter(this.scene);

    // 8. Initialize Particle Emitters & VFX Manager
    this.particleManager = new ParticleManager(this.scene);
    this.logicExecutor.particleManager = this.particleManager;

    // 8b. Initialize Environmental Physics (Wind, Fire, Water Buoyancy & Rain physics)
    const envPhysics = new EnvironmentalPhysicsManager(this.ecsWorld, this.scene);
    envPhysics.particleManager = this.particleManager;
    envPhysics.waterManager = this.waterManager;
    this.physicsManager.environmentalPhysics = envPhysics;
    this.logicExecutor.environmentalPhysics = envPhysics;

    // 9. Initialize Keyframe & Kinematic Animation Manager
    this.animationManager = new AnimationManager(this.scene);
    this.logicExecutor.animationManager = this.animationManager;

    // 9. Brush Projection Ring Marker
    const ringGeo = new THREE.RingGeometry(0.9, 1.0, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
      depthTest: false,
    });
    this.brushMarkerMesh = new THREE.Mesh(ringGeo, ringMat);
    this.brushMarkerMesh.name = '__AETHER_BRUSH_MARKER__';
    this.brushMarkerMesh.visible = false;
    this.brushMarkerMesh.renderOrder = 999;
    this.scene.add(this.brushMarkerMesh);
  }

  /**
   * Builds the dual-frequency high precision 3D Work Plane (Plan de travail)
   */
  public createWorkPlane(): void {
    if (this.workPlaneGroup) {
      this.scene.remove(this.workPlaneGroup);
    }

    this.workPlaneGroup = new THREE.Group();
    this.workPlaneGroup.name = '__AETHER_WORK_PLANE_GROUP__';
    this.workPlaneGroup.position.y = this.workPlaneConfig.height;

    const size = this.workPlaneConfig.gridSize || 40;
    const divisions = this.workPlaneConfig.gridDivisions || 40;
    const majorDivisions = Math.max(4, Math.floor(divisions / 5));

    // A. Major Subdivision Grid (Thicker Cyan Accent lines)
    this.majorGridHelper = new THREE.GridHelper(size, majorDivisions, 0x38bdf8, 0x0284c7);
    this.majorGridHelper.name = '__AETHER_MAJOR_GRID__';
    const majorMat = this.majorGridHelper.material as THREE.Material;
    majorMat.transparent = true;
    majorMat.opacity = 0.6;
    majorMat.depthWrite = false;
    this.workPlaneGroup.add(this.majorGridHelper);

    // B. Minor Subdivision Grid (Fine Slate lines)
    this.minorGridHelper = new THREE.GridHelper(size, divisions, 0x334155, 0x1e293b);
    this.minorGridHelper.name = '__AETHER_MINOR_GRID__';
    const minorMat = this.minorGridHelper.material as THREE.Material;
    minorMat.transparent = true;
    minorMat.opacity = 0.4;
    minorMat.depthWrite = false;
    this.workPlaneGroup.add(this.minorGridHelper);

    // C. Floor Axis Lines & Origin Marker (Red for X, Blue for Z)
    this.axisLinesGroup = new THREE.Group();
    this.axisLinesGroup.name = '__AETHER_AXIS_LINES__';

    // X Axis line (Red)
    const xGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-size / 2, 0.001, 0),
      new THREE.Vector3(size / 2, 0.001, 0),
    ]);
    const xMat = new THREE.LineBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const xLine = new THREE.Line(xGeo, xMat);
    this.axisLinesGroup.add(xLine);

    // Z Axis line (Blue)
    const zGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0.001, -size / 2),
      new THREE.Vector3(0, 0.001, size / 2),
    ]);
    const zMat = new THREE.LineBasicMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const zLine = new THREE.Line(zGeo, zMat);
    this.axisLinesGroup.add(zLine);

    // Center Origin Ring
    const originGeo = new THREE.RingGeometry(0.12, 0.18, 24);
    originGeo.rotateX(-Math.PI / 2);
    const originMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const originMesh = new THREE.Mesh(originGeo, originMat);
    originMesh.position.y = 0.002;
    this.axisLinesGroup.add(originMesh);

    this.workPlaneGroup.add(this.axisLinesGroup);

    // D. Corner AxesHelper
    this.axesHelper = new THREE.AxesHelper(2.5);
    this.axesHelper.position.set(0, 0.005, 0);
    this.axesHelper.name = '__AETHER_AXES_HELPER__';
    this.workPlaneGroup.add(this.axesHelper);

    // E. Soft Floor Shadow Catcher Plane
    const shadowGeo = new THREE.PlaneGeometry(size * 2, size * 2);
    const shadowMat = new THREE.ShadowMaterial({
      opacity: 0.35,
      depthWrite: false,
    });
    this.floorShadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    this.floorShadowPlane.rotation.x = -Math.PI / 2;
    this.floorShadowPlane.position.y = -0.003;
    this.floorShadowPlane.receiveShadow = true;
    this.floorShadowPlane.name = '__AETHER_FLOOR_SHADOW__';
    this.workPlaneGroup.add(this.floorShadowPlane);

    // Apply visibility states
    this.applyWorkPlaneVisibility();

    this.scene.add(this.workPlaneGroup);
  }

  public applyWorkPlaneVisibility(): void {
    if (!this.workPlaneGroup) return;
    const cfg = this.workPlaneConfig;
    if (this.majorGridHelper) this.majorGridHelper.visible = cfg.gridVisible;
    if (this.minorGridHelper) this.minorGridHelper.visible = cfg.gridVisible;
    if (this.axisLinesGroup) this.axisLinesGroup.visible = cfg.axesVisible;
    if (this.axesHelper) this.axesHelper.visible = cfg.axesVisible;
    if (this.floorShadowPlane) this.floorShadowPlane.visible = cfg.shadowPlaneVisible;
    this.workPlaneGroup.position.y = cfg.height;
    this.groundPlane.constant = -cfg.height;
  }

  public setWorkPlaneConfig(config: Partial<WorkPlaneConfig>): void {
    const sizeChanged =
      (config.gridSize !== undefined && config.gridSize !== this.workPlaneConfig.gridSize) ||
      (config.gridDivisions !== undefined && config.gridDivisions !== this.workPlaneConfig.gridDivisions);

    this.workPlaneConfig = {
      ...this.workPlaneConfig,
      ...config,
    };

    if (config.snapUnit !== undefined) {
      this.translateSnapValue = config.snapUnit;
      if (this.snappingEnabled) {
        this.transformControls.setTranslationSnap(this.translateSnapValue);
      }
    }

    if (sizeChanged) {
      this.createWorkPlane();
    } else {
      this.applyWorkPlaneVisibility();
    }
  }

  public toggleWorkPlaneGrid(): boolean {
    this.setWorkPlaneConfig({ gridVisible: !this.workPlaneConfig.gridVisible });
    return this.workPlaneConfig.gridVisible;
  }

  public toggleWorkPlaneAxes(): boolean {
    this.setWorkPlaneConfig({ axesVisible: !this.workPlaneConfig.axesVisible });
    return this.workPlaneConfig.axesVisible;
  }

  public toggleWorkPlaneShadow(): boolean {
    this.setWorkPlaneConfig({ shadowPlaneVisible: !this.workPlaneConfig.shadowPlaneVisible });
    return this.workPlaneConfig.shadowPlaneVisible;
  }

  public setWorkPlaneHeight(height: number): void {
    this.setWorkPlaneConfig({ height });
  }

  private seedInitialScene(): void {
    // 1. Center Hero Cube with Normal map texture preset
    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.25,
      metalness: 0.3,
      emissive: new THREE.Color(0x001133),
      emissiveIntensity: 0.2,
    });
    // Add procedural carbon normal map
    const carbonNormal = TextureGenerator.getNormalMap('carbon');
    if (carbonNormal) {
      cubeMat.normalMap = carbonNormal;
      cubeMat.normalScale.set(0.6, 0.6);
    }
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.name = 'Main Cube';
    cube.position.set(0, 0.75, 0);
    cube.castShadow = true;
    cube.receiveShadow = true;
    cube.userData = {
      subType: 'cube',
      initialY: 0.75,
      texturePreset: 'carbon',
      hasNormalMap: true,
      hasRoughnessMap: false,
    };
    this.registerObject(cube);

    // 2. Chrome/Glossy Sphere
    const sphereGeo = new THREE.SphereGeometry(0.85, 48, 48);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.12,
      metalness: 0.9,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.name = 'Chrome Sphere';
    sphere.position.set(-2.8, 0.85, 0.8);
    sphere.castShadow = true;
    sphere.receiveShadow = true;
    sphere.userData = { subType: 'sphere', initialY: 0.85 };
    this.registerObject(sphere);

    // 3. Gold Torus Ring
    const torusGeo = new THREE.TorusGeometry(0.9, 0.25, 32, 64);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.85,
    });
    const brushedNormal = TextureGenerator.getNormalMap('brushed');
    if (brushedNormal) {
      torusMat.normalMap = brushedNormal;
      torusMat.normalScale.set(0.7, 0.7);
    }
    const torus = new THREE.Mesh(torusGeo, torusMat);
    torus.name = 'Torus Ring';
    torus.position.set(2.8, 1.1, -0.6);
    torus.rotation.x = Math.PI / 3;
    torus.castShadow = true;
    torus.receiveShadow = true;
    torus.userData = {
      subType: 'torus',
      initialY: 1.1,
      texturePreset: 'brushed',
      hasNormalMap: true,
    };
    this.registerObject(torus);

    // 4. Pedestal Base
    const planeGeo = new THREE.CylinderGeometry(4.5, 4.8, 0.15, 48);
    const planeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.7,
      metalness: 0.2,
    });
    const gridNormal = TextureGenerator.getNormalMap('grid');
    if (gridNormal) {
      planeMat.normalMap = gridNormal;
      planeMat.normalScale.set(0.4, 0.4);
    }
    const pedestal = new THREE.Mesh(planeGeo, planeMat);
    pedestal.name = 'Base Pedestal';
    pedestal.position.set(0, 0.075, 0);
    pedestal.receiveShadow = true;
    pedestal.castShadow = true;
    pedestal.userData = { subType: 'cylinder', texturePreset: 'grid', hasNormalMap: true };
    this.registerObject(pedestal);

    // Select Main Cube by default
    this.selectObject(cube);
  }

  public registerObject(obj: THREE.Object3D): void {
    this.objects.set(obj.uuid, obj);
    this.scene.add(obj);

    if (obj instanceof THREE.Mesh) {
      this.originalMaterials.set(obj.uuid, obj.material);
    } else if (obj instanceof THREE.Group) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          this.originalMaterials.set(child.uuid, child.material);
        }
      });
    }

    // Synchronize ECS Entity & Components
    const entity = this.ecsWorld.createEntity(obj.uuid, obj.name, obj);

    // 1. TransformComponent
    const transformComp = new TransformComponent();
    transformComp.syncFromObject3D(obj);
    entity.addComponent(transformComp);

    // 2. Visual Mesh or Light Component
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
      entity.addComponent(new MeshComponent(obj));
    } else if (obj instanceof THREE.Light) {
      entity.addComponent(new LightComponent(obj));
    }

    // 3. Physics Components
    const physicsData = obj.userData?.physics as PhysicsNodeData | undefined;
    if (physicsData) {
      if (physicsData.rigidbody) {
        entity.addComponent(new RigidbodyComponent(physicsData.rigidbody));
      }
      if (physicsData.collider) {
        entity.addComponent(new ColliderComponent(physicsData.collider));
      }
      if (physicsData.characterController) {
        entity.addComponent(new CharacterControllerComponent(physicsData.characterController));
      }
    } else {
      this.assignDefaultPhysics(obj, entity);
    }
  }

  /**
   * Assigns context-aware default physics configurations to entities
   */
  private assignDefaultPhysics(obj: THREE.Object3D, entity: Entity): void {
    obj.userData = obj.userData || {};

    // Is it ground / pedestal or level geometry?
    if (
      obj.name === 'Base Pedestal' ||
      obj.userData.subType === 'plane' ||
      obj.name.toLowerCase().includes('ground') ||
      obj.name.toLowerCase().includes('floor')
    ) {
      const physics: PhysicsNodeData = {
        rigidbody: {
          enabled: true,
          type: 'static',
          mass: 0,
          restitution: 0.2,
          friction: 0.8,
        },
        collider: {
          shape: obj.userData.subType === 'cylinder' ? 'cylinder' : 'box',
        },
      };
      obj.userData.physics = physics;
      entity.addComponent(new RigidbodyComponent(physics.rigidbody));
      entity.addComponent(new ColliderComponent(physics.collider));
      return;
    }

    // Is it a player character?
    if (obj.userData.subType === 'player') {
      const physics: PhysicsNodeData = {
        rigidbody: {
          enabled: true,
          type: 'kinematic',
          mass: 75,
          restitution: 0.0,
          friction: 0.2,
          lockRotations: true,
        },
        collider: {
          shape: 'capsule',
          radius: 0.45,
          height: 1.8,
        },
        characterController: {
          enabled: true,
          mode: 'thirdPerson',
          speed: 7.0,
          jumpForce: 8.5,
          isGrounded: true,
        },
      };
      obj.userData.physics = physics;
      entity.addComponent(new RigidbodyComponent(physics.rigidbody));
      entity.addComponent(new ColliderComponent(physics.collider));
      entity.addComponent(new CharacterControllerComponent(physics.characterController));
      return;
    }

    // Is it a vehicle?
    if (obj.userData.subType === 'vehicle') {
      const physics: PhysicsNodeData = obj.userData.physics || {
        rigidbody: {
          enabled: true,
          type: 'kinematic',
          mass: 1200,
          restitution: 0.1,
          friction: 0.8,
        },
        collider: {
          shape: 'box',
          size: { x: 2.0, y: 1.2, z: 4.2 },
        },
        vehicleController: {
          enabled: true,
          engineForce: 55.0,
          maxSpeed: 140.0,
          brakeForce: 70.0,
          steerAngle: 32,
          suspensionStiffness: 35.0,
          suspensionDamping: 4.5,
          suspensionRestLength: 0.6,
          gripFriction: 0.85,
          cameraDistance: 7.5,
          cameraHeight: 2.5,
        },
      };
      obj.userData.physics = physics;
      entity.addComponent(new RigidbodyComponent(physics.rigidbody));
      entity.addComponent(new ColliderComponent(physics.collider));
      return;
    }

    // Standard physical mesh (dynamic by default: cube, sphere, cylinder, model)
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Group) {
      const subType = obj.userData.subType;
      const isSphere = subType === 'sphere';
      const isCylinder = subType === 'cylinder';
      const isModel = subType === 'model';

      const physics: PhysicsNodeData = {
        rigidbody: {
          enabled: true,
          type: 'dynamic',
          mass: isSphere ? 0.8 : 1.0,
          restitution: isSphere ? 0.75 : 0.4,
          friction: 0.5,
          linearDamping: 0.05,
          angularDamping: 0.05,
        },
        collider: {
          shape: isSphere
            ? 'sphere'
            : isCylinder
            ? 'cylinder'
            : isModel
            ? 'trimesh'
            : 'auto',
        },
      };
      obj.userData.physics = physics;
      entity.addComponent(new RigidbodyComponent(physics.rigidbody));
      entity.addComponent(new ColliderComponent(physics.collider));
    }
  }

  /**
   * Updates Physics configuration from the UI Inspector
   */
  public updatePhysics(id: string, physicsData: Partial<PhysicsNodeData>): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    obj.userData = obj.userData || {};
    obj.userData.physics = {
      ...(obj.userData.physics || {}),
      ...physicsData,
    };

    const entity = this.ecsWorld.getEntity(id);
    if (entity) {
      if (physicsData.rigidbody !== undefined) {
        entity.removeComponent('Rigidbody');
        if (physicsData.rigidbody.enabled) {
          entity.addComponent(new RigidbodyComponent(physicsData.rigidbody));
        }
      }
      if (physicsData.collider !== undefined) {
        entity.removeComponent('Collider');
        entity.addComponent(new ColliderComponent(physicsData.collider));
      }
      if (physicsData.characterController !== undefined) {
        entity.removeComponent('CharacterController');
        if (physicsData.characterController.enabled) {
          entity.addComponent(
            new CharacterControllerComponent(physicsData.characterController)
          );
        }
      }
    }

    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  /**
   * Updates 3-tier Logic configuration (Behavior Cards, Node Graph, Custom Script)
   */
  public updateLogic(id: string, logicData: Partial<EntityLogicData>): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    obj.userData = obj.userData || {};
    obj.userData.logic = {
      ...(obj.userData.logic || {}),
      ...logicData,
    };

    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  private bindEvents(): void {
    const dom = this.renderer.domElement;

    dom.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.isTransformDragging) return;

      this.pointerDownPos = { x: e.clientX, y: e.clientY };
      this.lastPointerPos = { x: e.clientX, y: e.clientY };

      if (this.isPlaying && !this.isTransformDragging) {
        this.isRotatingCamera = true;
        return;
      }

      if (this.terrainBrush.mode !== 'none' && e.button === 0) {
        this.isSculptingBrush = true;
        this.orbitControls.enabled = false;
        this.applyTerrainBrush(e);
        return;
      }

      // 2D drag-selection box trigger checks
      const isGizmoHovered = this.transformControls.dragging || (this.transformControls as any).pointerIsOver;
      if (this.terrainBrush.mode === 'none' && !isGizmoHovered && e.button === 0) {
        const hitObject = this.raycastObjects(e);
        if (e.shiftKey || !hitObject) {
          this.isDragSelecting = true;
          this.selectionStartPos = { x: e.clientX, y: e.clientY };
          this.orbitControls.enabled = false;
        }
      }
    });

    dom.addEventListener('pointermove', (e: PointerEvent) => {
      if (this.isTransformDragging) return;

      if (this.isDragSelecting) {
        if (!this.selectionBoxElement) {
          this.selectionBoxElement = document.createElement('div');
          this.selectionBoxElement.style.position = 'fixed';
          this.selectionBoxElement.style.border = '1.5px solid #38bdf8';
          this.selectionBoxElement.style.backgroundColor = 'rgba(56, 189, 248, 0.15)';
          this.selectionBoxElement.style.pointerEvents = 'none';
          this.selectionBoxElement.style.zIndex = '99999';
          this.selectionBoxElement.style.borderRadius = '4px';
          document.body.appendChild(this.selectionBoxElement);
        }

        const currentX = e.clientX;
        const currentY = e.clientY;

        const left = Math.min(this.selectionStartPos.x, currentX);
        const top = Math.min(this.selectionStartPos.y, currentY);
        const width = Math.abs(this.selectionStartPos.x - currentX);
        const height = Math.abs(this.selectionStartPos.y - currentY);

        this.selectionBoxElement.style.left = `${left}px`;
        this.selectionBoxElement.style.top = `${top}px`;
        this.selectionBoxElement.style.width = `${width}px`;
        this.selectionBoxElement.style.height = `${height}px`;
        return;
      }

      if (this.isPlaying && this.isRotatingCamera) {
        const deltaX = e.clientX - this.lastPointerPos.x;
        const deltaY = e.clientY - this.lastPointerPos.y;
        this.lastPointerPos = { x: e.clientX, y: e.clientY };

        this.manualCameraYaw -= deltaX * 0.005;
        this.manualCameraPitch = Math.max(-Math.PI / 3.2, Math.min(Math.PI / 3.2, this.manualCameraPitch - deltaY * 0.005));
        return;
      }

      if (this.terrainBrush.mode !== 'none') {
        this.updateBrushMarker(e);
        if (this.isSculptingBrush) {
          this.applyTerrainBrush(e);
        }
      } else if (this.brushMarkerMesh) {
        this.brushMarkerMesh.visible = false;
      }
    });

    dom.addEventListener('pointerup', (e: PointerEvent) => {
      if (this.isPlaying) {
        this.isRotatingCamera = false;
      }

      if (this.isDragSelecting) {
        this.isDragSelecting = false;
        this.orbitControls.enabled = true;

        if (this.selectionBoxElement) {
          const rect = this.selectionBoxElement.getBoundingClientRect();
          document.body.removeChild(this.selectionBoxElement);
          this.selectionBoxElement = null;

          const boxWidth = rect.width;
          const boxHeight = rect.height;
          if (boxWidth > 5 && boxHeight > 5) {
            const newlySelected: THREE.Object3D[] = [];
            const tempV = new THREE.Vector3();

            this.objects.forEach((obj) => {
              if (!obj.visible) return;
              obj.getWorldPosition(tempV);
              tempV.project(this.camera);

              const rectDom = this.renderer.domElement.getBoundingClientRect();
              const x = rectDom.left + (tempV.x * 0.5 + 0.5) * rectDom.width;
              const y = rectDom.top + (tempV.y * -0.5 + 0.5) * rectDom.height;

              if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
                newlySelected.push(obj);
              }
            });

            if (newlySelected.length > 0) {
              this.dissolveMultiSelectGroup();
              if (e.shiftKey) {
                newlySelected.forEach((obj) => {
                  const idx = this.selectedObjects.findIndex((o) => o.uuid === obj.uuid);
                  if (idx === -1) {
                    this.selectedObjects.push(obj);
                  } else {
                    this.selectedObjects.splice(idx, 1);
                  }
                });
              } else {
                this.selectedObjects = newlySelected;
              }

              if (this.selectedObjects.length === 1) {
                this.selectObject(this.selectedObjects[0]);
              } else if (this.selectedObjects.length > 1) {
                this.selectedObject = this.selectedObjects[this.selectedObjects.length - 1];
                this.recreateMultiSelectGroup();
                this.triggerSelectionChange();
              }
            }
          }
        }
        return;
      }

      if (this.isSculptingBrush) {
        this.isSculptingBrush = false;
        if (this.terrainBrush.mode === 'none') {
          this.orbitControls.enabled = true;
        }
        // Save history state on completing terrain brush or foliage paint action
        this.saveHistoryState();
        return;
      }

      if (this.isTransformDragging) return;

      const deltaX = Math.abs(e.clientX - this.pointerDownPos.x);
      const deltaY = Math.abs(e.clientY - this.pointerDownPos.y);

      if (deltaX < 5 && deltaY < 5) {
        this.performRaycast(e);
      }
    });

    window.addEventListener('keydown', this.handleKeyDown);
  }

  private updateBrushMarker(e: PointerEvent): void {
    if (!this.terrainGenerator?.mesh || !this.brushMarkerMesh) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.terrainGenerator.mesh, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      this.brushMarkerMesh.position.copy(hit.point).add(new THREE.Vector3(0, 0.08, 0));
      const r = this.terrainBrush.radius;
      this.brushMarkerMesh.scale.set(r, r, r);
      this.brushMarkerMesh.visible = true;

      // Color code ring: green for sculpt, blue for foliage, red for erase
      const mat = this.brushMarkerMesh.material as THREE.MeshBasicMaterial;
      if (this.terrainBrush.mode === 'foliage_erase') {
        mat.color.set(0xf43f5e);
      } else if (this.terrainBrush.mode === 'foliage_paint') {
        mat.color.set(0x38bdf8);
      } else {
        mat.color.set(0x10b981);
      }
    } else {
      this.brushMarkerMesh.visible = false;
    }
  }

  private applyTerrainBrush(e: PointerEvent): void {
    if (!this.terrainGenerator?.mesh) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.terrainGenerator.mesh, false);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;
      const b = this.terrainBrush;

      if (b.mode === 'raise' || b.mode === 'lower' || b.mode === 'smooth' || b.mode === 'flatten') {
        this.terrainGenerator.sculptAt(point, b.mode, b.radius, b.strength, b.flattenHeight);
        this.foliagePainter.adjustFoliageHeights(this.terrainGenerator);
      } else if (b.mode === 'foliage_paint') {
        this.foliagePainter.paintAt(
          point,
          b.selectedFoliage,
          b.radius,
          b.foliageDensity,
          b.foliageScaleMin,
          b.foliageScaleMax,
          hit.face?.normal
        );
      } else if (b.mode === 'foliage_erase') {
        this.foliagePainter.eraseAt(point, b.radius);
      }
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
      return;
    }

    switch (e.key.toLowerCase()) {
      case 'w':
        this.setGizmoMode('translate');
        break;
      case 'e':
        this.setGizmoMode('rotate');
        break;
      case 'r':
        if (this.isPlaying) {
          this.togglePlayerRagdoll();
        } else {
          this.setGizmoMode('scale');
        }
        break;
      case 'escape':
        this.deselect();
        break;
      case 'delete':
      case 'backspace':
        if (this.selectedObject) {
          this.deleteObject(this.selectedObject.uuid);
        }
        break;
      case 'f':
        this.focusOnObject();
        break;
      case ' ':
        e.preventDefault();
        this.togglePlayMode();
        break;
    }
  };

  private raycastObjects(e: PointerEvent): THREE.Object3D | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const pickableObjects: THREE.Object3D[] = [];
    this.objects.forEach((obj) => {
      if (obj.visible) pickableObjects.push(obj);
    });

    const intersects = this.raycaster.intersectObjects(pickableObjects, true);
    if (intersects.length > 0) {
      let target: THREE.Object3D | null = intersects[0].object;
      while (target && !this.objects.has(target.uuid) && target.parent !== this.scene) {
        target = target.parent;
      }
      if (target && this.objects.has(target.uuid)) {
        return target;
      }
    }
    return null;
  }

  private performRaycast(e: PointerEvent): void {
    const isShift = e.shiftKey;
    const target = this.raycastObjects(e);

    if (target) {
      if (this.isPlaying) {
        const entity = this.ecsWorld.getEntity(target.uuid);
        if (entity) {
          this.logicExecutor.executeGraphEvents(entity, 'OnClick');
        }
      }
      if (isShift) {
        this.toggleMultiSelect(target);
      } else {
        this.selectObject(target);
      }
    } else {
      if (!isShift) {
        this.deselect();
      }
    }
  }

  /**
   * Calculates world coordinates of the mouse on the active 3D work plane or terrain
   */
  public getGroundIntersection(clientX: number, clientY: number): THREE.Vector3 {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);

    // If procedural terrain is enabled and visible, raycast directly onto terrain heightmap
    if (
      this.terrainGenerator?.mesh &&
      this.terrainGenerator.config.enabled &&
      this.terrainGenerator.mesh.visible
    ) {
      const terrainHits = this.raycaster.intersectObject(this.terrainGenerator.mesh, false);
      if (terrainHits.length > 0) {
        const hitPos = terrainHits[0].point.clone();
        if (this.snappingEnabled) {
          const s = this.translateSnapValue || this.workPlaneConfig.snapUnit || 0.5;
          hitPos.x = Math.round(hitPos.x / s) * s;
          hitPos.z = Math.round(hitPos.z / s) * s;
        }
        return hitPos;
      }
    }

    // Default: Raycast on 3D Work Plane at Y = workPlaneConfig.height
    const target = new THREE.Vector3();
    const intersect = this.raycaster.ray.intersectPlane(this.groundPlane, target);

    if (intersect) {
      if (this.snappingEnabled) {
        const s = this.translateSnapValue || this.workPlaneConfig.snapUnit || 0.5;
        intersect.x = Math.round(intersect.x / s) * s;
        intersect.z = Math.round(intersect.z / s) * s;
      }
      return intersect;
    }
    return new THREE.Vector3(0, this.workPlaneConfig.height, 0);
  }

  private triggerSelectionChange(): void {
    const node = this.selectedObject ? this.toSceneNode(this.selectedObject) : null;
    const ids = this.selectedObjects.map((o) => o.uuid);
    this.events.onSelectionChange(node, ids);
  }

  public selectObject(object: THREE.Object3D | null): void {
    this.dissolveMultiSelectGroup();
    if (!object || !this.objects.has(object.uuid)) {
      this.deselect();
      return;
    }

    this.selectedObject = object;
    this.selectedObjects = [object];

    if (!this.isPlaying) {
      this.transformControls.attach(object);
    } else {
      this.transformControls.detach();
    }

    this.triggerSelectionChange();
  }

  public selectById(id: string): void {
    const obj = this.objects.get(id);
    if (obj) {
      this.selectObject(obj);
    } else {
      this.deselect();
    }
  }

  public deselect(): void {
    this.dissolveMultiSelectGroup();
    this.selectedObject = null;
    this.selectedObjects = [];
    this.transformControls.detach();
    this.triggerSelectionChange();
  }

  public toggleMultiSelect(object: THREE.Object3D): void {
    if (!this.objects.has(object.uuid)) return;

    this.dissolveMultiSelectGroup();

    const index = this.selectedObjects.findIndex((o) => o.uuid === object.uuid);
    if (index === -1) {
      this.selectedObjects.push(object);
    } else {
      this.selectedObjects.splice(index, 1);
    }

    if (this.selectedObjects.length === 0) {
      this.deselect();
    } else if (this.selectedObjects.length === 1) {
      this.selectObject(this.selectedObjects[0]);
    } else {
      this.selectedObject = this.selectedObjects[this.selectedObjects.length - 1];
      this.recreateMultiSelectGroup();
      this.triggerSelectionChange();
    }
  }

  private recreateMultiSelectGroup(): void {
    if (this.selectedObjects.length <= 1) return;

    this.dissolveMultiSelectGroup();

    // 1. Calculate bounding center of selected items
    const compositeCenter = new THREE.Vector3();
    const tempV = new THREE.Vector3();
    this.selectedObjects.forEach((obj) => {
      obj.getWorldPosition(tempV);
      compositeCenter.add(tempV);
    });
    compositeCenter.divideScalar(this.selectedObjects.length);

    // 2. Create the pivot group wrapper
    this.multiSelectGroup = new THREE.Group();
    this.multiSelectGroup.name = '__AETHER_MULTI_SELECT_GROUP__';
    this.multiSelectGroup.position.copy(compositeCenter);
    this.scene.add(this.multiSelectGroup);

    // 3. Attach each child to the group maintaining world transform offsets
    this.selectedObjects.forEach((obj) => {
      this.multiSelectGroup!.attach(obj);
    });

    // 4. Attach gizmo to pivot group
    if (!this.isPlaying) {
      this.transformControls.attach(this.multiSelectGroup);
    }
  }

  private dissolveMultiSelectGroup(): void {
    if (!this.multiSelectGroup) return;

    this.transformControls.detach();

    // Attach children back to the root scene or their respective parent
    const children = [...this.multiSelectGroup.children];
    children.forEach((child) => {
      this.scene.attach(child);

      // Sync updated coordinates to ECS transform component
      const entity = this.ecsWorld.getEntity(child.uuid);
      if (entity) {
        const trans = entity.getComponent<TransformComponent>('Transform');
        if (trans) trans.syncFromObject3D(child);
      }
    });

    this.scene.remove(this.multiSelectGroup);
    this.multiSelectGroup = null;
  }

  public saveHistoryState(): void {
    const state = this.exportScene();
    this.undoStack.push(state);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public undo(): void {
    if (this.undoStack.length <= 1) return;
    const currentState = this.undoStack.pop()!;
    this.redoStack.push(currentState);

    const prevState = this.undoStack[this.undoStack.length - 1];
    this.applyHistoryState(prevState);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop()!;
    this.undoStack.push(nextState);
    this.applyHistoryState(nextState);
  }

  private applyHistoryState(state: SceneExportData): void {
    const selectedIds = this.selectedObjects.map((o) => o.uuid);

    // Import the layout state
    this.importScene(state);

    // Restore selected states safely
    const restoredObjects: THREE.Object3D[] = [];
    selectedIds.forEach((id) => {
      const obj = this.objects.get(id);
      if (obj) restoredObjects.push(obj);
    });

    if (restoredObjects.length === 1) {
      this.selectObject(restoredObjects[0]);
    } else if (restoredObjects.length > 1) {
      this.selectedObjects = restoredObjects;
      this.selectedObject = restoredObjects[restoredObjects.length - 1];
      this.recreateMultiSelectGroup();
      this.triggerSelectionChange();
    } else {
      this.deselect();
    }
  }

  public instantiatePrefab(prefabNodes: any[], dropPos?: { x: number; y: number; z: number }): void {
    this.dissolveMultiSelectGroup();
    this.deselect();

    const idMapping = new Map<string, string>();
    const newClones: THREE.Object3D[] = [];

    // 1. Generate new UUIDs for each prefab node to prevent duplicate ID conflicts!
    const processedNodes = prefabNodes.map((node) => {
      const newId = THREE.MathUtils.generateUUID();
      idMapping.set(node.id, newId);

      const copy = JSON.parse(JSON.stringify(node));
      copy.id = newId;
      return copy;
    });

    // 2. Compute center of the original bounding box of prefab nodes to offset them to the cursor/drop location!
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    prefabNodes.forEach((node) => {
      const pos = node.transform.position;
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.z < minZ) minZ = pos.z;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
      if (pos.z > maxZ) maxZ = pos.z;
    });

    const centerX = (minX + maxX) / 2;
    const centerY = minY; // keep pivot at base of prefab
    const centerZ = (minZ + maxZ) / 2;

    const targetX = dropPos ? dropPos.x : 0;
    const targetY = dropPos ? dropPos.y : 0;
    const targetZ = dropPos ? dropPos.z : 0;

    const offsetX = targetX - centerX;
    const offsetY = targetY - centerY;
    const offsetZ = targetZ - centerZ;

    // 3. Deserialize each node
    processedNodes.forEach((item) => {
      let created: THREE.Object3D | null = null;
      const subType = item.subType || 'cube';

      if (item.type === 'mesh') {
        const mat = new THREE.MeshStandardMaterial({
          color: item.material?.color || '#3b82f6',
          roughness: item.material?.roughness ?? 0.35,
          metalness: item.material?.metalness ?? 0.2,
          wireframe: item.material?.wireframe ?? false,
          opacity: item.material?.opacity ?? 1,
          transparent: item.material?.transparent ?? false,
          emissive: new THREE.Color(item.material?.emissive || '#000000'),
          emissiveIntensity: item.material?.emissiveIntensity || 0,
        });

        if (item.material?.texturePreset && item.material.texturePreset !== 'none') {
          const normalTex = TextureGenerator.getNormalMap(item.material.texturePreset);
          if (normalTex) {
            mat.normalMap = normalTex;
            mat.normalScale.set(0.6, 0.6);
          }
        }

        let geo: THREE.BufferGeometry;
        switch (subType) {
          case 'sphere':
            geo = new THREE.SphereGeometry(0.9, 36, 36);
            break;
          case 'cylinder':
            geo = new THREE.CylinderGeometry(0.75, 0.75, 1.8, 36);
            break;
          case 'plane':
            geo = new THREE.PlaneGeometry(3, 3);
            break;
          case 'torus':
            geo = new THREE.TorusGeometry(0.8, 0.25, 24, 48);
            break;
          case 'cone':
            geo = new THREE.ConeGeometry(0.9, 1.8, 32);
            break;
          case 'cube':
          default:
            geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
            break;
        }

        created = new THREE.Mesh(geo, mat);
        created.userData = { subType, texturePreset: item.material?.texturePreset };
      } else if (item.type === 'light') {
        if (subType === 'point') {
          const light = new THREE.PointLight(
            item.light?.color || 0x38bdf8,
            item.light?.intensity || 3.5,
            item.light?.distance || 18
          );
          light.add(new THREE.PointLightHelper(light, 0.3));
          created = light;
          created.userData = { subType: 'point' };
        } else {
          created = new THREE.DirectionalLight(
            item.light?.color || 0xffffff,
            item.light?.intensity || 2.0
          );
          created.userData = { subType: 'directional' };
        }
      }

      if (created) {
        created.name = item.name;
        // Apply relative offset to drop point
        created.position.set(
          item.transform.position.x + offsetX,
          item.transform.position.y + offsetY,
          item.transform.position.z + offsetZ
        );
        created.rotation.set(
          THREE.MathUtils.degToRad(item.transform.rotation.x),
          THREE.MathUtils.degToRad(item.transform.rotation.y),
          THREE.MathUtils.degToRad(item.transform.rotation.z)
        );
        created.scale.set(
          item.transform.scale.x,
          item.transform.scale.y,
          item.transform.scale.z
        );
        created.visible = item.visible;
        created.castShadow = item.castShadow;
        created.receiveShadow = item.receiveShadow;

        if (item.physics) {
          created.userData = created.userData || {};
          created.userData.physics = JSON.parse(JSON.stringify(item.physics));
        }
        if (item.logic) {
          created.userData = created.userData || {};
          created.userData.logic = JSON.parse(JSON.stringify(item.logic));
        }
        if (item.modelInfo) {
          created.userData = created.userData || {};
          created.userData.modelInfo = item.modelInfo;
        }
        if (item.rigAnim) {
          created.userData = created.userData || {};
          created.userData.rigAnim = item.rigAnim;
        }

        this.registerObject(created);
        newClones.push(created);

        if (item.rigAnim) {
          this.setRigAnim(created.uuid, item.rigAnim);
        }
      }
    });

    // 4. Update multi-selection or select single
    if (newClones.length === 1) {
      this.selectObject(newClones[0]);
    } else if (newClones.length > 1) {
      this.selectedObjects = newClones;
      this.selectedObject = newClones[newClones.length - 1];
      this.recreateMultiSelectGroup();
      this.triggerSelectionChange();
    }

    this.notifyHierarchy();
    this.saveHistoryState();
  }

  public setGizmoMode(mode: GizmoMode): void {
    this.gizmoMode = mode;
    this.transformControls.setMode(mode);
  }

  public setGizmoSpace(space: GizmoSpace): void {
    this.gizmoSpace = space;
    this.transformControls.setSpace(space);
  }

  public setSnapping(enabled: boolean, translateSnap?: number, rotateSnap?: number): void {
    this.snappingEnabled = enabled;
    if (translateSnap !== undefined) this.translateSnapValue = translateSnap;
    if (rotateSnap !== undefined) this.rotateSnapValue = rotateSnap;

    if (this.snappingEnabled) {
      this.transformControls.setTranslationSnap(this.translateSnapValue);
      this.transformControls.setRotationSnap(this.rotateSnapValue);
    } else {
      this.transformControls.setTranslationSnap(null);
      this.transformControls.setRotationSnap(null);
    }
  }

  public setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;

    this.objects.forEach((obj, uuid) => {
      const applyRenderMode = (mesh: THREE.Mesh, origMat: THREE.Material | THREE.Material[]) => {
        if (mode === 'normals') {
          mesh.material = this.normalMaterial;
        } else if (mode === 'wireframe') {
          if (Array.isArray(origMat)) {
            mesh.material = origMat.map((m) => {
              const clone = m.clone() as THREE.MeshStandardMaterial;
              clone.wireframe = true;
              return clone;
            });
          } else {
            const clone = origMat.clone() as THREE.MeshStandardMaterial;
            clone.wireframe = true;
            mesh.material = clone;
          }
        } else {
          mesh.material = origMat;
        }
      };

      if (obj instanceof THREE.Mesh) {
        const orig = this.originalMaterials.get(uuid);
        if (orig) applyRenderMode(obj, orig);
      } else if (obj instanceof THREE.Group) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const orig = this.originalMaterials.get(child.uuid);
            if (orig) applyRenderMode(child, orig);
          }
        });
      }
    });
  }

  public togglePlayMode(): void {
    this.setPlayMode(!this.isPlaying);
  }

  public async setPlayMode(playing: boolean): Promise<void> {
    this.isPlaying = playing;
    this.events.onPlayStateChange(playing);

    if (playing) {
      this.manualCameraYaw = 0;
      this.manualCameraPitch = 0;
      this.isRotatingCamera = false;
      this.transformControls.detach();
      await this.physicsManager.startSimulation();
      this.logicExecutor.startSimulation();
    } else {
      this.logicExecutor.stopSimulation();
      this.physicsManager.stopSimulation();
      if (this.animationManager) {
        this.animationManager.resetAllTracks();
      }
      if (this.selectedObject) {
        this.transformControls.attach(this.selectedObject);
      }
    }
  }

  // Object addition with optional drop location
  public addPrimitive(
    type:
      | 'cube'
      | 'sphere'
      | 'cylinder'
      | 'plane'
      | 'torus'
      | 'cone'
      | 'player'
      | 'pointLight'
      | 'spotLight'
      | 'dirLight'
      | 'camera'
      | 'particles'
      | 'vehicle'
      | 'river'
      | 'triggerVolume'
      | 'navMeshAgent'
      | 'checkpoint',
    dropPos?: { x: number; y: number; z: number }
  ): SceneNode {
    if (type === 'river') {
      return this.addRiver({}, dropPos);
    }
    let newObject: THREE.Object3D;
    let name = 'Object';

    const defaultMaterial = () =>
      new THREE.MeshStandardMaterial({
        color: 0x60a5fa,
        roughness: 0.35,
        metalness: 0.15,
      });

    const posX = dropPos ? dropPos.x : 0;
    const posZ = dropPos ? dropPos.z : 0;

    switch (type) {
      case 'cube': {
        const geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        newObject = new THREE.Mesh(geo, defaultMaterial());
        name = `Cube_${this.objects.size + 1}`;
        newObject.position.set(posX, 0.75, posZ);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'cube' };
        break;
      }
      case 'sphere': {
        const geo = new THREE.SphereGeometry(0.9, 36, 36);
        newObject = new THREE.Mesh(geo, defaultMaterial());
        name = `Sphere_${this.objects.size + 1}`;
        newObject.position.set(posX, 0.9, posZ);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'sphere' };
        break;
      }
      case 'cylinder': {
        const geo = new THREE.CylinderGeometry(0.75, 0.75, 1.8, 36);
        newObject = new THREE.Mesh(geo, defaultMaterial());
        name = `Cylinder_${this.objects.size + 1}`;
        newObject.position.set(posX, 0.9, posZ);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'cylinder' };
        break;
      }
      case 'torus': {
        const geo = new THREE.TorusGeometry(0.8, 0.25, 24, 48);
        newObject = new THREE.Mesh(geo, defaultMaterial());
        name = `Torus_${this.objects.size + 1}`;
        newObject.position.set(posX, 1.0, posZ);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'torus' };
        break;
      }
      case 'cone': {
        const geo = new THREE.ConeGeometry(0.9, 1.8, 32);
        newObject = new THREE.Mesh(geo, defaultMaterial());
        name = `Cone_${this.objects.size + 1}`;
        newObject.position.set(posX, 0.9, posZ);
        newObject.castShadow = true;
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'cone' };
        break;
      }
      case 'plane': {
        const geo = new THREE.PlaneGeometry(3, 3);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x3f3f46,
          side: THREE.DoubleSide,
          roughness: 0.6,
        });
        newObject = new THREE.Mesh(geo, mat);
        name = `Plane_${this.objects.size + 1}`;
        newObject.rotation.x = -Math.PI / 2;
        newObject.position.set(posX, 0.05, posZ);
        newObject.receiveShadow = true;
        newObject.userData = { subType: 'plane' };
        break;
      }
      case 'pointLight': {
        const light = new THREE.PointLight(0x38bdf8, 3.5, 18);
        light.position.set(posX, 3.0, posZ);
        light.castShadow = true;
        const helper = new THREE.PointLightHelper(light, 0.3);
        light.add(helper);

        // Emissive Light Bulb Mesh
        const bulbMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 16, 16),
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            emissive: 0x38bdf8,
            emissiveIntensity: 2.5,
            roughness: 0.1,
          })
        );
        bulbMesh.name = 'LightBulbMesh';
        light.add(bulbMesh);

        newObject = light;
        name = `PointLight_${this.objects.size + 1}`;
        newObject.userData = { subType: 'point' };
        break;
      }
      case 'spotLight': {
        const spot = new THREE.SpotLight(0xf59e0b, 5, 25, Math.PI / 4, 0.3);
        spot.position.set(posX, 4.0, posZ);
        spot.castShadow = true;
        const helper = new THREE.SpotLightHelper(spot);
        spot.add(helper);

        // Volumetric Cone Beam Mesh
        const coneGeo = new THREE.ConeGeometry(2.5, 7, 32, 1, true);
        coneGeo.translate(0, -3.5, 0);
        coneGeo.rotateX(-Math.PI / 2);
        const coneMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.15,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const volumetricCone = new THREE.Mesh(coneGeo, coneMat);
        volumetricCone.name = 'VolumetricLightCone';
        spot.add(volumetricCone);

        newObject = spot;
        name = `SpotLight_${this.objects.size + 1}`;
        newObject.userData = { subType: 'spot' };
        break;
      }
      case 'dirLight': {
        const dir = new THREE.DirectionalLight(0xe0e7ff, 2.0);
        dir.position.set(posX + 4, 6, posZ + 4);
        dir.castShadow = true;
        newObject = dir;
        name = `DirLight_${this.objects.size + 1}`;
        newObject.userData = { subType: 'directional' };
        break;
      }
      case 'camera': {
        // Target Camera dummy with visual helper
        const group = new THREE.Group();
        group.position.set(posX, 2.0, posZ);
        const camBox = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.4, 0.7),
          new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.4 })
        );
        camBox.castShadow = true;
        group.add(camBox);
        newObject = group;
        name = `Camera_${this.objects.size + 1}`;
        newObject.userData = { subType: 'camera' };
        break;
      }
      case 'player': {
        // Ready-to-play Character Controller Avatar
        const group = new THREE.Group();
        name = `Player_${this.objects.size + 1}`;

        // Capsule Body
        const bodyGeo = new THREE.CapsuleGeometry(0.4, 1.0, 16, 32);
        const bodyMat = new THREE.MeshStandardMaterial({
          color: 0x0284c7, // Sky Blue
          roughness: 0.25,
          metalness: 0.7,
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        bodyMesh.position.set(0, 0.9, 0);
        group.add(bodyMesh);

        // Cyber Visor
        const visorGeo = new THREE.BoxGeometry(0.52, 0.16, 0.28);
        const visorMat = new THREE.MeshStandardMaterial({
          color: 0x06b6d4,
          emissive: new THREE.Color(0x00f5ff),
          emissiveIntensity: 1.8,
          roughness: 0.1,
          metalness: 0.9,
        });
        const visorMesh = new THREE.Mesh(visorGeo, visorMat);
        visorMesh.position.set(0, 1.32, -0.28);
        group.add(visorMesh);

        group.position.set(posX, 0.95, posZ);
        group.userData = {
          subType: 'player',
          physics: {
            rigidbody: {
              enabled: true,
              type: 'kinematic',
              mass: 75,
              restitution: 0.0,
              friction: 0.2,
              lockRotations: true,
            },
            collider: {
              shape: 'capsule',
              radius: 0.45,
              height: 1.8,
            },
            characterController: {
              enabled: true,
              mode: 'thirdPerson',
              speed: 7.0,
              jumpForce: 8.5,
              isGrounded: true,
              cameraDistance: 5.5,
            },
          },
        };
        newObject = group;
        break;
      }
      case 'particles': {
        const group = new THREE.Group();
        group.position.set(posX, 1.0, posZ);
        name = `Emitter_Fire_${this.objects.size + 1}`;
        const fireConfig = ParticleManager.getDefaultPresetConfig('fire');
        const emitterId = `sc_p_${Date.now()}`;

        group.userData = {
          subType: 'particles',
          particles: fireConfig,
          emitterId,
        };

        if (this.particleManager) {
          this.particleManager.createOrUpdateEmitter(emitterId, fireConfig, group.position, group);
        }

        newObject = group;
        break;
      }
      case 'vehicle': {
        newObject = this.createVehicleGroup(posX, posZ);
        name = `Voiture_3D_${this.objects.size + 1}`;
        break;
      }
      case 'triggerVolume': {
        const geo = new THREE.BoxGeometry(3, 3, 3);
        const mat = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, wireframe: true, transparent: true, opacity: 0.6 });
        newObject = new THREE.Mesh(geo, mat);
        name = `TriggerVolume_${this.objects.size + 1}`;
        let posY = 1.5;
        if (this.terrainGenerator) posY = this.terrainGenerator.getHeightAt(posX, posZ) + 1.5;
        newObject.position.set(posX, posY, posZ);
        newObject.userData = {
          subType: 'triggerVolume',
          logic: {
            activeLevel: 'cards',
            cards: [
              {
                id: `card_${Date.now()}`,
                type: 'TriggerVolume',
                enabled: true,
                config: {
                  shape: 'box',
                  size: { x: 3, y: 3, z: 3 },
                  radius: 2,
                  triggerOn: 'Player',
                  actionType: 'checkpoint',
                  checkpointName: 'Checkpoint ' + (this.objects.size + 1),
                  soundPreset: 'chime',
                  repeatable: false,
                  cooldown: 1.0,
                  visualFeedback: true,
                  triggerMessage: 'Checkpoint Activé !',
                },
              },
            ],
            nodeGraph: { enabled: false, nodes: [], connections: [], variables: {} },
            customScript: { enabled: false, code: '' },
          },
        };
        break;
      }
      case 'checkpoint': {
        const group = new THREE.Group();
        const baseGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 32);
        const baseMat = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.8, emissive: 0x059669, emissiveIntensity: 0.4 });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        group.add(baseMesh);

        const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.8, 16);
        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x34d399, emissive: 0x059669, emissiveIntensity: 0.8 });
        const pillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
        pillarMesh.position.y = 0.9;
        group.add(pillarMesh);

        name = `Checkpoint_${this.objects.size + 1}`;
        let posY = 0.1;
        if (this.terrainGenerator) posY = this.terrainGenerator.getHeightAt(posX, posZ) + 0.1;
        group.position.set(posX, posY, posZ);
        group.userData = {
          subType: 'checkpoint',
          logic: {
            activeLevel: 'cards',
            cards: [
              {
                id: `card_${Date.now()}`,
                type: 'TriggerVolume',
                enabled: true,
                config: {
                  shape: 'box',
                  size: { x: 2.5, y: 3, z: 2.5 },
                  radius: 1.8,
                  triggerOn: 'Player',
                  actionType: 'checkpoint',
                  checkpointName: 'Point de Réapparition ' + (this.objects.size + 1),
                  soundPreset: 'chime',
                  repeatable: false,
                  cooldown: 1.0,
                  visualFeedback: true,
                  triggerMessage: 'Point de Réapparition Enregistré !',
                },
              },
            ],
            nodeGraph: { enabled: false, nodes: [], connections: [], variables: {} },
            customScript: { enabled: false, code: '' },
          },
        };
        newObject = group;
        break;
      }
      case 'navMeshAgent': {
        const group = new THREE.Group();
        const bodyGeo = new THREE.CapsuleGeometry(0.5, 1.0, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4, metalness: 0.2 });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 0.9;
        group.add(bodyMesh);

        const eyeGeo = new THREE.SphereGeometry(0.12, 12, 12);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.2, 1.2, -0.4);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.2, 1.2, -0.4);
        group.add(eyeL);
        group.add(eyeR);

        name = `PNJ_AStar_${this.objects.size + 1}`;
        let posY = 0;
        if (this.terrainGenerator) posY = this.terrainGenerator.getHeightAt(posX, posZ);
        group.position.set(posX, posY, posZ);
        group.userData = {
          subType: 'navMeshAgent',
          logic: {
            activeLevel: 'cards',
            cards: [
              {
                id: `card_${Date.now()}`,
                type: 'NavMeshAgent',
                enabled: true,
                config: {
                  targetType: 'Player',
                  speed: 3.8,
                  stoppingDistance: 1.2,
                  acceleration: 8,
                  angularSpeed: 10,
                  autoRepath: true,
                  repathInterval: 0.5,
                  avoidanceRadius: 0.6,
                  avoidWater: true,
                  maxSlopeAngle: 45,
                },
              },
            ],
            nodeGraph: { enabled: false, nodes: [], connections: [], variables: {} },
            customScript: { enabled: false, code: '' },
          },
        };
        newObject = group;
        break;
      }
    }

    newObject.name = name;
    this.registerObject(newObject);
    this.selectObject(newObject);
    this.notifyHierarchy();

    this.saveHistoryState();

    return this.toSceneNode(newObject);
  }

  /**
   * Adds a procedural animated River to the scene and auto-carves terrain bed
   */
  public addRiver(
    config?: Partial<RiverConfig>,
    dropPos?: { x: number; y: number; z: number }
  ): SceneNode {
    const river = new RiverMesh(config);
    const posX = dropPos ? dropPos.x : 0;
    const posZ = dropPos ? dropPos.z : 0;

    let posY = dropPos ? dropPos.y : 0.4;
    if (this.terrainGenerator && !dropPos) {
      posY = Math.max(0.2, this.terrainGenerator.getHeightAt(posX, posZ) + 0.3);
    }

    river.mesh.position.set(posX, posY, posZ);
    river.setSunDirection(this.dirLight.position, this.dirLight.color);

    this.scene.add(river.mesh);
    this.riverMeshes.push(river);
    this.registerObject(river.mesh);

    // Auto-carve river bed into terrain if enabled
    if (this.terrainGenerator && river.config.autoCarveTerrain !== false) {
      this.terrainGenerator.carveRiverBed(river);
    }

    this.selectObject(river.mesh);
    this.notifyHierarchy();

    this.saveHistoryState();

    return this.toSceneNode(river.mesh);
  }

  /**
   * Constructs a procedural high-detail 3D Sports Car
   */
  private createVehicleGroup(posX: number, posZ: number): THREE.Group {
    const vehicleGroup = new THREE.Group();
    vehicleGroup.position.set(posX, 0.45, posZ);

    // 1. Chassis Body Group (for suspension pitch & roll animations)
    const chassisGroup = new THREE.Group();
    chassisGroup.name = 'ChassisBody';

    // Main Car Body Mesh (Sleek sports car lower body)
    const bodyGeo = new THREE.BoxGeometry(1.9, 0.65, 4.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7, // Sports Car Ocean Blue
      metalness: 0.85,
      roughness: 0.15,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.set(0, 0.4, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    // Cockpit Roof / Glass Cabin
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.55, 2.0);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.95,
      roughness: 0.05,
      transparent: true,
      opacity: 0.85,
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, cabinMat);
    cabinMesh.position.set(0, 0.9, -0.2);
    cabinMesh.castShadow = true;
    chassisGroup.add(cabinMesh);

    // LED Headlights (Front - Cyan/White emissive)
    const headGeo = new THREE.BoxGeometry(0.35, 0.12, 0.1);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 2.5,
    });
    const headL = new THREE.Mesh(headGeo, headMat);
    headL.position.set(-0.65, 0.42, -1.98);
    const headR = new THREE.Mesh(headGeo, headMat);
    headR.position.set(0.65, 0.42, -1.98);
    chassisGroup.add(headL, headR);

    // Rear Tail Lights (Back - Red emissive)
    const tailGeo = new THREE.BoxGeometry(0.4, 0.12, 0.1);
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 2.0,
    });
    const tailL = new THREE.Mesh(tailGeo, tailMat);
    tailL.position.set(-0.65, 0.45, 1.98);
    const tailR = new THREE.Mesh(tailGeo, tailMat);
    tailR.position.set(0.65, 0.45, 1.98);
    chassisGroup.add(tailL, tailR);

    // Rear Spoiler Wing
    const spoilerWingGeo = new THREE.BoxGeometry(1.8, 0.08, 0.35);
    const spoilerWingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const spoilerWing = new THREE.Mesh(spoilerWingGeo, spoilerWingMat);
    spoilerWing.position.set(0, 1.15, 1.8);
    chassisGroup.add(spoilerWing);

    vehicleGroup.add(chassisGroup);

    // 2. 4 Wheels with Alloy Rims
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 24);
    wheelGeo.rotateZ(Math.PI / 2); // Orient horizontal
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });

    const createWheel = (name: string, posX: number, posY: number, posZ: number) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.name = name;
      wheelGroup.position.set(posX, posY, posZ);

      const tireMesh = new THREE.Mesh(wheelGeo, tireMat);
      tireMesh.castShadow = true;
      wheelGroup.add(tireMesh);

      // Alloy Rim Cap
      const rimGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.29, 12);
      rimGeo.rotateZ(Math.PI / 2);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rimMesh);

      return wheelGroup;
    };

    const wheelFL = createWheel('Wheel_FL', -0.92, 0.35, -1.2);
    const wheelFR = createWheel('Wheel_FR', 0.92, 0.35, -1.2);
    const wheelRL = createWheel('Wheel_RL', -0.92, 0.35, 1.2);
    const wheelRR = createWheel('Wheel_RR', 0.92, 0.35, 1.2);

    vehicleGroup.add(wheelFL, wheelFR, wheelRL, wheelRR);

    // Attach Vehicle Controller Physics Data
    vehicleGroup.userData = {
      subType: 'vehicle',
      physics: {
        rigidbody: {
          enabled: true,
          type: 'kinematic',
          mass: 1200,
          restitution: 0.1,
          friction: 0.8,
        },
        collider: {
          shape: 'box',
          size: { x: 2.0, y: 1.2, z: 4.2 },
        },
        vehicleController: {
          enabled: true,
          engineForce: 55.0,
          maxSpeed: 140.0,
          brakeForce: 70.0,
          steerAngle: 32,
          suspensionStiffness: 35.0,
          suspensionDamping: 4.5,
          suspensionRestLength: 0.6,
          gripFriction: 0.85,
          cameraDistance: 7.5,
          cameraHeight: 2.5,
        },
      },
    };

    return vehicleGroup;
  }

  /**
   * Import GLTF/GLB File with automatic DRACO decoding, normal recalculation,
   * bounding box centering, ground elevation, and shadow mapping.
   */
  public playSkeletalAnimation(entityId: string, animationName: string): void {
    const obj = this.objects.get(entityId);
    if (!obj) return;

    const animations = obj.userData.animations as THREE.AnimationClip[];
    if (!animations || animations.length === 0) return;

    // Find the requested animation
    const clip = animations.find((a) => a.name === animationName);
    if (!clip) return;
    
    let mixer = this.mixers.get(entityId);
    if (!mixer) {
      mixer = new THREE.AnimationMixer(obj);
      this.mixers.set(entityId, mixer);
    }

    const action = mixer.clipAction(clip);
    
    // If this action is already playing, don't restart it
    if (action.isRunning() && mixer.timeScale > 0) return;

    // Log for debugging in sandbox
    if (this.isPlaying) {
      console.log(`[RigStudio] Playing animation: ${animationName} on ${obj.name}`);
    }

    // Fade out other actions smoothly and fade in this one
    const actions = (mixer as any)._actions || [];
    actions.forEach((act: THREE.AnimationAction) => {
      if (act !== action && act.isRunning()) {
        act.fadeOut(0.2);
      }
    });

    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    action.fadeIn(0.2);
    action.play();
  }

  /**
   * Append animations from an external GLB/GLTF file to an existing model
   */
  public async appendAnimationsToModel(
    targetId: string,
    source: File | ArrayBuffer,
    customClipPrefix?: string
  ): Promise<string[]> {
    const targetObj = this.objects.get(targetId);
    if (!targetObj) throw new Error("Objet 3D cible introuvable.");

    let arrayBuffer: ArrayBuffer;
    let fileName = 'Animation';
    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
      fileName = source.name.replace(/\.[^/.]+$/, '');
    } else {
      arrayBuffer = source;
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          if (!gltf.animations || gltf.animations.length === 0) {
            reject(new Error("Aucune piste d'animation trouvée dans ce fichier."));
            return;
          }

          if (!targetObj.userData) targetObj.userData = {};
          if (!Array.isArray(targetObj.userData.animations)) {
            targetObj.userData.animations = [];
          }

          const existingAnimations: THREE.AnimationClip[] = targetObj.userData.animations;
          const addedNames: string[] = [];

          gltf.animations.forEach((clip, index) => {
            // Rename generic or colliding clip names (e.g. mixamo.com or Take 001) using file name
            let clipName = clip.name;
            if (
              !clipName ||
              clipName === 'mixamo.com' ||
              clipName === 'Armature|mixamo.com' ||
              clipName.startsWith('Take ') ||
              clipName === 'ArmatureAction'
            ) {
              clipName = gltf.animations.length === 1 ? fileName : `${fileName}_${index + 1}`;
            } else if (customClipPrefix) {
              clipName = `${customClipPrefix}_${clipName}`;
            }

            // Ensure unique name
            let uniqueName = clipName;
            let counter = 1;
            while (existingAnimations.some((a) => a.name === uniqueName)) {
              uniqueName = `${clipName}_${counter++}`;
            }
            clip.name = uniqueName;

            existingAnimations.push(clip);
            addedNames.push(uniqueName);
          });

          // Update modelInfo
          if (targetObj.userData.modelInfo) {
            targetObj.userData.modelInfo.animations = existingAnimations.map((a) => a.name);
          } else {
            targetObj.userData.modelInfo = {
              format: 'glb',
              vertexCount: 0,
              triangleCount: 0,
              meshCount: 1,
              fileSize: 'N/A',
              originalName: targetObj.name,
              animations: existingAnimations.map((a) => a.name),
            };
          }

          // If mixer exists, recreate or refresh
          if (this.mixers.has(targetId)) {
            const oldMixer = this.mixers.get(targetId);
            oldMixer?.stopAllAction();
            this.mixers.set(targetId, new THREE.AnimationMixer(targetObj));
          }

          this.notifyHierarchy();
          resolve(addedNames);
        },
        (error) => {
          reject(error);
        }
      );
    });
  }

  public stopSkeletalAnimations(entityId: string): void {
    const mixer = this.mixers.get(entityId);
    if (mixer) {
      // Instead of stopping abruptly, fade out all actions
      const actions = (mixer as any)._actions || [];
      actions.forEach((action: THREE.AnimationAction) => {
        if (action.isRunning()) {
          action.fadeOut(0.25);
        }
      });
    }
  }

  public shootProjectile(entityId: string, prefabId: string, speed: number, damage: number): void {
    const parentObj = this.objects.get(entityId);
    if (!parentObj) return;

    const projectileId = `proj_${Date.now()}_${Math.random()}`;
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(parentObj.quaternion);
    const startPos = parentObj.position.clone()
      .add(forward.clone().multiplyScalar(1.2))
      .add(new THREE.Vector3(0, 1.2, 0));

    // Simple visual for "Fire" shot
    const geo = new THREE.SphereGeometry(0.15, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ 
      color: prefabId.toLowerCase().includes('fire') ? 0xff4400 : 0x00ccff,
      transparent: true,
      opacity: 0.9
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(startPos);
    this.scene.add(mesh);

    // Register
    this.objects.set(projectileId, mesh);

    // VFX
    if (this.particleManager) {
      this.particleManager.createOrUpdateEmitter(projectileId + '_trail', {
        preset: 'fire',
        rate: 30,
        maxParticles: 100,
        size: 0.3,
        speed: 0.5,
        lifetime: 0.4,
        color: prefabId.toLowerCase().includes('fire') ? '#ffaa00' : '#00ffff',
        spread: 0.2,
        gravity: 0,
        loop: true,
        enabled: true
      }, new THREE.Vector3(0, 0, 0), mesh);
    }

    this.activeProjectiles.push({
      id: projectileId,
      mesh,
      direction: forward,
      speed,
      damage,
      timer: 5.0 // 5 seconds max life
    });

    // Sound
    soundManager.playSFX('laser');
  }

  public async importGLTF(
    source: File | ArrayBuffer,
    fileName: string = 'Imported_Model'
  ): Promise<SceneNode> {
    let arrayBuffer: ArrayBuffer;
    let fileSizeStr = 'Unknown';

    if (source instanceof File) {
      arrayBuffer = await source.arrayBuffer();
      fileName = source.name.replace(/\.[^/.]+$/, '');
      const bytes = source.size;
      fileSizeStr =
        bytes > 1048576
          ? `${(bytes / 1048576).toFixed(2)} MB`
          : `${(bytes / 1024).toFixed(1)} KB`;
      
      // Proactive check for multi-file GLTF
      if (source.name.toLowerCase().endsWith('.gltf')) {
        const text = new TextDecoder().decode(arrayBuffer.slice(0, 2000));
        if (text.includes('"uri":') && !text.includes('data:application/octet-stream;base64')) {
          console.warn('Fichier .gltf détecté avec références externes. Les textures risquent de manquer.');
          this.events.onModelImportError?.('Format .gltf détecté. Pour les modèles avec textures, préférez le format .GLB (binaire) qui embarque tout dans un seul fichier.');
        }
      }
    } else {
      arrayBuffer = source;
      fileSizeStr = `${(arrayBuffer.byteLength / 1024).toFixed(1)} KB`;
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.parse(
        arrayBuffer,
        '',
        (gltf) => {
          const root = gltf.scene || gltf.scenes[0];
          if (!root) {
            reject(new Error('Modèle GLTF vide ou invalide.'));
            return;
          }

          root.name = fileName;
          root.userData = root.userData || {};
          root.userData.subType = 'model';

          let vertexCount = 0;
          let triangleCount = 0;
          let meshCount = 0;

          // 1. Process all geometries & materials
          root.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              meshCount++;
              child.castShadow = true;
              child.receiveShadow = true;

              const geo = child.geometry;
              if (geo) {
                // Ensure normals are computed and smooth
                if (!geo.attributes.normal) {
                  geo.computeVertexNormals();
                } else {
                  // Recalculate normals to fix corrupted or flat export normals
                  geo.computeVertexNormals();
                }
                geo.computeBoundingBox();

                if (geo.attributes.position) {
                  vertexCount += geo.attributes.position.count;
                }
                if (geo.index) {
                  triangleCount += geo.index.count / 3;
                } else if (geo.attributes.position) {
                  triangleCount += geo.attributes.position.count / 3;
                }
              }

              // Ensure material is MeshStandardMaterial with PBR
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material = child.material.map((m) => this.ensurePBRMaterial(m));
                } else {
                  child.material = this.ensurePBRMaterial(child.material);
                }
              }
            }
          });

          // 2. Compute bounding box to center pivot and scale if needed
          const bbox = new THREE.Box3().setFromObject(root);
          const size = bbox.getSize(new THREE.Vector3());
          const center = bbox.getCenter(new THREE.Vector3());

          // Auto-normalize scale if gigantic or microscopic
          const maxDim = Math.max(size.x, size.y, size.z);
          let targetScale = 1;
          if (maxDim > 15) {
            targetScale = 4 / maxDim;
          } else if (maxDim < 0.2 && maxDim > 0) {
            targetScale = 1.5 / maxDim;
          }

          // Offset geometry/children so root pivot sits at the base (Y=0) and center (X=0, Z=0)
          const offset = new THREE.Vector3(-center.x, -bbox.min.y, -center.z);
          root.position.copy(offset.multiplyScalar(targetScale));

          // Create wrapper container group so TransformControls can easily rotate/scale
          const modelWrapper = new THREE.Group();
          modelWrapper.name = fileName;
          modelWrapper.scale.setScalar(targetScale);
          modelWrapper.position.set(0, 0, 0);
          modelWrapper.add(root);

          const modelInfo: ModelInfo = {
            format: fileName.endsWith('.glb') ? 'glb' : 'gltf',
            vertexCount: Math.round(vertexCount),
            triangleCount: Math.round(triangleCount),
            meshCount,
            fileSize: fileSizeStr,
            originalName: fileName,
            animations: gltf.animations.map(a => a.name),
          };

          modelWrapper.userData = {
            subType: 'model',
            modelInfo,
            animations: gltf.animations,
          };

          this.registerObject(modelWrapper);
          this.selectObject(modelWrapper);
          this.focusOnObject(modelWrapper.uuid);
          this.notifyHierarchy();

          this.saveHistoryState();

          this.events.onModelImportSuccess?.(fileName, modelInfo);
          resolve(this.toSceneNode(modelWrapper));
        },
        (err) => {
          const message =
            (err as unknown as { message?: string })?.message ||
            'Erreur lors du décodage GLTF/GLB';
          this.events.onModelImportError?.(message);
          reject(new Error(message));
        }
      );
    });
  }

  private ensurePBRMaterial(mat: THREE.Material): THREE.MeshStandardMaterial {
    if (mat instanceof THREE.MeshStandardMaterial) {
      return mat;
    }
    const standard = new THREE.MeshStandardMaterial({
      color: (mat as unknown as { color?: THREE.Color }).color || new THREE.Color(0x94a3b8),
      roughness: 0.4,
      metalness: 0.1,
    });
    return standard;
  }

  public deleteObject(id: string): void {
    if (this.selectedObjects.length > 1 && this.selectedObjects.some((o) => o.uuid === id)) {
      this.dissolveMultiSelectGroup();
      const idsToDelete = this.selectedObjects.map((o) => o.uuid);
      this.deselect();
      idsToDelete.forEach((uuid) => {
        this.deleteSingleObject(uuid);
      });
      this.saveHistoryState();
      return;
    }

    this.deleteSingleObject(id);
    this.saveHistoryState();
  }

  private deleteSingleObject(id: string): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    if (this.waterManager && obj === this.waterManager.waterMesh) {
      this.waterManager.config.enabled = false;
      if (this.atmosphereManager?.atmosphere?.water) {
        this.atmosphereManager.atmosphere.water.enabled = false;
      }
    }

    const riverIdx = this.riverMeshes.findIndex((r) => r.mesh === obj);
    if (riverIdx !== -1) {
      this.riverMeshes[riverIdx].dispose();
      this.riverMeshes.splice(riverIdx, 1);
    }

    if (this.selectedObject?.uuid === id) {
      this.deselect();
    }

    this.scene.remove(obj);
    this.objects.delete(id);
    this.mixers.delete(id);
    this.smoothedEntitySpeeds.delete(id);
    this.blendTreeActions.delete(id);
    this.originalMaterials.delete(id);
    this.ecsWorld.removeEntity(id);

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });

    this.notifyHierarchy();
  }

  public duplicateObject(id: string): void {
    if (this.selectedObjects.length > 1 && this.selectedObjects.some((o) => o.uuid === id)) {
      this.duplicateSelectedObjects();
      return;
    }

    this.duplicateSingleObject(id);
    this.saveHistoryState();
  }

  private duplicateSelectedObjects(): void {
    this.dissolveMultiSelectGroup();

    const newClones: THREE.Object3D[] = [];
    const offset = new THREE.Vector3(1.2, 0, 1.2);

    this.selectedObjects.forEach((source) => {
      let clone: THREE.Object3D;
      if (source instanceof THREE.Mesh) {
        const geo = source.geometry.clone();
        const mat = Array.isArray(source.material)
          ? source.material.map((m) => m.clone())
          : source.material.clone();
        clone = new THREE.Mesh(geo, mat);
        clone.castShadow = source.castShadow;
        clone.receiveShadow = source.receiveShadow;
      } else {
        clone = source.clone(true);
      }

      if (source.userData) {
        clone.userData = JSON.parse(JSON.stringify(source.userData));
      }

      clone.name = `${source.name}_Copy`;
      clone.position.copy(source.position).add(offset);
      this.registerObject(clone);
      newClones.push(clone);
    });

    this.selectedObjects = newClones;
    this.selectedObject = newClones[newClones.length - 1];
    this.recreateMultiSelectGroup();
    this.notifyHierarchy();
    this.saveHistoryState();
  }

  private duplicateSingleObject(id: string): void {
    const source = this.objects.get(id);
    if (!source) return;

    let clone: THREE.Object3D;
    if (source instanceof THREE.Mesh) {
      const geo = source.geometry.clone();
      const mat = Array.isArray(source.material)
        ? source.material.map((m) => m.clone())
        : source.material.clone();
      clone = new THREE.Mesh(geo, mat);
      clone.castShadow = source.castShadow;
      clone.receiveShadow = source.receiveShadow;
    } else {
      clone = source.clone(true);
    }

    if (source.userData) {
      clone.userData = JSON.parse(JSON.stringify(source.userData));
    }

    clone.name = `${source.name}_Copy`;
    clone.position.copy(source.position).add(new THREE.Vector3(1.2, 0, 1.2));
    this.registerObject(clone);
    this.selectObject(clone);
    this.notifyHierarchy();
  }

  public updateRiverConfig(id: string, config: Partial<import('./water/RiverMesh').RiverConfig>): void {
    const obj = this.objects.get(id);
    if (!obj || obj.userData?.subType !== 'river') return;

    const river = this.riverMeshes.find((r) => r.mesh.uuid === id || r.mesh === obj);
    if (river) {
      river.updateConfig(config);
      if (this.terrainGenerator && config.autoCarveTerrain !== false) {
        this.terrainGenerator.carveRiverBed(river);
      }
      this.notifyHierarchy();
      if (this.selectedObject?.uuid === obj.uuid) {
        this.triggerSelectionChange();
      }
    }
  }

  public updateTransform(id: string, transform: Partial<TransformData>): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    if (transform.position) {
      obj.position.set(transform.position.x, transform.position.y, transform.position.z);
      if (this.waterManager && obj === this.waterManager.waterMesh) {
        this.waterManager.config.waterLevel = transform.position.y;
      }
    }
    if (transform.rotation) {
      obj.rotation.set(
        THREE.MathUtils.degToRad(transform.rotation.x),
        THREE.MathUtils.degToRad(transform.rotation.y),
        THREE.MathUtils.degToRad(transform.rotation.z)
      );
    }
    if (transform.scale) {
      obj.scale.set(transform.scale.x, transform.scale.y, transform.scale.z);
    }

    const node = this.toSceneNode(obj);
    this.events.onTransformChange(node);
  }

  /**
   * Advanced PBR Material Update (Albedo Color, Roughness, Metalness, Emission, Normal Map, Roughness Map)
   */
  public updateMaterial(id: string, matData: Partial<MaterialData>): void {
    const obj = this.objects.get(id);
    if (!obj) return;

    this.syncECSComponents(id, matData);

    const applyToStandardMat = (mat: THREE.MeshStandardMaterial) => {
      if (matData.color !== undefined) {
        mat.color.set(matData.color);
      }
      if (matData.roughness !== undefined) {
        mat.roughness = matData.roughness;
      }
      if (matData.metalness !== undefined) {
        mat.metalness = matData.metalness;
      }
      if (matData.wireframe !== undefined) {
        mat.wireframe = matData.wireframe;
      }
      if (matData.opacity !== undefined) {
        mat.opacity = matData.opacity;
      }
      if (matData.transparent !== undefined) {
        mat.transparent = matData.transparent;
      }

      // Emission
      if (matData.emissive !== undefined) {
        mat.emissive.set(matData.emissive);
      }
      if (matData.emissiveIntensity !== undefined) {
        mat.emissiveIntensity = matData.emissiveIntensity;
      }

      // Normal Scale & Maps
      if (matData.normalScale !== undefined) {
        mat.normalScale.set(matData.normalScale, matData.normalScale);
      }

      // Procedural or Custom Normal Map
      if (matData.texturePreset !== undefined || matData.hasNormalMap !== undefined) {
        const preset: TexturePreset =
          matData.texturePreset ?? (obj.userData?.texturePreset || 'carbon');
        const enableNormal =
          matData.hasNormalMap !== undefined
            ? matData.hasNormalMap
            : matData.texturePreset !== 'none';

        if (enableNormal && preset !== 'none') {
          const normalTex = TextureGenerator.getNormalMap(preset);
          mat.normalMap = normalTex;
          if (!mat.normalScale || mat.normalScale.x === 0) {
            mat.normalScale.set(0.6, 0.6);
          }
          obj.userData.hasNormalMap = true;
          obj.userData.texturePreset = preset;
        } else {
          mat.normalMap = null;
          obj.userData.hasNormalMap = false;
        }
      }

      // Roughness Map
      if (matData.hasRoughnessMap !== undefined || matData.texturePreset !== undefined) {
        const preset: TexturePreset =
          matData.texturePreset ?? (obj.userData?.texturePreset || 'carbon');
        const enableRough =
          matData.hasRoughnessMap !== undefined
            ? matData.hasRoughnessMap
            : obj.userData?.hasRoughnessMap;

        if (enableRough && preset !== 'none') {
          const roughTex = TextureGenerator.getRoughnessMap(preset);
          mat.roughnessMap = roughTex;
          obj.userData.hasRoughnessMap = true;
        } else if (enableRough === false) {
          mat.roughnessMap = null;
          obj.userData.hasRoughnessMap = false;
        }
      }

      // Albedo Image Map
      if (matData.mapUrl !== undefined) {
        if (matData.mapUrl) {
          const loader = new THREE.TextureLoader();
          loader.load(matData.mapUrl, (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            const repU = matData.repeatU ?? obj.userData.repeatU ?? 1;
            const repV = matData.repeatV ?? obj.userData.repeatV ?? 1;
            tex.repeat.set(repU, repV);
            mat.map = tex;
            mat.needsUpdate = true;
          });
          obj.userData.mapUrl = matData.mapUrl;
        } else {
          mat.map = null;
          obj.userData.mapUrl = undefined;
        }
      }

      // Repeat U & V Tiling Update
      if (matData.repeatU !== undefined || matData.repeatV !== undefined) {
        const repU = matData.repeatU !== undefined ? matData.repeatU : (obj.userData.repeatU ?? 1);
        const repV = matData.repeatV !== undefined ? matData.repeatV : (obj.userData.repeatV ?? 1);
        obj.userData.repeatU = repU;
        obj.userData.repeatV = repV;

        if (mat.map) {
          mat.map.wrapS = THREE.RepeatWrapping;
          mat.map.wrapT = THREE.RepeatWrapping;
          mat.map.repeat.set(repU, repV);
        }
        if (mat.normalMap) {
          mat.normalMap.wrapS = THREE.RepeatWrapping;
          mat.normalMap.wrapT = THREE.RepeatWrapping;
          mat.normalMap.repeat.set(repU, repV);
        }
        if (mat.roughnessMap) {
          mat.roughnessMap.wrapS = THREE.RepeatWrapping;
          mat.roughnessMap.wrapT = THREE.RepeatWrapping;
          mat.roughnessMap.repeat.set(repU, repV);
        }
      }

      mat.needsUpdate = true;
    };

    if (obj instanceof THREE.Mesh) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => {
          if (m instanceof THREE.MeshStandardMaterial) applyToStandardMat(m);
        });
      } else if (obj.material instanceof THREE.MeshStandardMaterial) {
        applyToStandardMat(obj.material);
      }
    } else if (obj instanceof THREE.Group) {
      // If user selected an imported GLTF group, apply to all child meshes
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => {
              if (m instanceof THREE.MeshStandardMaterial) applyToStandardMat(m);
            });
          } else if (child.material instanceof THREE.MeshStandardMaterial) {
            applyToStandardMat(child.material);
          }
        }
      });
    }

    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  private syncECSComponents(id: string, matData: Partial<MaterialData>): void {
    const entity = this.ecsWorld.getEntity(id);
    if (entity) {
      if (matData.toonIntensity !== undefined) {
        let toonComp = entity.getComponent<ToonMaterialComponent>('ToonMaterial');
        if (!toonComp) {
          toonComp = new ToonMaterialComponent(matData.toonIntensity);
          entity.addComponent(toonComp);
        } else {
          toonComp.colorLevels = matData.toonIntensity;
        }
      }
      if (matData.outlineColor !== undefined) {
        let outlineComp = entity.getComponent<OutlineComponent>('Outline');
        if (!outlineComp) {
          outlineComp = new OutlineComponent(1.0, matData.outlineColor);
          entity.addComponent(outlineComp);
        } else {
          outlineComp.color = matData.outlineColor;
        }
      }
    }
  }

  /**
   * Apply PBR material preset by name
   */
  public applyMaterialPreset(id: string, presetName: string): void {
    const presets: Record<string, Partial<MaterialData>> = {
      gold: {
        color: '#f59e0b',
        roughness: 0.18,
        metalness: 0.95,
        texturePreset: 'brushed',
        hasNormalMap: true,
      },
      chrome: {
        color: '#ffffff',
        roughness: 0.05,
        metalness: 1.0,
        texturePreset: 'none',
        hasNormalMap: false,
      },
      emerald: {
        color: '#10b981',
        roughness: 0.15,
        metalness: 0.4,
        emissive: '#047857',
        emissiveIntensity: 0.15,
      },
      ruby: {
        color: '#e11d48',
        roughness: 0.2,
        metalness: 0.5,
        emissive: '#881337',
        emissiveIntensity: 0.2,
      },
      carbon: {
        color: '#1e293b',
        roughness: 0.4,
        metalness: 0.3,
        texturePreset: 'carbon',
        hasNormalMap: true,
        hasRoughnessMap: true,
      },
      cyberNeon: {
        color: '#06b6d4',
        roughness: 0.2,
        metalness: 0.1,
        emissive: '#00ffff',
        emissiveIntensity: 1.2,
      },
      obsidian: {
        color: '#0f172a',
        roughness: 0.1,
        metalness: 0.8,
        texturePreset: 'none',
      },
      industrialDiamond: {
        color: '#94a3b8',
        roughness: 0.35,
        metalness: 0.8,
        texturePreset: 'diamond',
        hasNormalMap: true,
      },
    };

    const preset = presets[presetName];
    if (preset) {
      this.updateMaterial(id, preset);
    }
  }

  public updateLight(id: string, lightData: Partial<LightData>): void {
    const obj = this.objects.get(id);
    if (!obj || !(obj instanceof THREE.Light)) return;

    if (lightData.color !== undefined) {
      obj.color.set(lightData.color);
    }
    if (lightData.intensity !== undefined) {
      obj.intensity = lightData.intensity;
    }
    if (lightData.distance !== undefined && 'distance' in obj) {
      (obj as THREE.PointLight).distance = lightData.distance;
    }

    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  public updateObjectName(id: string, name: string): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    obj.name = name;
    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  public setVisibility(id: string, visible: boolean): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    obj.visible = visible;

    if (!visible && this.selectedObject?.uuid === id) {
      this.deselect();
    }
    this.notifyHierarchy();
  }

  public setShadows(id: string, cast: boolean, receive: boolean): void {
    const obj = this.objects.get(id);
    if (!obj) return;
    obj.castShadow = cast;
    obj.receiveShadow = receive;

    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = cast;
        child.receiveShadow = receive;
      }
    });

    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }

  public focusOnObject(id?: string): void {
    const targetObj = id ? this.objects.get(id) : this.selectedObject;
    if (!targetObj) return;

    const box = new THREE.Box3().setFromObject(targetObj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);

    this.orbitControls.target.copy(center);
    this.camera.position.set(
      center.x + maxDim * 2,
      center.y + maxDim * 1.5,
      center.z + maxDim * 2
    );
    this.orbitControls.update();
  }

  public resetCamera(): void {
    this.camera.position.set(3, 3, 5);
    this.orbitControls.target.set(0, 0, 0);
    this.camera.lookAt(0, 0, 0);
    this.orbitControls.update();
  }

  public setCameraView(
    view: 'top' | 'bottom' | 'front' | 'back' | 'side' | 'right' | 'left' | 'iso'
  ): void {
    const dist = 12;
    const target = this.selectedObject
      ? this.selectedObject.position.clone()
      : new THREE.Vector3(0, this.workPlaneConfig.height + 0.8, 0);

    this.orbitControls.target.copy(target);

    switch (view) {
      case 'top':
        this.camera.position.set(target.x, target.y + dist, target.z + 0.001);
        break;
      case 'bottom':
        this.camera.position.set(target.x, target.y - dist, target.z + 0.001);
        break;
      case 'front':
        this.camera.position.set(target.x, target.y, target.z + dist);
        break;
      case 'back':
        this.camera.position.set(target.x, target.y, target.z - dist);
        break;
      case 'side':
      case 'right':
        this.camera.position.set(target.x + dist, target.y, target.z);
        break;
      case 'left':
        this.camera.position.set(target.x - dist, target.y, target.z);
        break;
      case 'iso':
      default:
        this.camera.position.set(target.x + 7, target.y + 5.5, target.z + 7.5);
        break;
    }
    this.orbitControls.update();
  }

  /**
   * Updates Terrain configuration & visibility
   */
  public updateTerrainConfig(config: Partial<TerrainConfig>): void {
    if (!this.terrainGenerator) return;
    this.terrainGenerator.config = {
      ...this.terrainGenerator.config,
      ...config,
    };
    if (this.terrainGenerator.mesh) {
      this.terrainGenerator.mesh.visible = this.terrainGenerator.config.enabled;
    }
  }

  public handleResize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    if (this.celShaderPass) {
      this.celShaderPass.setResolution(width, height);
    }
    if (this.atmosphereManager) {
      this.atmosphereManager.setSize(width, height);
    }
  }

  /**
   * Updates Terrain Brush settings from UI
   */
  public setTerrainBrush(brush: Partial<TerrainBrushConfig>): void {
    this.terrainBrush = {
      ...this.terrainBrush,
      ...brush,
    };
    if (this.terrainBrush.mode === 'none') {
      if (this.brushMarkerMesh) this.brushMarkerMesh.visible = false;
      this.orbitControls.enabled = true;
    }
  }

  /**
   * Procedural terrain regeneration
   */
  public regenerateTerrain(seed?: number): void {
    if (!this.terrainGenerator) return;
    if (this.terrainGenerator.mesh) {
      this.scene.remove(this.terrainGenerator.mesh);
    }
    this.terrainGenerator.regenerate(seed);
    if (this.terrainGenerator.mesh) {
      this.scene.add(this.terrainGenerator.mesh);
    }
    if (this.foliagePainter) {
      this.foliagePainter.adjustFoliageHeights(this.terrainGenerator);
    }
  }

  /**
   * Reset/clear foliage layers
   */
  public clearFoliage(): void {
    if (!this.foliagePainter) return;
    this.foliagePainter.clearAll();
  }

  /**
   * Synchronize Water Mesh registration with SceneManager objects map for viewport selection
   */
  public syncWaterMeshRegistration(): void {
    if (!this.waterManager) return;
    const mesh = this.waterManager.waterMesh;
    if (this.waterManager.config.enabled && mesh) {
      if (!mesh.name || mesh.name === '__AETHER_WATER_OCEAN__') {
        mesh.name = "Plan d'Eau (Océan)";
      }
      mesh.userData = { subType: 'water', isWaterSystem: true };
      if (!this.objects.has(mesh.uuid)) {
        this.objects.set(mesh.uuid, mesh);
        this.notifyHierarchy();
      }
    } else if (mesh && this.objects.has(mesh.uuid)) {
      if (this.selectedObject === mesh) {
        this.deselect();
      }
      this.objects.delete(mesh.uuid);
      this.notifyHierarchy();
    }
  }

  /**
   * Update Atmosphere settings
   */
  public updateAtmosphere(data: Partial<AtmosphereData>): void {
    if (!this.atmosphereManager) return;
    this.atmosphereManager.updateAtmosphere(data);

    if (data.water && this.waterManager) {
      this.waterManager.setConfig(data.water);
      this.waterManager.setSunDirection(this.dirLight.position, this.dirLight.color);
      this.syncWaterMeshRegistration();
    }

    if (this.physicsManager.environmentalPhysics) {
      if (data.wind) {
        this.physicsManager.environmentalPhysics.setWindConfig(data.wind);
      }
      if (data.rain) {
        this.physicsManager.environmentalPhysics.setRainConfig(data.rain);
      }
    }
  }

  /**
   * Update Post-Processing settings
   */
  public updatePostProcessing(data: Partial<PostProcessingData>): void {
    if (this.atmosphereManager) {
      this.atmosphereManager.updatePostProcessing(data);
    }
    if (this.composer) {
      this.composer.passes.forEach((pass) => {
        if (pass instanceof UnrealBloomPass) {
          pass.enabled = data.enabled !== false && (data.bloom?.enabled ?? true);
          if (data.bloom) {
            pass.strength = data.bloom.strength ?? 0.5;
            pass.radius = data.bloom.radius ?? 0.4;
            pass.threshold = data.bloom.threshold ?? 0.85;
          }
        }
        if (pass instanceof ShaderPass && pass.material.defines && 'FXAA' in pass.material.defines) {
          pass.enabled = data.enabled !== false;
        }
      });
    }
  }

  /**
   * Toggle 2D Cel-Shading & Toon Cartoon Mode
   */
  public toggle2DEffect(enabled: boolean): void {
    if (this.celShaderPass) {
      this.celShaderPass.setEnabled(enabled);
    }
    if (this.atmosphereManager) {
      this.atmosphereManager.set2DModeEnabled(enabled);
    }
  }

  /**
   * Apply a Sky/Atmosphere preset
   */
  public applySkyPreset(preset: SkyPreset): void {
    if (!this.atmosphereManager) return;
    this.atmosphereManager.applyPreset(preset);
  }

  /**
   * Update HUD configuration
   */
  public updateHUDConfig(config: Partial<HUDConfig>): void {
    this.hudConfig = {
      ...this.hudConfig,
      ...config,
    };
  }

  /**
   * Export Scene to custom structured JSON
   */
  public exportScene(): SceneExportData {
    const exportNodes: SceneExportData['nodes'] = [];

    this.objects.forEach((obj) => {
      const node = this.toSceneNode(obj);
      exportNodes.push({
        id: node.id,
        name: node.name,
        type: node.type,
        subType: node.subType,
        transform: node.transform,
        material: node.material,
        light: node.light,
        physics: node.physics,
        logic: node.logic,
        rigAnim: node.rigAnim,
        modelInfo: node.modelInfo,
        visible: node.visible,
        castShadow: node.castShadow,
        receiveShadow: node.receiveShadow,
      });
    });

    return {
      version: '1.2.0',
      generator: 'Aether 3D Engine Studio',
      timestamp: new Date().toISOString(),
      environment: {
        backgroundColor: this.atmosphereManager ? this.atmosphereManager.atmosphere.fog.color : '#0c0e14',
        ambientIntensity: this.ambientLight.intensity,
        sunIntensity: this.dirLight.intensity,
        sunPosition: {
          x: this.dirLight.position.x,
          y: this.dirLight.position.y,
          z: this.dirLight.position.z,
        },
      },
      atmosphere: this.atmosphereManager ? this.atmosphereManager.atmosphere : undefined,
      postProcessing: this.atmosphereManager ? this.atmosphereManager.postProcessing : undefined,
      terrain: this.terrainGenerator
        ? {
            config: this.terrainGenerator.config,
            heightmap: this.terrainGenerator.exportHeightmap(),
            foliageLayers: this.foliagePainter ? this.foliagePainter.exportLayers() : [],
          }
        : undefined,
      hud: this.hudConfig,
      nodes: exportNodes,
    };
  }

  /**
   * Rebuild and load scene from JSON
   */
  public importScene(data: SceneExportData): void {
    this.clearUserScene();

    if (data.atmosphere && this.atmosphereManager) {
      this.atmosphereManager.updateAtmosphere(data.atmosphere);
    }
    if (data.postProcessing && this.atmosphereManager) {
      this.atmosphereManager.updatePostProcessing(data.postProcessing);
    }
    if (data.hud) {
      this.hudConfig = data.hud;
    }
    if (data.terrain && this.terrainGenerator) {
      if (data.terrain.config) {
        this.terrainGenerator.config = { ...this.terrainGenerator.config, ...data.terrain.config };
      }
      if (data.terrain.heightmap && data.terrain.heightmap.length > 0) {
        this.terrainGenerator.importHeightmap(data.terrain.heightmap);
      }
      if (data.terrain.foliageLayers && this.foliagePainter) {
        this.foliagePainter.importLayers(data.terrain.foliageLayers);
        this.foliagePainter.adjustFoliageHeights(this.terrainGenerator);
      }
    }

    if (data.environment) {
      this.ambientLight.intensity = data.environment.ambientIntensity || 0.85;
      this.dirLight.intensity = data.environment.sunIntensity || 2.2;
      if (data.environment.sunPosition) {
        this.dirLight.position.set(
          data.environment.sunPosition.x,
          data.environment.sunPosition.y,
          data.environment.sunPosition.z
        );
      }
    }

    if (Array.isArray(data.nodes)) {
      data.nodes.forEach((item) => {
        let created: THREE.Object3D | null = null;
        const subType = item.subType || 'cube';

        if (item.type === 'mesh') {
          const mat = new THREE.MeshStandardMaterial({
            color: item.material?.color || '#3b82f6',
            roughness: item.material?.roughness ?? 0.35,
            metalness: item.material?.metalness ?? 0.2,
            wireframe: item.material?.wireframe ?? false,
            opacity: item.material?.opacity ?? 1,
            transparent: item.material?.transparent ?? false,
            emissive: new THREE.Color(item.material?.emissive || '#000000'),
            emissiveIntensity: item.material?.emissiveIntensity || 0,
          });

          if (item.material?.texturePreset && item.material.texturePreset !== 'none') {
            const normalTex = TextureGenerator.getNormalMap(item.material.texturePreset);
            if (normalTex) {
              mat.normalMap = normalTex;
              mat.normalScale.set(0.6, 0.6);
            }
          }

          let geo: THREE.BufferGeometry;
          switch (subType) {
            case 'sphere':
              geo = new THREE.SphereGeometry(0.9, 36, 36);
              break;
            case 'cylinder':
              geo = new THREE.CylinderGeometry(0.75, 0.75, 1.8, 36);
              break;
            case 'plane':
              geo = new THREE.PlaneGeometry(3, 3);
              break;
            case 'torus':
              geo = new THREE.TorusGeometry(0.8, 0.25, 24, 48);
              break;
            case 'cone':
              geo = new THREE.ConeGeometry(0.9, 1.8, 32);
              break;
            case 'cube':
            default:
              geo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
              break;
          }

          created = new THREE.Mesh(geo, mat);
          created.userData = { subType, texturePreset: item.material?.texturePreset };
        } else if (item.type === 'light') {
          if (subType === 'point') {
            const light = new THREE.PointLight(
              item.light?.color || 0x38bdf8,
              item.light?.intensity || 3.5,
              item.light?.distance || 18
            );
            light.add(new THREE.PointLightHelper(light, 0.3));
            created = light;
            created.userData = { subType: 'point' };
          } else {
            created = new THREE.DirectionalLight(
              item.light?.color || 0xffffff,
              item.light?.intensity || 2.0
            );
            created.userData = { subType: 'directional' };
          }
        }

        if (created) {
          created.name = item.name;
          created.position.set(
            item.transform.position.x,
            item.transform.position.y,
            item.transform.position.z
          );
          created.rotation.set(
            THREE.MathUtils.degToRad(item.transform.rotation.x),
            THREE.MathUtils.degToRad(item.transform.rotation.y),
            THREE.MathUtils.degToRad(item.transform.rotation.z)
          );
          created.scale.set(
            item.transform.scale.x,
            item.transform.scale.y,
            item.transform.scale.z
          );
          created.visible = item.visible;
          created.castShadow = item.castShadow;
          created.receiveShadow = item.receiveShadow;
          if (item.physics) {
            created.userData = created.userData || {};
            created.userData.physics = item.physics;
          }
          if (item.logic) {
            created.userData = created.userData || {};
            created.userData.logic = item.logic;
          }
          if (item.modelInfo) {
            created.userData = created.userData || {};
            created.userData.modelInfo = item.modelInfo;
          }
          if (item.rigAnim) {
            created.userData = created.userData || {};
            created.userData.rigAnim = item.rigAnim;
          }

          this.registerObject(created);

          if (item.rigAnim) {
            this.setRigAnim(created.uuid, item.rigAnim);
          }
        }
      });
    }

    this.notifyHierarchy();
    this.resetCamera();
  }

  public clearUserScene(): void {
    this.deselect();
    this.objects.forEach((obj) => {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });
    });
    this.riverMeshes.forEach((r) => r.dispose());
    this.riverMeshes = [];
    this.objects.clear();
    this.originalMaterials.clear();
    this.notifyHierarchy();
  }

  private toSceneNode(obj: THREE.Object3D): SceneNode {
    let type: SceneNode['type'] = 'mesh';
    let material: MaterialData | undefined = undefined;
    let light: LightData | undefined = undefined;
    let physics: PhysicsNodeData | undefined = undefined;

    // Retrieve physics configuration
    if (obj.userData?.physics) {
      physics = JSON.parse(JSON.stringify(obj.userData.physics));
    } else {
      const entity = this.ecsWorld.getEntity(obj.uuid);
      if (entity) {
        const rb = entity.getComponent<RigidbodyComponent>('Rigidbody');
        const col = entity.getComponent<ColliderComponent>('Collider');
        const cc = entity.getComponent<CharacterControllerComponent>('CharacterController');
        if (rb || col || cc) {
          physics = {
            rigidbody: rb?.toData(),
            collider: col?.toData(),
            characterController: cc?.toData(),
          };
        }
      }
    }

    let targetMesh: THREE.Mesh | null = null;
    if (obj instanceof THREE.Mesh) {
      targetMesh = obj;
      type = 'mesh';
    } else if (obj instanceof THREE.Group) {
      type = 'group';
      // Find first mesh in group for previewing materials
      obj.traverse((child) => {
        if (!targetMesh && child instanceof THREE.Mesh) {
          targetMesh = child;
        }
      });
    } else if (obj instanceof THREE.Light) {
      type = 'light';
      light = {
        color: `#${obj.color.getHexString()}`,
        intensity: obj.intensity,
        distance: 'distance' in obj ? (obj as THREE.PointLight).distance : undefined,
      };
    }

    if (targetMesh && targetMesh.material) {
      let mat = targetMesh.material;
      if (Array.isArray(mat)) mat = mat[0];

      if (mat instanceof THREE.MeshStandardMaterial) {
        material = {
          color: `#${mat.color.getHexString()}`,
          roughness: mat.roughness,
          metalness: mat.metalness,
          wireframe: mat.wireframe,
          opacity: mat.opacity,
          transparent: mat.transparent,
          emissive: `#${mat.emissive.getHexString()}`,
          emissiveIntensity: mat.emissiveIntensity,
          normalScale: mat.normalScale ? mat.normalScale.x : 1,
          hasNormalMap: Boolean(mat.normalMap),
          hasRoughnessMap: Boolean(mat.roughnessMap),
          texturePreset: obj.userData?.texturePreset || 'none',
        };
      }
    }

    let logic: EntityLogicData | undefined = undefined;
    if (obj.userData?.logic) {
      logic = JSON.parse(JSON.stringify(obj.userData.logic));
    }

    let rigAnim: RigAnimData | undefined = undefined;
    if (obj.userData?.rigAnim) {
      rigAnim = JSON.parse(JSON.stringify(obj.userData.rigAnim));
    } else {
      const entity = this.ecsWorld.getEntity(obj.uuid);
      const rigComp = entity?.getComponent<RigAnimComponent>('RigAnim');
      if (rigComp) {
        rigAnim = rigComp.toData();
      }
    }

    return {
      id: obj.uuid,
      name: obj.name || 'Unnamed',
      type,
      subType: obj.userData?.subType,
      visible: obj.visible,
      castShadow: obj.castShadow,
      receiveShadow: obj.receiveShadow,
      transform: {
        position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
        rotation: {
          x: THREE.MathUtils.radToDeg(obj.rotation.x),
          y: THREE.MathUtils.radToDeg(obj.rotation.y),
          z: THREE.MathUtils.radToDeg(obj.rotation.z),
        },
        scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      },
      material,
      light,
      physics,
      logic,
      rigAnim,
      childrenCount: obj.children.length,
      modelInfo: obj.userData?.modelInfo,
      riverConfig: obj.userData?.riverConfig,
      particles: obj.userData?.particles,
    };
  }

  public updateParticlesConfig(id: string, config: Partial<ParticleEmitterData>): void {
    const obj = this.objects.get(id);
    if (!obj || obj.userData?.subType !== 'particles') return;

    const currentParticles = obj.userData.particles || {};
    const updatedParticles = {
      ...currentParticles,
      ...config,
    };
    obj.userData.particles = updatedParticles;

    // Recreate or update the active emitter inside the particle manager
    if (this.particleManager && obj.userData.emitterId) {
      this.particleManager.createOrUpdateEmitter(
        obj.userData.emitterId,
        updatedParticles,
        obj.position,
        obj
      );
    }

    this.notifyHierarchy();
    if (this.selectedObject?.uuid === id) {
      this.triggerSelectionChange();
    }
  }



  public getSceneHierarchy(): SceneNode[] {
    const nodes: SceneNode[] = [];
    this.scene.children.forEach((obj) => {
      if (this.objects.has(obj.uuid)) {
        nodes.push(this.toSceneNode(obj));
      }
    });
    return nodes;
  }

  private notifyHierarchy(): void {
    const nodes: SceneNode[] = [];
    this.objects.forEach((obj) => {
      nodes.push(this.toSceneNode(obj));
    });
    this.events.onHierarchyChange(nodes);
  }

  // Optimized Loop
  private animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    this.frameCount++;
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
    this.lastFrameTime = now;

    if (now - this.lastFpsTime >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / (now - this.lastFpsTime));
      this.frameCount = 0;
      this.lastFpsTime = now;

      const stats: EngineStats = {
        fps: this.currentFps,
        triangles: this.renderer.info.render.triangles,
        drawCalls: this.renderer.info.render.calls,
        objectsCount: this.objects.size,
        physicsBodiesCount: this.physicsManager.getBodiesCount(),
      };
      this.events.onStatsUpdate(stats);
    }

    let isFollowingPlayer = false;

    if (this.isPlaying) {
      // Step Physics Simulation and ECS Systems
      this.ecsWorld.update(dt);
      this.logicExecutor.update(dt);

      // Smooth Camera Follow Player in Third Person
      const entities = this.ecsWorld.getAllEntities();
      const playerEntity = entities.find(
        (e) =>
          e.active && (
            e.object3D?.userData?.subType === 'player' ||
            e.hasComponent('CharacterController') ||
            e.name.toLowerCase().includes('player')
          )
      );

      if (playerEntity && playerEntity.object3D) {
        const charComp = playerEntity.getComponent<any>('CharacterController');
        const mode = charComp?.mode || 'thirdPerson';

        if (mode === 'thirdPerson') {
          const playerObj = playerEntity.object3D;
          const targetPos = playerObj.position.clone();
          
          // Get customizable camera properties
          const camDist = charComp?.cameraDistance !== undefined ? charComp.cameraDistance : 6.0;
          const camHeight = charComp?.cameraHeight !== undefined ? charComp.cameraHeight : 3.5;
          const camOffsetX = charComp?.cameraOffsetX !== undefined ? charComp.cameraOffsetX : 0.0;
          const lerpSpeed = charComp?.cameraLerpSpeed !== undefined ? charComp.cameraLerpSpeed : 10.0;

          // Static offset behind, above, and laterally from player
          const offset = new THREE.Vector3(camOffsetX, camHeight, -camDist);
          const desiredCameraPos = targetPos.clone().add(offset);

          // Smooth lerp camera position
          const lerpFactor = 1.0 - Math.exp(-lerpSpeed * dt);
          this.camera.position.lerp(desiredCameraPos, lerpFactor);
          this.camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, 1.2, 0)));

          this.orbitControls.enabled = false;
          isFollowingPlayer = true;
        } else {
          // In firstPerson mode, character system handles camera placement (at eye level)
          this.orbitControls.enabled = false;
          isFollowingPlayer = true;
        }
      }
    }

    if (this.particleManager) {
      this.particleManager.update(dt);
    }

    // Update Environmental Visuals (Wind streaks, Rain particles, Lightning, Audio)
    if (this.physicsManager.environmentalPhysics) {
      this.physicsManager.environmentalPhysics.updateVisuals(dt, this.camera);
    }

    if (this.animationManager) {
      this.animationManager.update(dt, this.objects);
      this.animationManager.renderTrajectoryOverlay(
        this.selectedObject?.uuid || null,
        this.objects
      );
    }

    // Update skeletal animations
    this.mixers.forEach((mixer) => mixer.update(dt));

    // Update Rigging Systems (Auto-animations, Vehicles)
    if (this.isPlaying) {
      this.updateRigSystems(dt);
    }

    // Update projectiles
    for (let i = this.activeProjectiles.length - 1; i >= 0; i--) {
      const p = this.activeProjectiles[i];
      p.timer -= dt;
      p.mesh.position.add(p.direction.clone().multiplyScalar(p.speed * dt));

      let hasCollided = false;
      if (this.isPlaying) {
        const pPos = p.mesh.position;
        const entities = this.ecsWorld.getAllEntities();
        for (const target of entities) {
          if (!target.active || !target.object3D) continue;
          const targetPos = new THREE.Vector3();
          target.object3D.getWorldPosition(targetPos);

          // Test hit if projectile is close to target (within 1.2m radius)
          if (pPos.distanceTo(targetPos) < 1.3) {
            hasCollided = true;

            // SFX & Hit Spark Particles
            soundManager.playSFX('explosion');
            if (this.particleManager) {
              this.particleManager.createOrUpdateEmitter(
                `hit_${Date.now()}`,
                {
                  preset: 'sparks',
                  rate: 30,
                  maxParticles: 20,
                  lifetime: 0.35,
                  speed: 3.0,
                  color: '#ff6622',
                  size: 0.18,
                  gravity: -6,
                  spread: 1.2,
                  loop: false,
                  enabled: true,
                },
                pPos.clone()
              );
            }

            // Spawn floating damage indicator
            this.logicExecutor.floatingTexts.push({
              id: `hit_dmg_${Date.now()}`,
              text: `-${p.damage} HP`,
              x: targetPos.x,
              y: targetPos.y + 1.2,
              z: targetPos.z,
              color: '#f43f5e',
              timer: 1.5,
            });

            // Trigger physical ragdoll with impact knockback
            const knockback = p.direction.clone().multiplyScalar(p.speed * 0.85);
            knockback.y += 1.2;
            this.triggerRagdoll(target.id, knockback);

            // Execute logic node action on player if applicable
            if (target.hasComponent('CharacterController')) {
              this.logicExecutor.globalState.health = Math.max(
                0,
                this.logicExecutor.globalState.health - p.damage
              );
              this.logicExecutor.dispatchAllVariables();
            }
            break;
          }
        }
      }

      if (p.timer <= 0 || hasCollided) {
        this.scene.remove(p.mesh);
        this.objects.delete(p.id);
        if (this.particleManager) this.particleManager.stopEmitter(p.id + '_trail');
        this.activeProjectiles.splice(i, 1);
      }
    }

    if (!isFollowingPlayer && !this.isTransformDragging) {
      this.orbitControls.enabled = true;
      this.orbitControls.update();
    } else if (this.isTransformDragging) {
      this.orbitControls.enabled = false;
    }

    if (this.atmosphereManager) {
      this.atmosphereManager.update(dt);
    }
    if (this.waterManager) {
      this.waterManager.update(dt, this.camera.position);
      this.waterManager.setSunDirection(this.dirLight.position, this.dirLight.color);
    }
    if (this.riverMeshes.length > 0) {
      for (const river of this.riverMeshes) {
        river.update(dt);
        river.setSunDirection(this.dirLight.position, this.dirLight.color);
      }
    }

    if (this.atmosphereManager) {
      this.atmosphereManager.render(dt);
    } else {
      this.composer.render();
    }
  };

  public setRigAnim(id: string, data: Partial<RigAnimData>): void {
    const entity = this.ecsWorld.getEntity(id);
    if (!entity) return;

    let rigComp = entity.getComponent<RigAnimComponent>('RigAnim');
    if (!rigComp) {
      rigComp = new RigAnimComponent(data);
      entity.addComponent(rigComp);
    } else {
      if (data.enabled !== undefined) rigComp.enabled = data.enabled;
      if (data.rigType !== undefined) rigComp.rigType = data.rigType;
      if (data.animationMapping !== undefined) rigComp.mapping = data.animationMapping;
      if (data.autoAnimate !== undefined) rigComp.autoAnimate = data.autoAnimate;
      if (data.blendTree !== undefined) rigComp.blendTree = data.blendTree;
      if (data.vehicleWheels !== undefined) rigComp.vehicleWheels = data.vehicleWheels;
      if (data.ragdoll !== undefined) rigComp.ragdoll = data.ragdoll;
    }

    // Update object userData for export
    const obj = this.objects.get(id);
    if (obj) {
      obj.userData.rigAnim = rigComp.toData();
    }
  }

  private updateRigSystems(dt: number): void {
    const entities = this.ecsWorld.getAllEntities();
    for (const entity of entities) {
      if (!entity.active || !entity.object3D) continue;

      // Skip skeletal auto-animation if ragdoll physics is currently active
      if (this.physicsManager.isRagdollActive(entity.id)) {
        continue;
      }

      const rigComp = entity.getComponent<RigAnimComponent>('RigAnim');
      if (!rigComp || !rigComp.enabled) continue;

      // 1. Automated Skeletal Animations
      if (rigComp.autoAnimate && (rigComp.rigType === 'biped' || rigComp.rigType === 'quadruped')) {
        this.handleAutoAnimation(entity, rigComp, dt);
      }

      // 2. Vehicle Rigging (Wheels rotation)
      if (rigComp.rigType === 'vehicle' && rigComp.vehicleWheels) {
        this.handleVehicleRigging(entity, rigComp, dt);
      }
    }
  }

  private handleAutoAnimation(entity: Entity, rigComp: RigAnimComponent, dt: number): void {
    const body = this.physicsManager.getEntityRigidbody(entity.id);
    let speed = 0;
    let isGrounded = true;

    // Check physics for speed
    if (body) {
      const vel = body.linvel();
      speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    }

    // Check character controller for grounded state and speed override
    const charComp = entity.getComponent<CharacterControllerComponent>('CharacterController');
    if (charComp) {
      isGrounded = charComp.isGrounded ?? true;
      if (charComp.currentSpeed > 0) {
        speed = charComp.currentSpeed;
      }
    }

    // Use continuous 1D/2D Blend Tree by default unless explicitly disabled
    const useBlendTree = rigComp.blendTree?.enabled !== false;
    if (useBlendTree) {
      this.updateLocomotionBlendTree(entity, rigComp, speed, isGrounded, dt);
      return;
    }

    // Discrete fallback (threshold-based switch)
    const mapping = rigComp.mapping;
    let targetAnim = mapping.idle;

    if (!isGrounded && mapping.jump) {
      targetAnim = mapping.jump;
    } else if (speed > 8.0 && mapping.sprint) {
      targetAnim = mapping.sprint;
    } else if (speed > 4.5 && mapping.run) {
      targetAnim = mapping.run;
    } else if (speed > 0.1 && mapping.walk) {
      targetAnim = mapping.walk;
    }

    if (targetAnim && targetAnim !== '') {
      this.playSkeletalAnimation(entity.id, targetAnim);
    } else {
      // Fallback: stop animations or fade out if nothing is mapped
      this.stopSkeletalAnimations(entity.id);
    }
  }

  /**
   * Continuous 1D/2D Locomotion Blend Tree
   * Dynamically blends weights between Idle, Walk, Run, and Sprint
   * with smooth damping and automatic stride rate adaptation (anti-patinage).
   */
  private updateLocomotionBlendTree(
    entity: Entity,
    rigComp: RigAnimComponent,
    rawSpeed: number,
    isGrounded: boolean,
    dt: number
  ): void {
    const obj = entity.object3D;
    if (!obj || !obj.userData.animations) return;

    const animations = obj.userData.animations as THREE.AnimationClip[];
    if (!animations || animations.length === 0) return;

    let mixer = this.mixers.get(entity.id);
    if (!mixer) {
      mixer = new THREE.AnimationMixer(obj);
      this.mixers.set(entity.id, mixer);
    }

    const mapping = rigComp.mapping;
    const blendTree = rigComp.blendTree || {
      enabled: true,
      mode: '1D_speed',
      walkSpeed: 2.8,
      runSpeed: 6.5,
      sprintSpeed: 9.5,
      damping: 10.0,
      syncPlaybackSpeed: true,
    };

    let actionsMap = this.blendTreeActions.get(entity.id);
    if (!actionsMap) {
      actionsMap = new Map();
      this.blendTreeActions.set(entity.id, actionsMap);
    }

    const getOrInitAction = (clipName?: string): THREE.AnimationAction | null => {
      if (!clipName) return null;
      if (actionsMap!.has(clipName)) {
        return actionsMap!.get(clipName)!;
      }
      const clip = animations.find((a) => a.name === clipName);
      if (!clip) return null;
      const act = mixer!.clipAction(clip);
      act.setLoop(THREE.LoopRepeat, Infinity);
      act.play();
      act.setEffectiveWeight(0);
      actionsMap!.set(clipName, act);
      return act;
    };

    const idleAction = getOrInitAction(mapping.idle);
    const walkAction = getOrInitAction(mapping.walk);
    const runAction = getOrInitAction(mapping.run);
    const sprintAction = getOrInitAction(mapping.sprint);
    const jumpAction = getOrInitAction(mapping.jump);

    // 1. Air / Jump Override State
    if (!isGrounded && jumpAction) {
      jumpAction.setEffectiveWeight(
        THREE.MathUtils.lerp(jumpAction.getEffectiveWeight(), 1.0, Math.min(1.0, dt * 12))
      );
      idleAction?.setEffectiveWeight(
        THREE.MathUtils.lerp(idleAction.getEffectiveWeight(), 0.0, Math.min(1.0, dt * 10))
      );
      walkAction?.setEffectiveWeight(
        THREE.MathUtils.lerp(walkAction.getEffectiveWeight(), 0.0, Math.min(1.0, dt * 10))
      );
      runAction?.setEffectiveWeight(
        THREE.MathUtils.lerp(runAction.getEffectiveWeight(), 0.0, Math.min(1.0, dt * 10))
      );
      sprintAction?.setEffectiveWeight(
        THREE.MathUtils.lerp(sprintAction.getEffectiveWeight(), 0.0, Math.min(1.0, dt * 10))
      );
      return;
    } else if (jumpAction && jumpAction.getEffectiveWeight() > 0.01) {
      jumpAction.setEffectiveWeight(
        THREE.MathUtils.lerp(jumpAction.getEffectiveWeight(), 0.0, Math.min(1.0, dt * 10))
      );
    }

    // 2. Smooth Speed Interpolation
    let currentSmoothed = this.smoothedEntitySpeeds.get(entity.id) ?? rawSpeed;
    const damping = blendTree.damping || 10.0;
    currentSmoothed = THREE.MathUtils.lerp(currentSmoothed, rawSpeed, Math.min(1.0, dt * damping));
    this.smoothedEntitySpeeds.set(entity.id, currentSmoothed);

    // 3. Compute continuous proportional weights
    const walkThresh = blendTree.walkSpeed || 2.8;
    const runThresh = blendTree.runSpeed || 6.5;
    const sprintThresh = blendTree.sprintSpeed || 9.5;

    let targetIdleWeight = 0;
    let targetWalkWeight = 0;
    let targetRunWeight = 0;
    let targetSprintWeight = 0;

    // 2D directional check (detect reverse locomotion)
    let moveDirection = 1.0;
    if (blendTree.mode === '2D_directional') {
      const body = this.physicsManager.getEntityRigidbody(entity.id);
      if (body) {
        const vel = body.linvel();
        const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.quaternion);
        const dot = fwd.x * vel.x + fwd.z * vel.z;
        if (dot < -0.15) moveDirection = -1.0;
      }
    }

    if (currentSmoothed <= 0.08) {
      // Idle
      targetIdleWeight = 1.0;
    } else if (!walkAction && runAction) {
      // Only Idle and Run available
      const t = Math.min(1.0, (currentSmoothed - 0.08) / Math.max(0.1, runThresh - 0.08));
      targetIdleWeight = 1.0 - t;
      targetRunWeight = t;
    } else if (walkAction && !runAction) {
      // Only Idle and Walk available
      const t = Math.min(1.0, (currentSmoothed - 0.08) / Math.max(0.1, walkThresh - 0.08));
      targetIdleWeight = 1.0 - t;
      targetWalkWeight = t;
    } else if (currentSmoothed <= walkThresh) {
      // Idle -> Walk continuous blend
      const t = (currentSmoothed - 0.08) / Math.max(0.01, walkThresh - 0.08);
      targetIdleWeight = 1.0 - t;
      targetWalkWeight = t;
    } else if (currentSmoothed <= runThresh) {
      // Walk -> Run continuous blend
      const t = (currentSmoothed - walkThresh) / Math.max(0.01, runThresh - walkThresh);
      targetWalkWeight = 1.0 - t;
      targetRunWeight = t;
    } else {
      // Run -> Sprint continuous blend
      if (sprintAction) {
        const t = Math.min(1.0, (currentSmoothed - runThresh) / Math.max(0.01, sprintThresh - runThresh));
        targetRunWeight = 1.0 - t;
        targetSprintWeight = t;
      } else {
        targetRunWeight = 1.0;
      }
    }

    // Apply weights smoothly and adapt playback speed
    const applyActionWeight = (action: THREE.AnimationAction | null, targetW: number, baseSpeedScale?: number) => {
      if (!action) return;
      const curW = action.getEffectiveWeight();
      const newW = THREE.MathUtils.lerp(curW, targetW, Math.min(1.0, dt * 14));
      action.setEffectiveWeight(newW);

      // Foot sliding prevention: adapt playback rate to actual velocity
      if (blendTree.syncPlaybackSpeed && baseSpeedScale && newW > 0.05) {
        const ratio = currentSmoothed / baseSpeedScale;
        const clampedScale = THREE.MathUtils.clamp(ratio, 0.75, 1.45) * moveDirection;
        action.setEffectiveTimeScale(clampedScale);
      } else if (moveDirection < 0 && newW > 0.05) {
        action.setEffectiveTimeScale(-1.0);
      } else {
        action.setEffectiveTimeScale(1.0);
      }
    };

    applyActionWeight(idleAction, targetIdleWeight);
    applyActionWeight(walkAction, targetWalkWeight, walkThresh);
    applyActionWeight(runAction, targetRunWeight, runThresh);
    applyActionWeight(sprintAction, targetSprintWeight, sprintThresh);
  }

  private handleVehicleRigging(entity: Entity, rigComp: RigAnimComponent, dt: number): void {
    const wheels = rigComp.vehicleWheels;
    if (!wheels) return;

    let speed = 0;
    let direction = 1;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(entity.object3D!.quaternion);

    const body = this.physicsManager.getEntityRigidbody(entity.id);
    if (body) {
      const vel = body.linvel();
      speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
      const dot = new THREE.Vector3(vel.x, vel.y, vel.z).normalize().dot(forward);
      direction = dot >= 0 ? 1 : -1;
    } else if (this.physicsManager.vehicleSystem) {
      const vSpeed = this.physicsManager.vehicleSystem.getCurrentSpeed();
      speed = Math.abs(vSpeed);
      direction = vSpeed >= 0 ? 1 : -1;
    }

    if (speed < 0.01) return;

    // Wheel rotation speed based on speed
    const wheelCircumference = 2.0; // approx 2m
    const rotationAmount = (speed / wheelCircumference) * Math.PI * 2 * dt * direction;

    const findMesh = (name: string): THREE.Object3D | null => {
      let found: THREE.Object3D | null = null;
      entity.object3D!.traverse((child) => {
        if (child.name === name) found = child;
      });
      return found;
    };

    const wheelNames = [wheels.frontLeft, wheels.frontRight, wheels.rearLeft, wheels.rearRight];
    wheelNames.forEach((name) => {
      if (!name) return;
      const mesh = findMesh(name);
      if (mesh) {
        mesh.rotateX(rotationAmount);
      }
    });

    // Front wheels steering
    const steerAngle = this.physicsManager.vehicleSystem ? this.physicsManager.vehicleSystem.getCurrentSteerAngle() : 0;
    const steerNames = [wheels.frontLeft, wheels.frontRight];
    steerNames.forEach((name) => {
      if (!name) return;
      const mesh = findMesh(name);
      if (mesh) {
        mesh.rotation.y = steerAngle;
      }
    });
  }

  public getChildNames(id: string): string[] {
    const obj = this.objects.get(id);
    if (!obj) return [];
    const names: Set<string> = new Set();
    obj.traverse((child) => {
      if (child.name && child !== obj) {
        names.add(child.name);
      }
    });
    return Array.from(names);
  }

  /**
   * Returns the primary player entity (with CharacterController component)
   */
  public getPlayerEntity(): Entity | undefined {
    return this.ecsWorld
      .getAllEntities()
      .find((e) => e.active && e.hasComponent('CharacterController') && e.object3D);
  }

  /**
   * Automatically detect skeleton bones on a 3D model and generate capsule collider presets
   */
  public autoDetectRagdollBones(entityId: string): RagdollBoneConfig[] {
    const entity = this.ecsWorld.getEntity(entityId);
    const obj = entity?.object3D || this.objects.get(entityId);
    if (!obj) return [];
    return RagdollSystem.autoDetectBones(obj);
  }

  /**
   * Triggers ragdoll physics simulation on a character or model entity
   */
  public triggerRagdoll(
    entityId: string,
    impulse?: THREE.Vector3,
    hitBoneName?: string
  ): boolean {
    return this.physicsManager.triggerRagdoll(entityId, impulse, hitBoneName);
  }

  /**
   * Restores normal character animation and controller kinematic motion
   */
  public deactivateRagdoll(entityId: string): void {
    this.physicsManager.deactivateRagdoll(entityId);
  }

  /**
   * Checks if an entity is currently in a ragdoll simulation state
   */
  public isRagdollActive(entityId: string): boolean {
    return this.physicsManager.isRagdollActive(entityId);
  }

  /**
   * Toggles ragdoll physics on the current player entity (or selected object)
   */
  public togglePlayerRagdoll(): void {
    const player = this.getPlayerEntity() || (this.selectedObject ? this.ecsWorld.getEntity(this.selectedObject.uuid) : undefined);
    if (!player) return;

    if (this.isRagdollActive(player.id)) {
      this.deactivateRagdoll(player.id);
    } else {
      const impulse = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        1.0,
        (Math.random() - 0.5) * 1.5
      );
      this.triggerRagdoll(player.id, impulse);
    }
  }

  /**
   * Shows or hides wireframe debug colliders for ragdoll bones
   */
  public showRagdollWireframes(entityId: string, show: boolean): void {
    const entity = this.ecsWorld.getEntity(entityId);
    if (!entity || !entity.object3D) return;

    if (!show) {
      this.physicsManager.ragdollSystem.removeDebugWireframes(entityId, this.scene);
      return;
    }

    const rigComp = entity.getComponent<RigAnimComponent>('RigAnim');
    const config = rigComp?.ragdoll || {
      enabled: true,
      triggerOnDamage: true,
      triggerOnFall: true,
      fallSpeedThreshold: -10,
      damping: 2.0,
      totalMass: 75,
      autoGetUp: true,
      getUpDelay: 4.0,
      bones: RagdollSystem.autoDetectBones(entity.object3D),
    };

    this.physicsManager.ragdollSystem.createDebugWireframes(entity, config, this.scene);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    this.physicsManager.dispose();

    if (this.atmosphereManager) {
      this.atmosphereManager.dispose();
    }
    if (this.terrainGenerator) {
      this.terrainGenerator.dispose();
    }
    if (this.foliagePainter) {
      this.foliagePainter.dispose();
    }
    if (this.particleManager) {
      this.particleManager.dispose();
    }
    if (this.animationManager) {
      this.animationManager.dispose();
    }

    if (this.dracoLoader) {
      this.dracoLoader.dispose();
    }

    this.transformControls.dispose();
    this.orbitControls.dispose();
    this.renderer.dispose();

    if (this.container.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }

    this.objects.clear();
    this.originalMaterials.clear();
  }
}
