import * as THREE from 'three';
import type RAPIER from '@dimforge/rapier3d-compat';
import { Entity, ECSWorld, CharacterControllerComponent } from '../ecs/ECS';
import { WindConfig, RainConfig, WaterConfig } from '../../types/atmosphere';
import { WindZoneConfig, FlammableConfig } from '../../types/engine';
import { ParticleManager } from '../vfx/ParticleManager';
import { soundManager } from '../SoundManager';
import { WaterManager } from '../water/WaterManager';

export class EnvironmentalPhysicsManager {
  private ecsWorld: ECSWorld;
  private scene: THREE.Scene;
  public particleManager?: ParticleManager;
  public waterManager: WaterManager | null = null;

  // 1. Wind System State
  public windConfig: WindConfig = {
    enabled: false,
    speed: 25, // km/h
    direction: { x: 1, y: 0, z: 0.3 },
    gustiness: 0.45,
    gustFrequency: 0.3,
  };
  public currentWindVector: THREE.Vector3 = new THREE.Vector3();
  private windTime: number = 0;
  private windAudioCooldown: number = 0;
  private windParticlesMesh: THREE.Points | null = null;
  private windGeometry: THREE.BufferGeometry | null = null;
  private windPositions: Float32Array | null = null;
  private windCount: number = 800;

  // 2. Fire System State
  private burningEntities: Map<
    string,
    {
      entity: Entity;
      config: FlammableConfig;
      light?: THREE.PointLight;
      emitterId: string;
      smokeEmitterId: string;
      damageCooldown: number;
      audioCooldown: number;
    }
  > = new Map();
  public onFireDamage?: (entityId: string, damage: number) => void;
  public onIgniteEvent?: (entityId: string) => void;
  public onExtinguishEvent?: (entityId: string) => void;

  // 3. Rain System State
  public rainConfig: RainConfig = {
    enabled: false,
    intensity: 0.5,
    isThunder: false,
    wetFrictionReduction: 0.55,
  };
  private rainParticlesMesh: THREE.Points | null = null;
  private rainGeometry: THREE.BufferGeometry | null = null;
  private rainPositions: Float32Array | null = null;
  private rainCount: number = 3500;
  private rainAudioCooldown: number = 0;
  private thunderCooldown: number = 0;
  private isLightningFlash: boolean = false;
  private lightningTimer: number = 0;
  private originalFrictions: Map<string, number> = new Map();
  private rainTexture: THREE.Texture | null = null;
  private windTexture: THREE.Texture | null = null;

  constructor(ecsWorld: ECSWorld, scene: THREE.Scene) {
    this.ecsWorld = ecsWorld;
    this.scene = scene;
  }

  // =========================================================================
  // 1. WIND SYSTEM
  // =========================================================================

  public setWindConfig(config: Partial<WindConfig>): void {
    this.windConfig = { ...this.windConfig, ...config };
    if (!this.windConfig.enabled && this.windParticlesMesh) {
      this.windParticlesMesh.visible = false;
    }
  }

  public getWindVelocity(): THREE.Vector3 {
    return this.currentWindVector.clone();
  }

  private createWindTexture(): THREE.Texture {
    if (this.windTexture) return this.windTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(0, 8, 64, 8);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.3, 'rgba(230, 245, 255, 0.7)');
      grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.9)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 4, 64, 8);
    }
    this.windTexture = new THREE.CanvasTexture(canvas);
    return this.windTexture;
  }

  private initWindMesh(): void {
    if (this.windParticlesMesh) return;

    this.windPositions = new Float32Array(this.windCount * 3);
    const boxSize = 75;

    for (let i = 0; i < this.windCount; i++) {
      this.windPositions[i * 3] = (Math.random() - 0.5) * boxSize;
      this.windPositions[i * 3 + 1] = Math.random() * 25 - 2;
      this.windPositions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;
    }

    this.windGeometry = new THREE.BufferGeometry();
    this.windGeometry.setAttribute('position', new THREE.BufferAttribute(this.windPositions, 3));

    const windMat = new THREE.PointsMaterial({
      color: 0xe0f2fe,
      size: 0.55,
      map: this.createWindTexture(),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.windParticlesMesh = new THREE.Points(this.windGeometry, windMat);
    this.windParticlesMesh.frustumCulled = false;
    this.scene.add(this.windParticlesMesh);
  }

  private updateWind(dt: number, camera?: THREE.Camera): void {
    if (!this.windConfig.enabled || this.windConfig.speed <= 0) {
      this.currentWindVector.set(0, 0, 0);
      if (this.windParticlesMesh) this.windParticlesMesh.visible = false;
      return;
    }

    this.windTime += dt;

    // Normalize base direction
    const dir = new THREE.Vector3(
      this.windConfig.direction.x,
      this.windConfig.direction.y,
      this.windConfig.direction.z
    );
    if (dir.lengthSq() < 0.001) dir.set(1, 0, 0.3);
    dir.normalize();

    // Convert km/h to m/s
    const baseSpeedMs = this.windConfig.speed / 3.6;

    // Harmonic gusts with turbulence
    const t = this.windTime * (this.windConfig.gustFrequency || 0.3) * Math.PI * 2;
    const gustHarmonic =
      Math.sin(t) * 0.45 + Math.sin(t * 2.3 + 1.2) * 0.25 + Math.sin(t * 5.1) * 0.1;
    const gustFactor = Math.max(0.1, 1.0 + gustHarmonic * (this.windConfig.gustiness ?? 0.45));

    const speed = baseSpeedMs * gustFactor;
    this.currentWindVector.copy(dir).multiplyScalar(speed);

    // Audio cue during powerful gusts
    this.windAudioCooldown -= dt;
    if (this.windAudioCooldown <= 0 && gustFactor > 1.35 && baseSpeedMs > 6) {
      soundManager.playSFX('wind');
      this.windAudioCooldown = 4.0 + Math.random() * 3.0;
    }

    // Visual Wind Streaks
    if (camera) {
      this.initWindMesh();
      if (this.windParticlesMesh && this.windPositions && this.windGeometry) {
        this.windParticlesMesh.visible = true;
        const camPos = camera.position;
        this.windParticlesMesh.position.x = camPos.x;
        this.windParticlesMesh.position.z = camPos.z;

        const boxSize = 75;
        const halfBox = boxSize / 2;
        const moveX = this.currentWindVector.x * dt * 1.5;
        const moveY = this.currentWindVector.y * dt * 1.5;
        const moveZ = this.currentWindVector.z * dt * 1.5;

        for (let i = 0; i < this.windCount; i++) {
          this.windPositions[i * 3] += moveX;
          this.windPositions[i * 3 + 1] += moveY;
          this.windPositions[i * 3 + 2] += moveZ;

          // Wrap boundaries relative to camera box
          if (this.windPositions[i * 3] > halfBox) this.windPositions[i * 3] = -halfBox;
          else if (this.windPositions[i * 3] < -halfBox) this.windPositions[i * 3] = halfBox;

          if (this.windPositions[i * 3 + 1] > 30) this.windPositions[i * 3 + 1] = -2;
          else if (this.windPositions[i * 3 + 1] < -2) this.windPositions[i * 3 + 1] = 30;

          if (this.windPositions[i * 3 + 2] > halfBox) this.windPositions[i * 3 + 2] = -halfBox;
          else if (this.windPositions[i * 3 + 2] < -halfBox) this.windPositions[i * 3 + 2] = halfBox;
        }

        this.windGeometry.attributes.position.needsUpdate = true;
      }
    }
  }

  /**
   * Applies continuous aerodynamic wind force to all Rapier rigidbodies and character
   */
  public applyWindToPhysics(
    world: RAPIER.World,
    entityToBody: Map<string, RAPIER.RigidBody>,
    dt: number
  ): void {
    const hasGlobalWind = this.windConfig.enabled && this.currentWindVector.lengthSq() > 0.01;

    // Scan for local wind zones (e.g. fan, updraft geysers)
    const localWindZones: Array<{
      center: THREE.Vector3;
      config: WindZoneConfig;
    }> = [];

    for (const entity of this.ecsWorld.getAllEntities()) {
      if (!entity.active || !entity.object3D) continue;
      const physicsData = (entity.object3D.userData?.physics as any) || {};
      const wz = physicsData.windZone as WindZoneConfig | undefined;
      if (wz && wz.enabled) {
        localWindZones.push({
          center: entity.object3D.position.clone(),
          config: wz,
        });
      }
    }

    if (!hasGlobalWind && localWindZones.length === 0) return;

    // 1. Apply to Dynamic Rigidbodies (boxes, barrels, spheres, vehicles)
    for (const [entityId, body] of entityToBody.entries()) {
      if (!body.isDynamic()) continue;

      const entity = this.ecsWorld.getEntity(entityId);
      if (!entity || !entity.object3D) continue;

      const pos = entity.object3D.position;
      const totalWindForce = new THREE.Vector3();

      // Global wind
      if (hasGlobalWind) {
        // Drag equation F = 0.5 * rho * v^2 * Cd * Area (scaled for gameplay responsiveness)
        const mass = body.mass();
        const dragFactor = Math.min(1.2, 0.4 + 1.5 / Math.max(1, mass));
        totalWindForce.addScaledVector(this.currentWindVector, dragFactor * 2.2);
      }

      // Local wind zones
      for (const zone of localWindZones) {
        const dist = pos.distanceTo(zone.center);
        if (dist <= zone.config.radius) {
          const falloff = 1 - dist / zone.config.radius;
          let zoneDir = new THREE.Vector3();

          if (zone.config.mode === 'updraft') {
            zoneDir.set(0, 1, 0);
          } else if (zone.config.mode === 'vortex') {
            const radial = new THREE.Vector3().subVectors(pos, zone.center).normalize();
            zoneDir.crossVectors(new THREE.Vector3(0, 1, 0), radial).add(new THREE.Vector3(0, 0.3, 0));
          } else {
            zoneDir.set(
              zone.config.direction.x || 0,
              zone.config.direction.y || 0,
              zone.config.direction.z || 1
            ).normalize();
          }

          totalWindForce.addScaledVector(zoneDir, zone.config.force * falloff);
        }
      }

      if (totalWindForce.lengthSq() > 0.001) {
        body.applyImpulse(
          {
            x: totalWindForce.x * dt,
            y: totalWindForce.y * dt,
            z: totalWindForce.z * dt,
          },
          true
        );
      }
    }

    // 2. Apply gentle push to Character Controller in air / when moving
    const player = this.ecsWorld
      .getAllEntities()
      .find((e) => e.active && e.hasComponent('CharacterController') && e.object3D);

    if (player && player.object3D && hasGlobalWind) {
      const charComp = player.getComponent<CharacterControllerComponent>('CharacterController');
      if (charComp) {
        const inAirFactor = charComp.isGrounded ? 0.08 : 0.45;
        const push = this.currentWindVector.clone().multiplyScalar(dt * inAirFactor);
        player.object3D.position.add(push);
      }
    }
  }

  // =========================================================================
  // 2. FIRE & COMBUSTION SYSTEM
  // =========================================================================

  public registerFlammableEntity(entity: Entity, config: FlammableConfig): void {
    if (config.isBurning) {
      this.igniteEntity(entity, config);
    }
  }

  public igniteEntity(entity: Entity, customConfig?: Partial<FlammableConfig>): boolean {
    if (!entity.object3D) return false;

    const id = entity.id;
    const existing = this.burningEntities.get(id);
    if (existing) {
      // Refresh fuel
      existing.config.fuel = existing.config.maxFuel;
      return true;
    }

    const physicsData = (entity.object3D.userData?.physics as any) || {};
    const baseConfig: FlammableConfig = {
      enabled: true,
      isBurning: true,
      temperature: 250,
      ignitionTemperature: 100,
      fuel: 16,
      maxFuel: 16,
      spreadRadius: 3.2,
      burnDamage: 15,
      charredColor: '#1c1917',
      ...physicsData.flammable,
      ...customConfig,
    };

    // Attach dynamic flickering point light
    const fireLight = new THREE.PointLight(0xff6600, 2.5, 9);
    fireLight.position.set(0, 1.2, 0);
    entity.object3D.add(fireLight);

    // Particle Emitter IDs
    const emitterId = `fire_${id}`;
    const smokeEmitterId = `smoke_${id}`;

    if (this.particleManager) {
      // Fire particles
      const fireConfig = ParticleManager.getDefaultPresetConfig('fire');
      fireConfig.rate = 45;
      fireConfig.size = 0.9;
      this.particleManager.createOrUpdateEmitter(emitterId, fireConfig, entity.object3D.position, entity.object3D);

      // Smoke particles
      const smokeConfig = ParticleManager.getDefaultPresetConfig('smoke');
      smokeConfig.rate = 20;
      smokeConfig.size = 1.4;
      this.particleManager.createOrUpdateEmitter(smokeEmitterId, smokeConfig, entity.object3D.position, entity.object3D);
    }

    this.burningEntities.set(id, {
      entity,
      config: baseConfig,
      light: fireLight,
      emitterId,
      smokeEmitterId,
      damageCooldown: 0.5,
      audioCooldown: 0.2,
    });

    // Update entity metadata
    if (physicsData.flammable) {
      physicsData.flammable.isBurning = true;
    }

    soundManager.playSFX('fire_crackle');
    this.onIgniteEvent?.(id);
    return true;
  }

  public extinguishEntity(entityId: string): void {
    const data = this.burningEntities.get(entityId);
    if (!data) return;

    // Remove fire light
    if (data.light && data.entity.object3D) {
      data.entity.object3D.remove(data.light);
      data.light.dispose();
    }

    // Stop particles
    if (this.particleManager) {
      this.particleManager.stopEmitter(data.emitterId);
      this.particleManager.stopEmitter(data.smokeEmitterId);
    }

    // Apply charred carbonization visual if fuel was consumed
    if (data.config.fuel <= 0 && data.entity.object3D) {
      data.entity.object3D.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial;
          if (mat.color) {
            mat.color.set(data.config.charredColor || '#1c1917');
          }
          if (mat.roughness !== undefined) {
            mat.roughness = 0.95;
          }
        }
      });
    }

    const physicsData = (data.entity.object3D?.userData?.physics as any) || {};
    if (physicsData.flammable) {
      physicsData.flammable.isBurning = false;
    }

    this.burningEntities.delete(entityId);
    this.onExtinguishEvent?.(entityId);
  }

  public isBurning(entityId: string): boolean {
    return this.burningEntities.has(entityId);
  }

  private updateFire(dt: number): void {
    if (this.burningEntities.size === 0) return;

    const toExtinguish: string[] = [];
    const player = this.ecsWorld
      .getAllEntities()
      .find((e) => e.active && e.hasComponent('CharacterController') && e.object3D);

    const windVector = this.getWindVelocity();

    for (const [id, data] of this.burningEntities.entries()) {
      if (!data.entity.active || !data.entity.object3D) {
        toExtinguish.push(id);
        continue;
      }

      // 1. Consume Fuel
      data.config.fuel -= dt;
      if (data.config.fuel <= 0) {
        toExtinguish.push(id);
        continue;
      }

      // 2. Rain cools and extinguishes fire
      if (this.rainConfig.enabled && this.rainConfig.intensity > 0.1) {
        data.config.temperature -= this.rainConfig.intensity * 45 * dt;
        if (data.config.temperature < data.config.ignitionTemperature * 0.4) {
          toExtinguish.push(id);
          continue;
        }
      }

      // 3. Flicker light intensity & color
      if (data.light) {
        data.light.intensity = 2.2 + (Math.random() - 0.5) * 1.4;
      }

      // 4. Intermittent fire crackle sound
      data.audioCooldown -= dt;
      if (data.audioCooldown <= 0) {
        if (Math.random() > 0.45) {
          soundManager.playSFX('fire_crackle');
        }
        data.audioCooldown = 0.6 + Math.random() * 0.8;
      }

      const firePos = data.entity.object3D.position;

      // 5. Fire Damage to Player / Enemies nearby
      data.damageCooldown -= dt;
      if (data.damageCooldown <= 0 && player && player.object3D) {
        const dist = firePos.distanceTo(player.object3D.position);
        if (dist <= data.config.spreadRadius * 0.75) {
          this.onFireDamage?.(player.id, data.config.burnDamage * 0.5);
          data.damageCooldown = 0.5;
        }
      }

      // 6. Thermal propagation to other flammable entities (propagated further downwind)
      // Effective heat center pushed downwind
      const heatCenter = firePos.clone().addScaledVector(windVector, 0.12);

      for (const other of this.ecsWorld.getAllEntities()) {
        if (other.id === id || !other.active || !other.object3D) continue;
        if (this.burningEntities.has(other.id)) continue;

        const otherPhysics = (other.object3D.userData?.physics as any) || {};
        const otherFlammable = otherPhysics.flammable as FlammableConfig | undefined;
        if (!otherFlammable || !otherFlammable.enabled) continue;

        const dist = heatCenter.distanceTo(other.object3D.position);
        if (dist <= data.config.spreadRadius) {
          const heatingRate = (1 - dist / data.config.spreadRadius) * 60 * dt;
          otherFlammable.temperature = (otherFlammable.temperature || 20) + heatingRate;

          if (otherFlammable.temperature >= (otherFlammable.ignitionTemperature || 100)) {
            this.igniteEntity(other, otherFlammable);
          }
        }
      }
    }

    for (const id of toExtinguish) {
      this.extinguishEntity(id);
    }
  }

  // =========================================================================
  // 3. RAIN & WET SURFACES SYSTEM
  // =========================================================================

  public setRainConfig(config: Partial<RainConfig>): void {
    this.rainConfig = { ...this.rainConfig, ...config };
    if (!this.rainConfig.enabled && this.rainParticlesMesh) {
      this.rainParticlesMesh.visible = false;
    }
  }

  private createRainTexture(): THREE.Texture {
    if (this.rainTexture) return this.rainTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createLinearGradient(8, 0, 8, 64);
      grad.addColorStop(0, 'rgba(190, 225, 255, 0)');
      grad.addColorStop(0.3, 'rgba(215, 238, 255, 0.7)');
      grad.addColorStop(0.95, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 1)');
      ctx.fillStyle = grad;
      ctx.fillRect(6, 0, 4, 64);
    }
    this.rainTexture = new THREE.CanvasTexture(canvas);
    return this.rainTexture;
  }

  private initRainMesh(camera: THREE.Camera): void {
    if (this.rainParticlesMesh) return;

    this.rainPositions = new Float32Array(this.rainCount * 3);
    const boxSize = 70;
    const camY = camera.position.y || 0;

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * boxSize;
      this.rainPositions[i * 3 + 1] = camY - 5 + Math.random() * 32;
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;
    }

    this.rainGeometry = new THREE.BufferGeometry();
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3));

    const rainMaterial = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.75,
      map: this.createRainTexture(),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.rainParticlesMesh = new THREE.Points(this.rainGeometry, rainMaterial);
    this.rainParticlesMesh.frustumCulled = false;
    this.scene.add(this.rainParticlesMesh);
  }

  private updateRain(dt: number, camera: THREE.Camera): void {
    if (!this.rainConfig.enabled || this.rainConfig.intensity <= 0) {
      if (this.rainParticlesMesh) this.rainParticlesMesh.visible = false;
      return;
    }

    this.initRainMesh(camera);
    if (!this.rainParticlesMesh || !this.rainPositions || !this.rainGeometry) return;

    this.rainParticlesMesh.visible = true;

    // Follow camera position so rain is always around player/editor camera
    const camPos = camera.position;
    this.rainParticlesMesh.position.x = camPos.x;
    this.rainParticlesMesh.position.z = camPos.z;

    // Wind tilts the rain trajectory
    const windVec = this.getWindVelocity();
    const fallSpeed = (22 + this.rainConfig.intensity * 18) * dt;
    const windPushX = windVec.x * 0.45 * dt;
    const windPushZ = windVec.z * 0.45 * dt;

    const boxSize = 70;
    const halfBox = boxSize / 2;
    const minY = camPos.y - 6;
    const maxY = camPos.y + 26;

    for (let i = 0; i < this.rainCount; i++) {
      this.rainPositions[i * 3 + 1] -= fallSpeed;
      this.rainPositions[i * 3] += windPushX;
      this.rainPositions[i * 3 + 2] += windPushZ;

      // Wrap around Y relative to camera
      if (this.rainPositions[i * 3 + 1] < minY) {
        this.rainPositions[i * 3 + 1] = maxY + Math.random() * 4;
        this.rainPositions[i * 3] = (Math.random() - 0.5) * boxSize;
        this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * boxSize;
      }

      // Wrap around X / Z boundaries
      if (Math.abs(this.rainPositions[i * 3]) > halfBox) {
        this.rainPositions[i * 3] = -Math.sign(this.rainPositions[i * 3]) * halfBox;
      }
      if (Math.abs(this.rainPositions[i * 3 + 2]) > halfBox) {
        this.rainPositions[i * 3 + 2] = -Math.sign(this.rainPositions[i * 3 + 2]) * halfBox;
      }
    }

    this.rainGeometry.attributes.position.needsUpdate = true;

    // Ambient rainfall sound loop
    this.rainAudioCooldown -= dt;
    if (this.rainAudioCooldown <= 0) {
      soundManager.playSFX('rain');
      this.rainAudioCooldown = 1.0;
    }

    // Thunderstorm lightning strikes & thunder rumble
    if (this.rainConfig.isThunder) {
      this.thunderCooldown -= dt;
      if (this.thunderCooldown <= 0) {
        this.triggerLightningStrike(camPos);
        this.thunderCooldown = 6.0 + Math.random() * 10.0;
      }
    }

    // Handle lightning flash fade
    if (this.isLightningFlash) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.isLightningFlash = false;
      }
    }
  }

  private triggerLightningStrike(camPos?: THREE.Vector3): void {
    this.isLightningFlash = true;
    this.lightningTimer = 0.14; // 140ms lightning flash
    soundManager.playSFX('thunder');

    // Create a burst of light
    const flash = new THREE.PointLight(0xdbeafe, 10.0, 140);
    flash.position.set(camPos ? camPos.x : 0, (camPos ? camPos.y : 0) + 25, camPos ? camPos.z : 0);
    this.scene.add(flash);
    setTimeout(() => {
      this.scene.remove(flash);
      flash.dispose();
    }, 140);
  }

  /**
   * Modifies Rapier colliders and vehicles friction to simulate wet / slippery surfaces
   */
  public applyRainToPhysics(entityToCollider: Map<string, RAPIER.Collider>): void {
    if (!this.rainConfig.enabled || this.rainConfig.intensity <= 0) {
      // Restore default friction
      for (const [id, originalFriction] of this.originalFrictions.entries()) {
        const col = entityToCollider.get(id);
        if (col) {
          col.setFriction(originalFriction);
        }
      }
      this.originalFrictions.clear();
      return;
    }

    const reductionFactor = Math.max(0.15, 1.0 - this.rainConfig.intensity * this.rainConfig.wetFrictionReduction);

    for (const [id, col] of entityToCollider.entries()) {
      if (!this.originalFrictions.has(id)) {
        this.originalFrictions.set(id, col.friction());
      }
      const orig = this.originalFrictions.get(id)!;
      col.setFriction(orig * reductionFactor);
    }
  }

  /**
   * Applies Archimedes buoyancy force, fluid drag, wave slope torque, and water current drift
   * to Rapier dynamic rigidbodies when submerged in the water plane.
   */
  public applyBuoyancyToPhysics(
    world: RAPIER.World,
    entityToBody: Map<string, RAPIER.RigidBody>,
    dt: number
  ): void {
    if (!this.waterManager || !this.waterManager.config.enabled) return;

    const waterCfg = this.waterManager.config;
    const buoyancyMult = waterCfg.buoyancyFactor ?? 1.4;
    const waterDrag = waterCfg.waterDrag ?? 1.8;

    for (const [entityId, body] of entityToBody.entries()) {
      if (!body.isDynamic()) continue;

      const entity = this.ecsWorld.getEntity(entityId);
      if (!entity || !entity.object3D) continue;

      const pos = entity.object3D.position;
      const { height: waterSurfaceY, normal: waterNormal } =
        this.waterManager.getWaterHeightAndNormal(pos.x, pos.z);

      // Immersion calculation (standard bounding estimate)
      const immersion = waterSurfaceY - pos.y;
      const submersionThreshold = 0.6; // meter threshold

      if (immersion > -submersionThreshold) {
        // Submerged ratio from 0.0 to 1.0
        const submergedRatio = Math.min(1.0, Math.max(0.0, (immersion + submersionThreshold) / (submersionThreshold * 2.0)));
        const mass = body.mass();

        // 1. Archimedes Upward Buoyant Force (F = m * g * immersionRatio)
        const gravityAcc = 9.81;
        const buoyantForceY = mass * (gravityAcc + 4.5 * buoyancyMult) * submergedRatio;

        // 2. Viscous Fluid Drag (Damping linear & angular velocities in water)
        const linVel = body.linvel();
        const angVel = body.angvel();

        const dragForceX = -linVel.x * waterDrag * submergedRatio * mass;
        const dragForceY = -linVel.y * (waterDrag * 1.5) * submergedRatio * mass;
        const dragForceZ = -linVel.z * waterDrag * submergedRatio * mass;

        // 3. Lateral Flow Drift along wave / wind direction
        const flowDir = waterCfg.flowDirection;
        const currentSpeed = (waterCfg.waveSpeed ?? 1.2) * 0.4;
        const flowPushX = flowDir.x * currentSpeed * submergedRatio * mass * 0.8;
        const flowPushZ = flowDir.z * currentSpeed * submergedRatio * mass * 0.8;

        // Apply net force impulse to Rapier body
        const totalForce = {
          x: (dragForceX + flowPushX) * dt,
          y: (buoyantForceY + dragForceY) * dt,
          z: (dragForceZ + flowPushZ) * dt,
        };

        body.applyImpulse(totalForce, true);

        // 4. Wave Slope Torque Alignment (tilt floating objects with the wave surface)
        if (submergedRatio > 0.3) {
          const up = new THREE.Vector3(0, 1, 0);
          const torqueAxis = new THREE.Vector3().crossVectors(up, waterNormal);
          const tiltAngle = up.angleTo(waterNormal);

          if (tiltAngle > 0.01) {
            const torqueMag = tiltAngle * mass * 0.8 * submergedRatio;
            const angularDamping = 0.85;

            body.applyTorqueImpulse(
              {
                x: (torqueAxis.x * torqueMag - angVel.x * angularDamping * mass) * dt,
                y: (-angVel.y * angularDamping * mass) * dt,
                z: (torqueAxis.z * torqueMag - angVel.z * angularDamping * mass) * dt,
              },
              true
            );
          }
        }

        // 5. Extinguish burning objects when submerged
        if (this.burningEntities.has(entityId) && submergedRatio > 0.4) {
          this.extinguishEntity(entityId);
          soundManager.playSFX('water');
        }

        // 6. Audio splash trigger on entry
        if (Math.abs(linVel.y) > 2.0 && submergedRatio < 0.6) {
          this.waterManager.playSplashSound();
        }
      }
    }
  }

  // =========================================================================
  // MASTER STEP & VISUAL METHODS
  // =========================================================================

  /**
   * Runs visual simulations (rain particles, wind streaks, lightning, ambient audio, fire lights)
   * This is called every frame in both Editor Mode and Play Mode!
   */
  public updateVisuals(dt: number, camera: THREE.Camera): void {
    this.updateWind(dt, camera);
    this.updateRain(dt, camera);
    if (this.waterManager) {
      this.waterManager.update(dt, camera.position);
    }

    // Update fire lights & intermittent crackles
    if (this.burningEntities.size > 0) {
      for (const [, data] of this.burningEntities.entries()) {
        if (data.light) {
          data.light.intensity = 2.2 + (Math.random() - 0.5) * 1.4;
        }
        data.audioCooldown -= dt;
        if (data.audioCooldown <= 0) {
          if (Math.random() > 0.45) {
            soundManager.playSFX('fire_crackle');
          }
          data.audioCooldown = 0.6 + Math.random() * 0.8;
        }
      }
    }
  }

  /**
   * Steps Rapier physics forces, combustion fuel/damage, and wet surfaces friction
   */
  public stepPhysics(
    dt: number,
    world: RAPIER.World,
    entityToBody: Map<string, RAPIER.RigidBody>,
    entityToCollider: Map<string, RAPIER.Collider>
  ): void {
    this.applyWindToPhysics(world, entityToBody, dt);
    this.applyBuoyancyToPhysics(world, entityToBody, dt);
    this.updateFire(dt);
    this.applyRainToPhysics(entityToCollider);
  }

  public step(
    dt: number,
    world: RAPIER.World,
    entityToBody: Map<string, RAPIER.RigidBody>,
    entityToCollider: Map<string, RAPIER.Collider>,
    camera: THREE.Camera
  ): void {
    this.updateVisuals(dt, camera);
    this.stepPhysics(dt, world, entityToBody, entityToCollider);
  }

  public dispose(): void {
    // Extinguish all fires
    for (const id of Array.from(this.burningEntities.keys())) {
      this.extinguishEntity(id);
    }
    // Dispose rain mesh
    if (this.rainParticlesMesh) {
      this.scene.remove(this.rainParticlesMesh);
      this.rainGeometry?.dispose();
      (this.rainParticlesMesh.material as THREE.Material).dispose();
      this.rainParticlesMesh = null;
    }
    this.originalFrictions.clear();
  }
}
