import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {
  Entity,
  ECSWorld,
  RigidbodyComponent,
  ColliderComponent,
  CharacterControllerComponent,
  RigAnimComponent,
  TransformComponent,
} from '../ecs/ECS';
import { CharacterControllerSystem } from './CharacterControllerSystem';
import { VehicleControllerSystem } from './VehicleControllerSystem';
import { RagdollSystem } from './RagdollSystem';
import { EnvironmentalPhysicsManager } from './EnvironmentalPhysicsManager';

export interface PhysicsSnapshot {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

export class PhysicsManager {
  private static isInitialized: boolean = false;
  private static initPromise: Promise<void> | null = null;

  public world: RAPIER.World | null = null;
  public gravity: { x: number; y: number; z: number } = { x: 0, y: -9.81, z: 0 };
  public isSimulating: boolean = false;

  private ecsWorld: ECSWorld;
  public characterSystem: CharacterControllerSystem;
  public vehicleSystem: VehicleControllerSystem;
  public ragdollSystem: RagdollSystem;
  public environmentalPhysics: EnvironmentalPhysicsManager | null = null;

  // Snapshot to restore editor transforms when Play mode is stopped
  private sceneSnapshots: Map<string, PhysicsSnapshot> = new Map();

  // Internal Rapier reference mapping
  private entityToBody: Map<string, RAPIER.RigidBody> = new Map();
  private entityToCollider: Map<string, RAPIER.Collider> = new Map();
  private playerControllerHandle: RAPIER.KinematicCharacterController | null = null;
  private staticGroundCollider: RAPIER.Collider | null = null;
  private terrainCollider: RAPIER.Collider | null = null;
  private terrainGenerator: any = null;

  constructor(ecsWorld: ECSWorld, camera?: THREE.PerspectiveCamera) {
    this.ecsWorld = ecsWorld;
    this.characterSystem = new CharacterControllerSystem(camera);
    this.vehicleSystem = new VehicleControllerSystem(camera);
    this.ragdollSystem = new RagdollSystem(ecsWorld);
  }

  public setTerrainGenerator(generator: any): void {
    this.terrainGenerator = generator;
  }

  /**
   * Initializes Rapier WebAssembly safely
   */
  public static async initRapier(): Promise<void> {
    if (PhysicsManager.isInitialized) return;
    if (!PhysicsManager.initPromise) {
      PhysicsManager.initPromise = RAPIER.init().then(() => {
        PhysicsManager.isInitialized = true;
      });
    }
    return PhysicsManager.initPromise;
  }

  /**
   * Starts the physical simulation (Play Mode)
   */
  public async startSimulation(): Promise<void> {
    await PhysicsManager.initRapier();

    // 1. Create Rapier World with gravity
    this.world = new RAPIER.World(this.gravity);
    this.isSimulating = true;
    this.sceneSnapshots.clear();
    this.entityToBody.clear();
    this.entityToCollider.clear();

    // 2. Add an infinite ground plane at Y = 0 (safety floor)
    const groundDesc = RAPIER.ColliderDesc.cuboid(500, 0.1, 500);
    groundDesc.setTranslation(0, -0.1, 0);
    this.staticGroundCollider = this.world.createCollider(groundDesc);

    // 2b. Add physical collider for the terrain if enabled
    if (this.terrainGenerator && this.terrainGenerator.config && this.terrainGenerator.config.enabled && this.terrainGenerator.mesh) {
      const trimeshData = this.extractTrimeshData(this.terrainGenerator.mesh);
      if (trimeshData && trimeshData.vertices.length > 0 && trimeshData.indices.length > 0) {
        try {
          const terrainDesc = RAPIER.ColliderDesc.trimesh(trimeshData.vertices, trimeshData.indices);
          const obj = this.terrainGenerator.mesh;
          terrainDesc
            .setTranslation(obj.position.x, obj.position.y, obj.position.z)
            .setRotation({
              x: obj.quaternion.x,
              y: obj.quaternion.y,
              z: obj.quaternion.z,
              w: obj.quaternion.w,
            });
          this.terrainCollider = this.world.createCollider(terrainDesc);
        } catch (e) {
          console.warn('Failed to build Rapier terrain collider:', e);
        }
      }
    }

    // 3. Capture snapshots & build Rapier bodies for all entities
    const entities = this.ecsWorld.getAllEntities();
    for (const entity of entities) {
      if (!entity.active || !entity.object3D) continue;

      const obj = entity.object3D;

      // Save editor snapshot
      this.sceneSnapshots.set(entity.id, {
        position: obj.position.clone(),
        quaternion: obj.quaternion.clone(),
        scale: obj.scale.clone(),
      });

      // Synchronize initial Transform Component
      let transformComp = entity.getComponent<TransformComponent>('Transform');
      if (!transformComp) {
        transformComp = new TransformComponent();
        transformComp.syncFromObject3D(obj);
        entity.addComponent(transformComp);
      } else {
        transformComp.syncFromObject3D(obj);
      }

      // Check if entity has Rigidbody or Collider
      const rbComp = entity.getComponent<RigidbodyComponent>('Rigidbody');
      const colComp = entity.getComponent<ColliderComponent>('Collider');
      const charComp = entity.getComponent<CharacterControllerComponent>('CharacterController');

      if (charComp && charComp.enabled) {
        this.setupCharacterController(entity, charComp, colComp);
      } else if (rbComp && rbComp.enabled) {
        this.setupRigidBody(entity, rbComp, colComp);
      } else if (colComp && colComp.enabled) {
        // Static collider only (no active rigid body, e.g. level geometry)
        this.setupStaticCollider(entity, colComp);
      }
    }

    // Initialize Flammable Entities for thermal simulation
    if (this.environmentalPhysics) {
      for (const entity of this.ecsWorld.getAllEntities()) {
        const physicsData = (entity.object3D?.userData?.physics as any) || {};
        if (physicsData.flammable && physicsData.flammable.enabled) {
          this.environmentalPhysics.registerFlammableEntity(entity, physicsData.flammable);
        }
      }
    }

    // Activate Keyboard Input for controllers
    this.characterSystem.activate();
    this.vehicleSystem.activate();
  }

  /**
   * Stops simulation and faithfully restores objects to their editor positions
   */
  public stopSimulation(): void {
    this.isSimulating = false;
    this.characterSystem.deactivate();
    this.vehicleSystem.deactivate();

    if (this.environmentalPhysics) {
      this.environmentalPhysics.dispose();
    }

    // Restore snapshots for all entities
    for (const [id, snapshot] of this.sceneSnapshots.entries()) {
      const entity = this.ecsWorld.getEntity(id);
      if (entity && entity.object3D) {
        entity.object3D.position.copy(snapshot.position);
        entity.object3D.quaternion.copy(snapshot.quaternion);
        entity.object3D.scale.copy(snapshot.scale);

        const transformComp = entity.getComponent<TransformComponent>('Transform');
        if (transformComp) {
          transformComp.syncFromObject3D(entity.object3D);
        }
      }
    }

    // Clean up ragdolls
    this.ragdollSystem.dispose(this.world);

    // Clean up Rapier bodies and controller
    if (this.playerControllerHandle && this.world) {
      this.world.removeCharacterController(this.playerControllerHandle);
      this.playerControllerHandle = null;
    }

    if (this.world) {
      this.world.free();
      this.world = null;
    }

    this.entityToBody.clear();
    this.entityToCollider.clear();
    this.sceneSnapshots.clear();
    this.terrainCollider = null;

    // Clear raw references in components
    for (const entity of this.ecsWorld.getAllEntities()) {
      const rb = entity.getComponent<RigidbodyComponent>('Rigidbody');
      if (rb) rb.rawBody = null;
      const col = entity.getComponent<ColliderComponent>('Collider');
      if (col) col.rawCollider = null;
      const char = entity.getComponent<CharacterControllerComponent>('CharacterController');
      if (char) {
        char.rawController = null;
        char.rawBody = null;
        char.verticalVelocity = 0;
      }
    }
  }

  /**
   * Instantiates a dynamic, static or kinematic Rapier Rigidbody
   */
  private setupRigidBody(
    entity: Entity,
    rbComp: RigidbodyComponent,
    colComp?: ColliderComponent
  ): void {
    if (!this.world || !entity.object3D) return;

    const obj = entity.object3D;
    obj.updateMatrixWorld(true);

    let bodyDesc: RAPIER.RigidBodyDesc;
    if (rbComp.bodyType === 'static') {
      bodyDesc = RAPIER.RigidBodyDesc.fixed();
    } else if (rbComp.bodyType === 'kinematic') {
      bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased();
    } else {
      bodyDesc = RAPIER.RigidBodyDesc.dynamic();
    }

    bodyDesc
      .setTranslation(obj.position.x, obj.position.y, obj.position.z)
      .setRotation({
        x: obj.quaternion.x,
        y: obj.quaternion.y,
        z: obj.quaternion.z,
        w: obj.quaternion.w,
      })
      .setLinearDamping(rbComp.linearDamping)
      .setAngularDamping(rbComp.angularDamping);

    if (rbComp.lockRotations) {
      bodyDesc.lockRotations();
    }

    const body = this.world.createRigidBody(bodyDesc);
    rbComp.rawBody = body;
    this.entityToBody.set(entity.id, body);

    // Create and attach collider to this body
    const shape = colComp?.shape || 'auto';
    const colliderDesc = this.createColliderDesc(obj, shape, colComp);
    if (colliderDesc) {
      colliderDesc.setRestitution(rbComp.restitution);
      colliderDesc.setFriction(rbComp.friction);
      if (colComp?.isSensor) colliderDesc.setSensor(true);

      const collider = this.world.createCollider(colliderDesc, body);
      if (colComp) colComp.rawCollider = collider;
      this.entityToCollider.set(entity.id, collider);
    }
  }

  /**
   * Instantiates a static level collider without moving body
   */
  private setupStaticCollider(entity: Entity, colComp: ColliderComponent): void {
    if (!this.world || !entity.object3D) return;

    const obj = entity.object3D;
    obj.updateMatrixWorld(true);

    const colliderDesc = this.createColliderDesc(obj, colComp.shape, colComp);
    if (colliderDesc) {
      colliderDesc
        .setTranslation(obj.position.x, obj.position.y, obj.position.z)
        .setRotation({
          x: obj.quaternion.x,
          y: obj.quaternion.y,
          z: obj.quaternion.z,
          w: obj.quaternion.w,
        });

      if (colComp.isSensor) colliderDesc.setSensor(true);

      const collider = this.world.createCollider(colliderDesc);
      colComp.rawCollider = collider;
      this.entityToCollider.set(entity.id, collider);
    }
  }

  /**
   * Sets up the kinematic Character Controller with Rapier autostep & snap to ground
   */
  private setupCharacterController(
    entity: Entity,
    charComp: CharacterControllerComponent,
    colComp?: ColliderComponent
  ): void {
    if (!this.world || !entity.object3D) return;

    const obj = entity.object3D;
    obj.updateMatrixWorld(true);

    // Character Rigidbody is Kinematic Position-Based
    const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(obj.position.x, obj.position.y, obj.position.z)
      .lockRotations();

    const body = this.world.createRigidBody(bodyDesc);
    this.entityToBody.set(entity.id, body);

    // Capsule Collider: half-height = 0.5, radius = 0.45 (total height = 1.9m)
    const halfHeight = colComp?.height ? colComp.height / 2 : 0.5;
    const radius = colComp?.radius || 0.45;
    const colliderDesc = RAPIER.ColliderDesc.capsule(halfHeight, radius);
    colliderDesc.setFriction(0.0).setRestitution(0.0);

    const collider = this.world.createCollider(colliderDesc, body);
    this.entityToCollider.set(entity.id, collider);

    // Create Rapier Character Controller
    const offset = 0.05;
    const controller = this.world.createCharacterController(offset);
    controller.enableAutostep(0.35, 0.2, true);
    controller.enableSnapToGround(0.3);
    controller.setUp(new RAPIER.Vector3(0, 1, 0));

    this.playerControllerHandle = controller;
    charComp.rawController = controller;
    charComp.rawBody = body;
  }

  /**
   * Creates an optimized Collider Descriptor based on shape type or auto-detection
   */
  private createColliderDesc(
    obj: THREE.Object3D,
    shape: string,
    colComp?: ColliderComponent
  ): RAPIER.ColliderDesc | null {
    // 1. Explicit Sphere
    if (shape === 'sphere') {
      const radius = colComp?.radius || this.computeBoundingSphereRadius(obj);
      return RAPIER.ColliderDesc.ball(Math.max(0.05, radius));
    }

    // 2. Explicit Capsule
    if (shape === 'capsule') {
      const radius = colComp?.radius || 0.4;
      const height = colComp?.height || 1.2;
      return RAPIER.ColliderDesc.capsule(Math.max(0.1, height / 2), Math.max(0.05, radius));
    }

    // 3. Explicit Cylinder
    if (shape === 'cylinder') {
      const radius = colComp?.radius || 0.5;
      const height = colComp?.height || 1.0;
      return RAPIER.ColliderDesc.cylinder(Math.max(0.1, height / 2), Math.max(0.05, radius));
    }

    // 4. Trimesh (Auto-fit for GLTF models & complex meshes)
    if (shape === 'trimesh' || (shape === 'auto' && obj.userData?.subType === 'model')) {
      const trimeshData = this.extractTrimeshData(obj);
      if (trimeshData && trimeshData.vertices.length > 0 && trimeshData.indices.length > 0) {
        try {
          return RAPIER.ColliderDesc.trimesh(trimeshData.vertices, trimeshData.indices);
        } catch (e) {
          console.warn('Failed to build Rapier Trimesh collider, falling back to Box:', e);
        }
      }
    }

    // 5. Box / Cuboid (default auto-fit bounding box)
    const bbox = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    bbox.getSize(size);

    const halfX = Math.max(0.05, (colComp?.size?.x || size.x) / 2);
    const halfY = Math.max(0.05, (colComp?.size?.y || size.y) / 2);
    const halfZ = Math.max(0.05, (colComp?.size?.z || size.z) / 2);

    return RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ);
  }

  /**
   * Computes approximate bounding sphere radius for auto-fit
   */
  private computeBoundingSphereRadius(obj: THREE.Object3D): number {
    const bbox = new THREE.Box3().setFromObject(obj);
    const sphere = new THREE.Sphere();
    bbox.getBoundingSphere(sphere);
    return Math.max(0.1, sphere.radius);
  }

  /**
   * Extracts vertices and indices from complex Three.js models or hierarchies for Trimesh Colliders
   */
  private extractTrimeshData(
    root: THREE.Object3D
  ): { vertices: Float32Array; indices: Uint32Array } | null {
    const allVertices: number[] = [];
    const allIndices: number[] = [];
    let vertexOffset = 0;

    const rootInverseMatrix = new THREE.Matrix4().copy(root.matrixWorld).invert();

    root.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const geo = child.geometry.clone();
        child.updateMatrixWorld(true);

        // Compute transform matrix relative to root
        const relativeMatrix = new THREE.Matrix4()
          .copy(rootInverseMatrix)
          .multiply(child.matrixWorld);
        geo.applyMatrix4(relativeMatrix);

        const posAttr = geo.attributes.position;
        if (!posAttr) return;

        // Collect vertices
        for (let i = 0; i < posAttr.count; i++) {
          allVertices.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
        }

        // Collect indices
        if (geo.index) {
          for (let i = 0; i < geo.index.count; i++) {
            allIndices.push(geo.index.getX(i) + vertexOffset);
          }
        } else {
          for (let i = 0; i < posAttr.count; i++) {
            allIndices.push(i + vertexOffset);
          }
        }

        vertexOffset += posAttr.count;
      }
    });

    if (allVertices.length === 0 || allIndices.length === 0) return null;

    return {
      vertices: new Float32Array(allVertices),
      indices: new Uint32Array(allIndices),
    };
  }

  /**
   * Step the physics simulation and synchronize with Three.js
   */
  public step(dt: number): void {
    if (!this.isSimulating || !this.world) return;

    // Fixed timestep clamp to prevent physics explosion
    const fixedDelta = Math.min(dt, 0.05);

    // 1. Update Character Controller inputs & physics movement
    this.updateCharacterControllerPhysics(fixedDelta);

    // 1b. Update Vehicle Controllers inputs & driving physics
    this.updateVehicleControllersPhysics(fixedDelta);

    // 1c. Sync kinematic bodies from Three.js to Rapier (e.g. for animated platforms/doors)
    for (const [id, body] of this.entityToBody.entries()) {
      if (body.isKinematic()) {
        const entity = this.ecsWorld.getEntity(id);
        if (entity && entity.object3D) {
          const obj = entity.object3D;
          body.setNextKinematicTranslation({ x: obj.position.x, y: obj.position.y, z: obj.position.z });
          body.setNextKinematicRotation({ x: obj.quaternion.x, y: obj.quaternion.y, z: obj.quaternion.z, w: obj.quaternion.w });
        }
      }
    }

    // 2. Step Rapier World
    this.world.step();

    // 2b. Environmental Physics (Wind forces, fire propagation & damage, rain & wet friction)
    if (this.environmentalPhysics) {
      this.environmentalPhysics.stepPhysics(
        fixedDelta,
        this.world,
        this.entityToBody,
        this.entityToCollider
      );
    }

    // 2c. Step Ragdoll physics and bone synchronization
    this.ragdollSystem.step(this.world, fixedDelta);

    // 3. Synchronize Rapier bodies -> Three.js Objects & ECS Transform Components
    for (const [id, body] of this.entityToBody.entries()) {
      const entity = this.ecsWorld.getEntity(id);
      if (!entity || !entity.object3D) continue;

      // Ignore static bodies as they do not move
      if (body.isFixed()) continue;

      const translation = body.translation();
      const rotation = body.rotation();

      entity.object3D.position.set(translation.x, translation.y, translation.z);
      entity.object3D.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

      const transformComp = entity.getComponent<TransformComponent>('Transform');
      if (transformComp) {
        transformComp.syncFromObject3D(entity.object3D);
      }
    }
  }

  /**
   * Drives character kinematic movement through Rapier's CharacterController
   */
  private updateCharacterControllerPhysics(dt: number): void {
    if (!this.playerControllerHandle || !this.world) {
      // Fallback update without Rapier character controller
      this.characterSystem.update(dt, this.ecsWorld.getAllEntities());
      return;
    }

    const playerEntity = this.ecsWorld
      .getAllEntities()
      .find((e) => e.active && e.hasComponent('CharacterController') && e.object3D);

    if (!playerEntity || !playerEntity.object3D) return;

    // If ragdoll physics is currently active, camera still follows player but kinematic translation is suspended
    if (this.ragdollSystem.isRagdollActive(playerEntity.id)) {
      this.characterSystem.update(dt, [playerEntity]);
      return;
    }

    const controllerComp =
      playerEntity.getComponent<CharacterControllerComponent>('CharacterController');
    const collider = this.entityToCollider.get(playerEntity.id);
    const body = this.entityToBody.get(playerEntity.id);

    if (!controllerComp || !collider || !body) {
      this.characterSystem.update(dt, this.ecsWorld.getAllEntities());
      return;
    }

    const input = this.characterSystem.input;
    const obj = playerEntity.object3D;

    // Movement speed & direction
    const speed = controllerComp.speed * (input.sprint ? 1.5 : 1.0);
    const moveDir = new THREE.Vector3();

    // Directions
    if (input.forward) moveDir.z -= 1;
    if (input.backward) moveDir.z += 1;
    if (input.left) moveDir.x -= 1;
    if (input.right) moveDir.x += 1;

    if (moveDir.lengthSq() > 0.001) {
      moveDir.normalize();

      // Rotate model towards movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      obj.rotation.y = THREE.MathUtils.lerp(obj.rotation.y, targetAngle, Math.min(1.0, dt * 12));
    }

    // Gravity and jumping
    const gravity = -18.0;
    if (controllerComp.isGrounded) {
      if (input.jump) {
        controllerComp.verticalVelocity = controllerComp.jumpForce;
        controllerComp.isGrounded = false;
      } else {
        controllerComp.verticalVelocity = -2.0; // slight stick to ground
      }
    } else {
      controllerComp.verticalVelocity += gravity * dt;
      if (controllerComp.verticalVelocity < -25) {
        controllerComp.verticalVelocity = -25;
      }
    }

    // Check Fall Trigger for Ragdoll
    const rigComp = playerEntity.getComponent<RigAnimComponent>('RigAnim');
    const ragdollCfg = rigComp?.ragdoll;
    if (ragdollCfg && ragdollCfg.enabled && ragdollCfg.triggerOnFall) {
      const fallThreshold = ragdollCfg.fallSpeedThreshold ?? -10.0;
      if (controllerComp.verticalVelocity < fallThreshold) {
        // High fall velocity triggered ragdoll impact
        this.triggerRagdoll(playerEntity.id, new THREE.Vector3(0, controllerComp.verticalVelocity * 0.4, 0));
        return;
      }
    }

    const desiredTranslation = new RAPIER.Vector3(
      moveDir.x * speed * dt,
      controllerComp.verticalVelocity * dt,
      moveDir.z * speed * dt
    );

    // Let Rapier compute collision movement and handle stairs/slopes
    this.playerControllerHandle.computeColliderMovement(collider, desiredTranslation);
    const correctedMovement = this.playerControllerHandle.computedMovement();
    controllerComp.isGrounded = this.playerControllerHandle.computedGrounded();

    // If grounded after movement, zero vertical velocity
    if (controllerComp.isGrounded && controllerComp.verticalVelocity < 0) {
      controllerComp.verticalVelocity = 0;
    }

    // Apply movement to Rapier body
    const currentPos = body.translation();
    const newPos = new RAPIER.Vector3(
      currentPos.x + correctedMovement.x,
      currentPos.y + correctedMovement.y,
      currentPos.z + correctedMovement.z
    );

    // Keep minimum safety floor
    if (newPos.y < 0.95) {
      newPos.y = 0.95;
      controllerComp.isGrounded = true;
      controllerComp.verticalVelocity = 0;
    }

    body.setNextKinematicTranslation(newPos);
    obj.position.set(newPos.x, newPos.y, newPos.z);

    // Update current speed for animations
    controllerComp.velocity.set(correctedMovement.x / dt, 0, correctedMovement.z / dt);
    controllerComp.currentSpeed = Math.sqrt(controllerComp.velocity.x ** 2 + controllerComp.velocity.z ** 2);

    // Update Camera Follow
    this.characterSystem.update(dt, [playerEntity]);
  }

  /**
   * Drives vehicle physics, tire suspension, steering and dynamic follow camera
   */
  private updateVehicleControllersPhysics(dt: number): void {
    const vehicleEntities = this.ecsWorld
      .getAllEntities()
      .filter(
        (e) =>
          e.active &&
          e.object3D &&
          e.object3D.userData?.physics?.vehicleController?.enabled
      );

    for (const entity of vehicleEntities) {
      const vehicleData = entity.object3D!.userData.physics.vehicleController;
      this.vehicleSystem.update(dt, entity, vehicleData, new Map());
    }
  }

  public getEntityRigidbody(entityId: string): RAPIER.RigidBody | undefined {
    return this.entityToBody.get(entityId);
  }

  /**
   * Return number of active physics bodies in the world
   */
  public getBodiesCount(): number {
    return this.entityToBody.size;
  }

  /**
   * Triggers ragdoll physics on an entity (humanoid or model with SkinnedMesh / bones)
   */
  public triggerRagdoll(
    entityId: string,
    impulse?: THREE.Vector3,
    hitBoneName?: string
  ): boolean {
    if (!this.world || !this.isSimulating) return false;
    const entity = this.ecsWorld.getEntity(entityId);
    if (!entity || !entity.object3D) return false;

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

    return this.ragdollSystem.activateRagdoll(
      this.world,
      entity,
      config,
      impulse,
      hitBoneName
    );
  }

  /**
   * Deactivates ragdoll simulation on an entity
   */
  public deactivateRagdoll(entityId: string): void {
    if (!this.world) return;
    this.ragdollSystem.deactivateRagdoll(this.world, entityId);
  }

  /**
   * Checks if an entity is currently simulating ragdoll physics
   */
  public isRagdollActive(entityId: string): boolean {
    return this.ragdollSystem.isRagdollActive(entityId);
  }

  /**
   * Cleanly dispose physics world and systems
   */
  public dispose(): void {
    this.stopSimulation();
    this.ragdollSystem.dispose(this.world);
    this.characterSystem.dispose();
    this.vehicleSystem.dispose();
  }
}
