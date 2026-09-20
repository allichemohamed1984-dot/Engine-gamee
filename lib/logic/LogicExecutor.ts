import * as THREE from 'three';
import { Entity, ECSWorld } from '../ecs/ECS';
import {
  EntityLogicData,
  BehaviorCard,
  CollectableConfig,
  PatrolConfig,
  TriggerZoneConfig,
  DamageOnTouchConfig,
  WindZoneBehaviorConfig,
  FlammableBehaviorConfig,
  WeatherListenerConfig,
  BuoyantConfig,
  NavMeshAgentConfig,
  TriggerVolumeBehaviorConfig,
  NodeGraphData,
  GraphNodeData,
  Script,
} from '../../types/logic';
import { SoundEngine } from '../audio/SoundSynth';
import { ScriptSandbox } from './ScriptSandbox';
import { ParticleManager } from '../vfx/ParticleManager';
import { AnimationManager } from '../animation/AnimationManager';
import { soundManager, SFXType, BGMMode } from '../SoundManager';
import { ParticlePreset } from '../../types/engine';
import { EnvironmentalPhysicsManager } from '../physics/EnvironmentalPhysicsManager';
import { NavMeshManager } from '../navigation/NavMeshManager';
import { TriggerVolumeManager } from '../navigation/TriggerVolumeManager';

/**
 * LogicExecutor
 * Orchestrates the 3-Tier logic engine (Cards, Node Graph, Custom Scripts)
 * for all entities in the ECS World during simulation.
 */
export class LogicExecutor {
  private ecsWorld: ECSWorld;
  public scene?: THREE.Scene;
  public particleManager?: ParticleManager;
  public animationManager?: AnimationManager;
  public environmentalPhysics?: EnvironmentalPhysicsManager;
  public navMeshManager?: NavMeshManager;
  public triggerVolumeManager?: TriggerVolumeManager;
  public onPlaySkeletalAnimation?: (entityId: string, animationName: string) => void;
  public onShootProjectile?: (entityId: string, prefabId: string, speed: number, damage: number) => void;
  public onDamageEntity?: (entityId: string, damage: number, currentHealth: number) => void;
  private isRunning: boolean = false;
  private elapsedTime: number = 0;

  // Active runtime script instances (Level 3)
  private scriptInstances: Map<string, Script> = new Map();

  // Runtime state for Level 1 behavior cards
  private initialTransforms: Map<string, { pos: THREE.Vector3; rot: THREE.Euler }> = new Map();
  private patrolStates: Map<string, { currentDist: number; direction: number }> = new Map();
  private triggerCooldowns: Map<string, number> = new Map();

  // Runtime state for Level 2 node graphs
  private pressedKeys: Set<string> = new Set();
  private keyListener: ((e: KeyboardEvent) => void) | null = null;
  private triggerInsideStates: Map<string, boolean> = new Map();
  private entityTimerAccumulators: Map<string, Record<string, number>> = new Map();

  // Global game state variables (Score, Health, etc.)
  public globalState: {
    score: number;
    health: number;
    inventory: string[];
    variables: Record<string, any>;
  } = {
    score: 0,
    health: 100,
    inventory: [],
    variables: {},
  };

  // Cutscene & Dialogue State
  public dialogueState: {
    active: boolean;
    speaker: string;
    text: string;
    portrait?: string;
    duration: number;
    timer: number;
  } = {
    active: false,
    speaker: '',
    text: '',
    duration: 5.0,
    timer: 0,
  };

  public cinematicState: {
    active: boolean;
    targetCameraName: string | null;
    blendDuration: number;
    depthOfFieldBlur: number;
  } = {
    active: false,
    targetCameraName: null,
    blendDuration: 1.0,
    depthOfFieldBlur: 0,
  };

  public floatingTexts: Array<{
    id: string;
    text: string;
    x: number;
    y: number;
    z: number;
    color: string;
    timer: number;
  }> = [];

  constructor(ecsWorld: ECSWorld) {
    this.ecsWorld = ecsWorld;
  }

  public getVariables() {
    return {
      ...this.globalState.variables,
      Score: this.globalState.score,
      Health: this.globalState.health,
    };
  }

  public dispatchAllVariables(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('aether_update_var', {
          detail: this.getVariables(),
        })
      );
    }
  }

  public setVariable(name: string, value: any) {
    if (name === 'Score') this.globalState.score = Number(value);
    else if (name === 'Health') this.globalState.health = Number(value);
    else this.globalState.variables[name] = value;
    ScriptSandbox.setVariable(name, value);
    this.dispatchAllVariables();
  }

  public startSimulation(): void {
    this.isRunning = true;
    this.elapsedTime = 0;
    this.globalState.score = 0;
    this.globalState.health = 100;
    this.dispatchAllVariables();
    this.scriptInstances.clear();
    this.initialTransforms.clear();
    this.patrolStates.clear();
    this.triggerCooldowns.clear();
    this.pressedKeys.clear();
    this.triggerInsideStates.clear();
    this.entityTimerAccumulators.clear();

    // Bind key events for OnKeyPress nodes
    if (typeof window !== 'undefined') {
      this.keyListener = (e: KeyboardEvent) => {
        if (!this.isRunning) return;
        this.pressedKeys.add(e.code);
        this.handleKeyPress(e.code);
      };
      window.addEventListener('keydown', this.keyListener);
    }

    const entities = this.ecsWorld.getAllEntities();

    // 1. Snapshot initial transforms
    for (const entity of entities) {
      if (entity.object3D) {
        this.initialTransforms.set(entity.id, {
          pos: entity.object3D.position.clone(),
          rot: entity.object3D.rotation.clone(),
        });
      }

      const logicData = entity.object3D?.userData?.logic as EntityLogicData | undefined;
      if (!logicData) continue;

      // 2. Initialize Level 2 Node Graph OnStart events
      if (logicData.nodeGraph?.enabled) {
        this.executeGraphEvents(entity, 'OnStart');
      }

      // 3. Initialize Level 3 Custom Scripts
      if (logicData.customScript?.enabled && logicData.customScript.code) {
        const { ScriptClass, error } = ScriptSandbox.compile(logicData.customScript.code);
        if (ScriptClass) {
          const instance = ScriptSandbox.instantiate(
            ScriptClass,
            entity,
            (name) => this.findEntityByName(name),
            (ent) => this.destroyEntity(ent)
          );
          if (instance) {
            this.scriptInstances.set(entity.id, instance);
            try {
              instance.onStart();
            } catch (err: any) {
              ScriptSandbox.addLog(`[Script Error on ${entity.name}] onStart: ${err.message}`, 'error');
            }
          }
        } else if (error) {
          ScriptSandbox.addLog(`[Script Syntax Error on ${entity.name}]: ${error}`, 'error');
        }
      }
    }
  }

  public stopSimulation(): void {
    this.isRunning = false;
    if (this.keyListener && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.keyListener);
      this.keyListener = null;
    }
    this.scriptInstances.clear();
    this.triggerInsideStates.clear();
    this.entityTimerAccumulators.clear();
    
    // Silence procedural BGM loops
    soundManager.setBGMMode('off');

    // Restore initial entity states (un-hide collected entities)
    const entities = this.ecsWorld.getAllEntities();
    for (const entity of entities) {
      entity.active = true;
      if (entity.object3D) {
        entity.object3D.visible = true;
        const initial = this.initialTransforms.get(entity.id);
        if (initial) {
          entity.object3D.position.copy(initial.pos);
          entity.object3D.rotation.copy(initial.rot);
        }
      }
    }
  }

  public update(dt: number): void {
    if (!this.isRunning) return;
    this.elapsedTime += dt;

    // Update Trigger Volumes & Checkpoints
    if (this.triggerVolumeManager) {
      this.triggerVolumeManager.update(
        dt,
        this.elapsedTime,
        this.ecsWorld.getAllEntities(),
        () => playerEntity,
        this.isRunning
      );
    }

    // Update NavMesh Agent Pathfinding Steering
    if (this.navMeshManager && this.isRunning) {
      this.navMeshManager.updateAgents(
        dt,
        (id) => {
          const ent = this.ecsWorld.getEntity(id);
          return ent?.object3D?.position || null;
        },
        () => playerEntity?.object3D?.position || null
      );
    }

    // Update floating damage texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.timer -= dt;
      ft.y += dt * 1.5;
      if (ft.timer <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }

    const entities = this.ecsWorld.getAllEntities().filter((e) => e.active);

    // Find the player entity for proximity checks (CharacterController or subType === 'player')
    const playerEntity =
      entities.find(
        (e) =>
          e.object3D?.userData?.subType === 'player' ||
          e.hasComponent('CharacterController') ||
          e.name.toLowerCase().includes('player')
      ) || null;

    for (const entity of entities) {
      const obj = entity.object3D;
      if (!obj) continue;

      const logicData = obj.userData?.logic as EntityLogicData | undefined;
      if (!logicData) continue;

      // ----------------------------------------------------
      // LEVEL 1: BEHAVIOR CARDS UPDATE
      // ----------------------------------------------------
      if (logicData.cards && logicData.cards.length > 0) {
        for (const card of logicData.cards) {
          if (!card.enabled) continue;

          switch (card.type) {
            case 'Collectable': {
              const cfg = card.config as CollectableConfig;
              // Spin mesh
              const rotSpeed = ((cfg.rotateSpeed ?? 90) * Math.PI) / 180;
              obj.rotation.y += rotSpeed * dt;

              // Floating bob
              const initial = this.initialTransforms.get(entity.id);
              if (initial) {
                const hoverAmp = cfg.hoverAmplitude ?? 0.2;
                const hoverSpd = cfg.hoverSpeed ?? 2.5;
                obj.position.y = initial.pos.y + Math.sin(this.elapsedTime * hoverSpd) * hoverAmp;
              }

              // Proximity collection check with Player
              if (playerEntity && playerEntity.object3D) {
                const dist = obj.position.distanceTo(playerEntity.object3D.position);
                if (dist < 1.4) {
                  this.collectEntity(entity, cfg);
                }
              }
              break;
            }

            case 'Patrol': {
              const cfg = card.config as PatrolConfig;
              let state = this.patrolStates.get(entity.id);
              if (!state) {
                state = { currentDist: 0, direction: 1 };
                this.patrolStates.set(entity.id, state);
              }

              const moveStep = (cfg.speed ?? 3.0) * dt * state.direction;
              const axis = cfg.axis || 'x';
              const maxDist = cfg.distance ?? 6.0;

              obj.position[axis] += moveStep;
              state.currentDist += Math.abs(moveStep);

              if (state.currentDist >= maxDist) {
                state.direction *= -1;
                state.currentDist = 0;
                // Turn mesh facing direction
                if (axis === 'x') {
                  obj.rotation.y = state.direction > 0 ? 0 : Math.PI;
                } else if (axis === 'z') {
                  obj.rotation.y = state.direction > 0 ? Math.PI / 2 : -Math.PI / 2;
                }
              }
              break;
            }

            case 'TriggerZone': {
              const cfg = card.config as TriggerZoneConfig;
              if (playerEntity && playerEntity.object3D) {
                const dist = obj.position.distanceTo(playerEntity.object3D.position);
                const radius = cfg.radius ?? 3.0;
                const isInside = dist <= radius;
                const wasInside = this.triggerInsideStates.get(entity.id) || false;

                if (isInside && !wasInside) {
                  this.triggerInsideStates.set(entity.id, true);
                  // Execute Trigger action
                  if (cfg.soundPreset && cfg.soundPreset !== 'none') {
                    SoundEngine.play(cfg.soundPreset);
                  }
                  if (cfg.action === 'EmitPulse') {
                    this.pulseEntity(entity);
                  }
                  if (cfg.message) {
                    ScriptSandbox.addLog(`[Zone Trigger: ${entity.name}] ${cfg.message}`, 'log');
                  }
                  this.executeGraphEvents(entity, 'OnTriggerEnter', { target: playerEntity });
                } else if (!isInside && wasInside) {
                  this.triggerInsideStates.set(entity.id, false);
                  ScriptSandbox.addLog(`[Zone Sortie: ${entity.name}] Le joueur est sorti de la zone`, 'log');
                  this.executeGraphEvents(entity, 'OnTriggerExit', { target: playerEntity });
                }
              }
              break;
            }

            case 'DamageOnTouch': {
              const cfg = card.config as DamageOnTouchConfig;
              if (playerEntity && playerEntity.object3D) {
                const dist = obj.position.distanceTo(playerEntity.object3D.position);
                if (dist < 1.3) {
                  const lastHit = this.triggerCooldowns.get(`dmg_${entity.id}`) || 0;
                  if (this.elapsedTime - lastHit > (cfg.cooldown ?? 1.0)) {
                    this.triggerCooldowns.set(`dmg_${entity.id}`, this.elapsedTime);
                    this.applyDamageOnTouch(entity, playerEntity, cfg);
                  }
                }
              }
              break;
            }

            case 'WindZone': {
              const cfg = card.config as WindZoneBehaviorConfig;
              if (obj.userData) {
                obj.userData.physics = obj.userData.physics || {};
                obj.userData.physics.windZone = {
                  enabled: true,
                  mode: cfg.mode || 'directional',
                  force: cfg.force || 25,
                  radius: cfg.radius || 6,
                  direction: cfg.direction || { x: 0, y: 1, z: 0 },
                };
              }
              break;
            }

            case 'Flammable': {
              const cfg = card.config as FlammableBehaviorConfig;
              if (obj.userData) {
                obj.userData.physics = obj.userData.physics || {};
                obj.userData.physics.flammable = {
                  enabled: true,
                  isBurning: cfg.autoIgniteOnStart ? true : (obj.userData.physics.flammable?.isBurning || false),
                  temperature: cfg.autoIgniteOnStart ? 250 : (obj.userData.physics.flammable?.temperature || 20),
                  ignitionTemperature: cfg.ignitionTemperature || 100,
                  fuel: cfg.burnDuration || 15,
                  maxFuel: cfg.burnDuration || 15,
                  spreadRadius: cfg.spreadRadius || 3.0,
                  burnDamage: cfg.burnDamage || 15,
                };
              }
              if (cfg.autoIgniteOnStart && this.environmentalPhysics && !this.environmentalPhysics.isBurning(entity.id)) {
                this.environmentalPhysics.igniteEntity(entity);
              }
              break;
            }

            case 'WeatherListener': {
              const cfg = card.config as WeatherListenerConfig;
              const isRaining = this.environmentalPhysics?.rainConfig.enabled;
              const windSpeed = this.environmentalPhysics?.windConfig.speed || 0;
              const isWindy = Boolean(this.environmentalPhysics?.windConfig.enabled && windSpeed >= (cfg.windSpeedThreshold || 30));

              if ((cfg.reactTo === 'rain' && isRaining) ||
                  (cfg.reactTo === 'wind' && isWindy) ||
                  (cfg.reactTo === 'any' && (isRaining || isWindy))) {
                const lastTrig = this.triggerCooldowns.get(`weather_${entity.id}`) || 0;
                if (this.elapsedTime - lastTrig > 4.0) {
                  this.triggerCooldowns.set(`weather_${entity.id}`, this.elapsedTime);
                  if (cfg.action === 'Ignite' && this.environmentalPhysics) {
                    this.environmentalPhysics.igniteEntity(entity);
                  } else if (cfg.action === 'Extinguish' && this.environmentalPhysics) {
                    this.environmentalPhysics.extinguishEntity(entity.id);
                  } else if (cfg.action === 'PlaySound' && cfg.soundPreset !== 'none') {
                    SoundEngine.play(cfg.soundPreset);
                  }
                }
              }
              break;
            }

            case 'Buoyant': {
              const cfg = card.config as BuoyantConfig;
              if (this.environmentalPhysics?.waterManager) {
                const waterMgr = this.environmentalPhysics.waterManager;
                const waterData = waterMgr.getWaterHeightAndNormal(obj.position.x, obj.position.z);
                const immersion = waterData.height - obj.position.y;
                if (immersion > 0) {
                  // Floating motion for non-physics objects or kinematic entities
                  const mult = cfg.buoyancyMultiplier ?? 1.3;
                  const targetY = waterData.height + 0.1;
                  obj.position.y += (targetY - obj.position.y) * Math.min(1.0, 5.0 * mult * dt);

                  if (cfg.alignToWaveNormal) {
                    const normal = waterData.normal;
                    const targetRotX = Math.atan2(-normal.z, normal.y) * 0.5;
                    const targetRotZ = Math.atan2(normal.x, normal.y) * 0.5;
                    obj.rotation.x += (targetRotX - obj.rotation.x) * 4.0 * dt;
                    obj.rotation.z += (targetRotZ - obj.rotation.z) * 4.0 * dt;
                  }
                }
              }
              break;
            }

            case 'NavMeshAgent': {
              const cfg = card.config as NavMeshAgentConfig;
              if (this.navMeshManager) {
                if (!this.navMeshManager.isBaked && this.scene) {
                  this.navMeshManager.bakeNavMesh(this.scene);
                }
                this.navMeshManager.registerAgent(entity.id, cfg);
              }
              break;
            }

            case 'TriggerVolume': {
              const cfg = card.config as TriggerVolumeBehaviorConfig;
              if (this.triggerVolumeManager) {
                this.triggerVolumeManager.registerVolume(entity.id, cfg, obj);
              }
              break;
            }
          }
        }
      }

      // ----------------------------------------------------
      // LEVEL 2: NODE GRAPH ONUPDATE
      // ----------------------------------------------------
      if (logicData.nodeGraph?.enabled) {
        this.executeGraphEvents(entity, 'OnUpdate', { dt });

        // Process periodic OnTimer events
        if (logicData.nodeGraph.nodes) {
          logicData.nodeGraph.nodes.forEach((node) => {
            if (node.type === 'OnTimer') {
              const interval = Number(node.values.interval ?? 2.0);
              let timers = this.entityTimerAccumulators.get(entity.id);
              if (!timers) {
                timers = {};
                this.entityTimerAccumulators.set(entity.id, timers);
              }
              const lastTime = timers[node.id] ?? 0;
              if (this.elapsedTime - lastTime >= interval) {
                timers[node.id] = this.elapsedTime;
                this.triggerNodeOutput(entity, logicData.nodeGraph!, node.id, 'out_flow', { dt });
              }
            }
          });
        }
      }

      // ----------------------------------------------------
      // LEVEL 3: CUSTOM SCRIPT ONUPDATE
      // ----------------------------------------------------
      const script = this.scriptInstances.get(entity.id);
      if (script) {
        try {
          script.onUpdate(dt);
        } catch (err: any) {
          ScriptSandbox.addLog(`[Script Error on ${entity.name}] onUpdate: ${err.message}`, 'error');
        }
      }
    }
  }

  /**
   * Collision dispatcher: dispatches to Cards, Node Graphs and Scripts
   */
  public handleCollision(entityA: Entity, entityB: Entity): void {
    if (!this.isRunning) return;

    // Dispatch Level 2 Node Graph OnCollision
    this.executeGraphEvents(entityA, 'OnCollision', { other: entityB });
    this.executeGraphEvents(entityB, 'OnCollision', { other: entityA });

    // Dispatch Level 3 Custom Script onCollision
    const scriptA = this.scriptInstances.get(entityA.id);
    if (scriptA) {
      try {
        scriptA.onCollision(entityB);
      } catch (err: any) {
        ScriptSandbox.addLog(`[Script Error on ${entityA.name}] onCollision: ${err.message}`, 'error');
      }
    }

    const scriptB = this.scriptInstances.get(entityB.id);
    if (scriptB) {
      try {
        scriptB.onCollision(entityA);
      } catch (err: any) {
        ScriptSandbox.addLog(`[Script Error on ${entityB.name}] onCollision: ${err.message}`, 'error');
      }
    }
  }

  /**
   * Keyboard dispatcher for Level 2 OnKeyPress nodes
   */
  private handleKeyPress(keyCode: string): void {
    console.log(`[Logic] Key pressed: ${keyCode}`);
    const entities = this.ecsWorld.getAllEntities().filter((e) => e.active);
    for (const entity of entities) {
      const logicData = entity.object3D?.userData?.logic as EntityLogicData | undefined;
      if (!logicData?.nodeGraph?.enabled) continue;

      const graph = logicData.nodeGraph;
      const keyNodes = graph.nodes.filter(
        (n) => n.type === 'OnKeyPress' && (n.values.key === keyCode || keyCode.includes(n.values.key))
      );

      for (const node of keyNodes) {
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', {});
      }
    }
  }

  // ==========================================
  // NODE GRAPH RUNTIME EXECUTION ENGINE
  // ==========================================

  public executeGraphEvents(entity: Entity, eventType: string, eventData: Record<string, any> = {}): void {
    const logicData = entity.object3D?.userData?.logic as EntityLogicData | undefined;
    if (!logicData?.nodeGraph?.enabled) return;

    console.log(`[Logic] Executing event ${eventType} for ${entity.id}`);
    const graph = logicData.nodeGraph;
    if (graph) {
      console.log(`[Logic] NodeGraph enabled:`, graph.enabled);
      console.log(`[Logic] NodeGraph nodes:`, JSON.stringify(graph.nodes.map(n => ({id: n.id, type: n.type})), null, 2));
    }
    const matchingNodes = graph.nodes.filter((n) => {
      if (n.type !== eventType) return false;
      if (eventType === 'OnCustomEvent') {
        const requiredEvent = n.values.eventName || 'custom_msg';
        const receivedEvent = eventData.eventName || '';
        return requiredEvent.toLowerCase() === receivedEvent.toLowerCase();
      }
      return true;
    });

    console.log(`[Logic] Found ${matchingNodes.length} nodes for event ${eventType}`);
    for (const node of matchingNodes) {
      console.log(`[Logic] Triggering node ${node.id} (${node.type})`);
      this.triggerNodeOutput(entity, graph, node.id, 'out_flow', eventData);
    }
  }

  private triggerNodeOutput(
    entity: Entity,
    graph: NodeGraphData,
    fromNodeId: string,
    outputSocketId: string,
    dataContext: Record<string, any>
  ): void {
    const outgoing = graph.connections.filter(
      (c) => c.fromNodeId === fromNodeId && c.fromSocketId === outputSocketId
    );

    for (const conn of outgoing) {
      const targetNode = graph.nodes.find((n) => n.id === conn.toNodeId);
      if (targetNode) {
        this.executeGraphNode(entity, graph, targetNode, conn.toSocketId, dataContext);
      }
    }
  }

  private executeGraphNode(
    entity: Entity,
    graph: NodeGraphData,
    node: GraphNodeData,
    _entrySocket: string,
    context: Record<string, any>
  ): void {
    console.log(`[Logic] Executing node ${node.id} (${node.type})`);
    switch (node.type) {
      case 'IfElse': {
        const cond = Boolean(context.condition ?? context.result ?? node.values.condition ?? true);
        const outSocket = cond ? 'out_true' : 'out_false';
        this.triggerNodeOutput(entity, graph, node.id, outSocket, context);
        break;
      }

      case 'Compare': {
        const a = Number(context.a ?? node.values.a ?? 0);
        const b = Number(context.b ?? node.values.b ?? 0);
        const op = node.values.operator || '==';
        let res = false;
        if (op === '==') res = a === b;
        else if (op === '!=') res = a !== b;
        else if (op === '>') res = a > b;
        else if (op === '<') res = a < b;
        else if (op === '>=') res = a >= b;
        else if (op === '<=') res = a <= b;
        this.triggerNodeOutput(entity, graph, node.id, 'out_result', { ...context, condition: res, result: res });
        break;
      }

      case 'Gate': {
        const a = Boolean(context.a ?? node.values.a ?? false);
        const b = Boolean(context.b ?? node.values.b ?? false);
        const gate = node.values.gate || 'AND';
        let res = false;
        if (gate === 'AND') res = a && b;
        else if (gate === 'OR') res = a || b;
        else if (gate === 'NOT') res = !a;
        else if (gate === 'XOR') res = (a && !b) || (!a && b);
        this.triggerNodeOutput(entity, graph, node.id, 'out_result', { ...context, condition: res, result: res });
        break;
      }

      case 'Math': {
        const a = Number(context.a ?? node.values.a ?? 0);
        const b = Number(context.b ?? node.values.b ?? 0);
        const op = node.values.operation || '+';
        let res = 0;
        if (op === '+') res = a + b;
        else if (op === '-') res = a - b;
        else if (op === '*') res = a * b;
        else if (op === '/') res = b !== 0 ? a / b : 0;
        else if (op === '%') res = b !== 0 ? a % b : 0;
        this.triggerNodeOutput(entity, graph, node.id, 'out_result', { ...context, val: res, value: res });
        break;
      }

      case 'Clamp': {
        const val = Number(context.val ?? context.value ?? node.values.val ?? 0);
        const min = Number(node.values.min ?? 0);
        const max = Number(node.values.max ?? 100);
        const res = Math.min(Math.max(val, min), max);
        this.triggerNodeOutput(entity, graph, node.id, 'out_val', { ...context, val: res, value: res });
        break;
      }

      case 'Lerp': {
        const a = Number(context.a ?? node.values.a ?? 0);
        const b = Number(context.b ?? node.values.b ?? 1);
        const t = Number(context.t ?? node.values.t ?? 0.1);
        const res = a + (b - a) * Math.min(Math.max(t, 0), 1);
        this.triggerNodeOutput(entity, graph, node.id, 'out_val', { ...context, val: res, value: res });
        break;
      }

      case 'Random': {
        const min = Number(node.values.min ?? 1);
        const max = Number(node.values.max ?? 10);
        const res = Math.floor(Math.random() * (max - min + 1)) + min;
        this.triggerNodeOutput(entity, graph, node.id, 'out_val', { ...context, val: res, value: res });
        break;
      }

      case 'Toggle': {
        const currentState = !node.values.state;
        node.values.state = currentState;
        const outSocket = currentState ? 'out_on' : 'out_off';
        this.triggerNodeOutput(entity, graph, node.id, outSocket, { ...context, state: currentState });
        this.triggerNodeOutput(entity, graph, node.id, 'out_state', { ...context, state: currentState });
        break;
      }

      case 'Counter': {
        const step = Number(node.values.step ?? 1);
        let count = Number(node.values.current ?? 0) + step;
        node.values.current = count;
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', { ...context, count, value: count });
        this.triggerNodeOutput(entity, graph, node.id, 'out_count', { ...context, count, value: count });
        break;
      }

      case 'Delay': {
        const dur = Number(node.values.duration ?? 1.0);
        setTimeout(() => {
          if (this.isRunning) {
            this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
          }
        }, dur * 1000);
        break;
      }

      case 'PlaySound': {
        const sound = node.values.sound || 'coin';
        SoundEngine.play(sound);
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetVariable': {
        const varName = node.values.variable || 'Score';
        const amount = Number(context.amount ?? node.values.amount ?? 10);
        const op = node.values.operation || 'add';

        let current = this.globalState.variables[varName] ?? (varName === 'Score' ? this.globalState.score : 0);
        if (op === 'add') current += amount;
        else if (op === 'subtract') current -= amount;
        else current = amount;

        this.setVariable(varName, current);
        ScriptSandbox.addLog(`[Var] ${varName} = ${current}`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', { ...context, value: current });
        break;
      }

      case 'GetVariable': {
        const varName = node.values.variable || 'Score';
        const current = this.globalState.variables[varName] ?? (varName === 'Score' ? this.globalState.score : 0);
        this.triggerNodeOutput(entity, graph, node.id, 'out_val', { ...context, val: current, value: current });
        break;
      }

      case 'ApplyImpulse': {
        const force = Number(node.values.force ?? 10);
        const targetEntity = context.other || context.target || entity;
        if (targetEntity?.object3D) {
          targetEntity.object3D.position.y += force * 0.08;
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetPosition': {
        const target = context.target || entity;
        if (target?.object3D) {
          const px = Number(node.values.posX ?? target.object3D.position.x);
          const py = Number(node.values.posY ?? target.object3D.position.y);
          const pz = Number(node.values.posZ ?? target.object3D.position.z);
          target.object3D.position.set(px, py, pz);
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetRotation': {
        const target = context.target || entity;
        if (target?.object3D) {
          const ry = (Number(node.values.rotY ?? 90) * Math.PI) / 180;
          target.object3D.rotation.y += ry;
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetScale': {
        const target = context.target || entity;
        if (target?.object3D) {
          const s = Number(node.values.scale ?? 1.5);
          target.object3D.scale.set(s, s, s);
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetColor': {
        const target = context.target || entity;
        const col = node.values.color || '#10b981';
        if (target?.object3D) {
          target.object3D.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh && child.material) {
              const mat = child.material as THREE.MeshStandardMaterial;
              mat.color?.set(col);
            }
          });
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ShootProjectile': {
        if (this.onShootProjectile) {
          const prefabId = String(node.values.prefabId || 'Bullet');
          const speed = Number(node.values.speed ?? 20);
          const damage = Number(node.values.damage ?? 10);
          this.onShootProjectile(entity.id, prefabId, speed, damage);
          ScriptSandbox.addLog(`[Action] Tir de ${prefabId} par ${entity.id}`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SpawnPrefab': {
        SoundEngine.play('warp');
        ScriptSandbox.addLog(`[Spawn] Entité ${node.values.prefab || 'objet'} générée !`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PrintLog': {
        const msg = String(node.values.message || 'Log triggered');
        ScriptSandbox.addLog(`[Graph Log] ${msg}`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'CameraShake': {
        SoundEngine.play('hit');
        ScriptSandbox.addLog(`[FX] Secousse Caméra !`, 'warn');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'EmitParticles': {
        const preset = (node.values.preset || context.preset || 'fire') as ParticlePreset;
        const rate = Number(node.values.rate ?? 50);
        const targetEntity = context.target || entity;
        const emitterId = `node_p_${targetEntity.id}_${preset}`;

        if (this.particleManager) {
          const config = ParticleManager.getDefaultPresetConfig(preset);
          config.rate = rate > 0 ? rate : config.rate;
          const pos = targetEntity.object3D?.position ?? new THREE.Vector3();
          this.particleManager.createOrUpdateEmitter(emitterId, config, pos, targetEntity.object3D);
        }

        ScriptSandbox.addLog(`[VFX] Émission particules (${preset}) sur ${targetEntity.id}`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ExplosionFX': {
        const scale = Number(node.values.scale ?? 1.0);
        const force = Number(node.values.force ?? 10.0);
        const targetEntity = context.target || entity;
        const pos = targetEntity.object3D?.position ? targetEntity.object3D.position.clone() : new THREE.Vector3();

        if (this.particleManager) {
          this.particleManager.triggerExplosion(pos, scale, force);
        }

        SoundEngine.play('hit');
        ScriptSandbox.addLog(`[VFX] Explosion FX (Taille: ${scale}, Force: ${force}) !`, 'warn');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'StopParticles': {
        const targetEntity = context.target || entity;
        const preset = node.values.preset || 'fire';
        const emitterId = `node_p_${targetEntity.id}_${preset}`;

        if (this.particleManager) {
          this.particleManager.stopEmitter(emitterId);
        }

        ScriptSandbox.addLog(`[VFX] Arrêt particules (${preset})`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // AI & NPC NAVIGATION NODE HANDLERS
      // ==========================================
      case 'FollowTarget': {
        const speed = Number(context.speed ?? node.values.speed ?? 3.5);
        const stopDist = Number(context.stopDistance ?? node.values.stopDistance ?? 1.2);
        const dt = Number(context.dt ?? 0.016);

        // Find target player entity or context target
        const targetEntity = context.target || this.ecsWorld.getAllEntities().find(
          (e) => e.active && (e.object3D?.userData?.subType === 'player' || e.name.toLowerCase().includes('player'))
        );

        let reached = false;
        if (entity.object3D && targetEntity && targetEntity.object3D) {
          const selfPos = entity.object3D.position;
          const targetPos = targetEntity.object3D.position;
          const dist = selfPos.distanceTo(targetPos);

          if (dist > stopDist) {
            // Move towards target
            const dir = new THREE.Vector3().subVectors(targetPos, selfPos).setY(0).normalize();
            selfPos.addScaledVector(dir, speed * dt);
            // Face target
            const angle = Math.atan2(dir.x, dir.z);
            entity.object3D.rotation.y = angle;
          } else {
            reached = true;
          }
        }

        this.triggerNodeOutput(entity, graph, node.id, 'out_reached', { ...context, reached });
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PatrolWaypoints': {
        const speed = Number(node.values.speed ?? 2.5);
        const dt = Number(context.dt ?? 0.016);

        if (entity.object3D) {
          // Find waypoint entities or compute oscillating patrol
          const waypoints = this.ecsWorld.getAllEntities().filter(
            (e) => e.active && e.name.toLowerCase().includes('waypoint')
          );

          if (waypoints.length > 0) {
            const currentIdx = Number(node.values.wpIndex || 0);
            const targetWp = waypoints[currentIdx % waypoints.length];
            if (targetWp.object3D) {
              const selfPos = entity.object3D.position;
              const wpPos = targetWp.object3D.position;
              const dist = selfPos.distanceTo(wpPos);

              if (dist < 0.8) {
                node.values.wpIndex = (currentIdx + 1) % waypoints.length;
              } else {
                const dir = new THREE.Vector3().subVectors(wpPos, selfPos).setY(0).normalize();
                selfPos.addScaledVector(dir, speed * dt);
                entity.object3D.rotation.y = Math.atan2(dir.x, dir.z);
              }
            }
          } else {
            // Ping-pong patrol default around initial pos
            const delta = Math.sin(this.elapsedTime * speed * 0.8) * speed * dt * 2.0;
            entity.object3D.position.x += delta;
            entity.object3D.rotation.y = delta > 0 ? 0 : Math.PI;
          }
        }

        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'CheckDistance': {
        const threshold = Number(node.values.threshold ?? 8.0);
        const targetEntity = context.target || this.ecsWorld.getAllEntities().find(
          (e) => e.active && (e.object3D?.userData?.subType === 'player' || e.name.toLowerCase().includes('player'))
        );

        let dist = 999;
        let inRange = false;

        if (entity.object3D && targetEntity && targetEntity.object3D) {
          dist = entity.object3D.position.distanceTo(targetEntity.object3D.position);
          inRange = dist <= threshold;
        }

        this.triggerNodeOutput(entity, graph, node.id, 'out_range', { ...context, inRange, condition: inRange });
        this.triggerNodeOutput(entity, graph, node.id, 'out_dist', { ...context, dist, distance: dist });
        break;
      }

      case 'LookAtPlayer': {
        const targetEntity = context.target || this.ecsWorld.getAllEntities().find(
          (e) => e.active && (e.object3D?.userData?.subType === 'player' || e.name.toLowerCase().includes('player'))
        );

        if (entity.object3D && targetEntity && targetEntity.object3D) {
          const dir = new THREE.Vector3().subVectors(targetEntity.object3D.position, entity.object3D.position);
          const targetAngle = Math.atan2(dir.x, dir.z);
          entity.object3D.rotation.y = THREE.MathUtils.lerp(entity.object3D.rotation.y, targetAngle, 0.1);
        }

        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // DYNAMIC LIGHTING NODE HANDLERS
      // ==========================================
      case 'SetLightColor': {
        const colorHex = node.values.color || '#38bdf8';
        const intensity = Number(node.values.intensity ?? 5.0);

        if (entity.object3D) {
          entity.object3D.traverse((child) => {
            if (child instanceof THREE.Light) {
              child.color.set(colorHex);
              child.intensity = intensity;
            }
            if (child.name === 'VolumetricLightCone' && child instanceof THREE.Mesh) {
              (child.material as THREE.MeshBasicMaterial).color.set(colorHex);
              (child.material as THREE.MeshBasicMaterial).opacity = Math.min(0.4, intensity * 0.04);
            }
            if (child.name === 'LightBulbMesh' && child instanceof THREE.Mesh) {
              const mat = child.material as THREE.MeshStandardMaterial;
              mat.color.set(colorHex);
              mat.emissive.set(colorHex);
              mat.emissiveIntensity = Math.min(5.0, intensity * 0.5);
            }
          });
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PulseLight': {
        const minInt = Number(node.values.min ?? 1.0);
        const maxInt = Number(node.values.max ?? 8.0);
        const freq = Number(node.values.frequency ?? 3.0);

        if (entity.object3D) {
          const pulse = (Math.sin(this.elapsedTime * freq) + 1) / 2;
          const currentIntensity = minInt + pulse * (maxInt - minInt);

          entity.object3D.traverse((child) => {
            if (child instanceof THREE.Light) {
              child.intensity = currentIntensity;
            }
            if (child.name === 'VolumetricLightCone' && child instanceof THREE.Mesh) {
              (child.material as THREE.MeshBasicMaterial).opacity = Math.min(0.4, currentIntensity * 0.04);
            }
            if (child.name === 'LightBulbMesh' && child instanceof THREE.Mesh) {
              (child.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(5.0, currentIntensity * 0.5);
            }
          });
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'FlickerLight': {
        const speed = Number(node.values.speed ?? 10.0);
        const randomness = Number(node.values.randomness ?? 0.6);

        if (entity.object3D) {
          const baseIntensity = Number(node.values.baseIntensity ?? 5.0);
          const noise = (Math.random() - 0.5) * randomness * baseIntensity;
          const currentIntensity = Math.max(0, baseIntensity + noise);

          entity.object3D.traverse((child) => {
            if (child instanceof THREE.Light) {
              child.intensity = currentIntensity;
            }
            if (child.name === 'VolumetricLightCone' && child instanceof THREE.Mesh) {
              (child.material as THREE.MeshBasicMaterial).opacity = Math.min(0.4, currentIntensity * 0.04);
            }
            if (child.name === 'LightBulbMesh' && child instanceof THREE.Mesh) {
              (child.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.min(5.0, currentIntensity * 0.5);
            }
          });
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // CINEMATICS & DIALOGUE NODE HANDLERS
      // ==========================================
      case 'SwitchCamera': {
        const camName = String(node.values.cameraName || node.values.cam || 'Camera_1');
        const blendDuration = Number(node.values.blendDuration ?? node.values.blend ?? 1.0);

        this.cinematicState.active = true;
        this.cinematicState.targetCameraName = camName;
        this.cinematicState.blendDuration = blendDuration;

        ScriptSandbox.addLog(`[Cinématique] Basculement vers caméra '${camName}' (transition: ${blendDuration}s)`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ShowDialogue': {
        const speaker = String(node.values.speaker || 'Narrateur');
        const text = String(node.values.text || 'Message de dialogue cinématique...');
        const duration = Number(node.values.duration ?? 5.0);

        this.dialogueState.active = true;
        this.dialogueState.speaker = speaker;
        this.dialogueState.text = text;
        this.dialogueState.duration = duration;
        this.dialogueState.timer = duration;

        ScriptSandbox.addLog(`[Dialogue] ${speaker}: "${text}" (${duration}s)`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetDepthOfField': {
        const blurAmount = Number(node.values.blur ?? node.values.intensity ?? 15);
        this.cinematicState.depthOfFieldBlur = blurAmount;

        ScriptSandbox.addLog(`[Cinématique] Flou de profondeur de champ réglé à ${blurAmount}%`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // SPATIAL AUDIO & BGM NODE HANDLERS
      // ==========================================
      case 'PlaySound3D': {
        const sfxType = (node.values.sfxType || node.values.sfx || 'torch') as SFXType;
        const maxDist = Number(node.values.maxDistance ?? node.values.maxDist ?? 25);

        if (entity.object3D) {
          // Find player position for listener
          let playerPos = { x: 0, y: 0, z: 0 };
          const allEnts = this.ecsWorld.getAllEntities();
          const playerEnt = allEnts.find((e) => e.object3D && (e.object3D.userData?.subType === 'player' || e.name.toLowerCase().includes('player')));
          if (playerEnt && playerEnt.object3D) {
            playerPos = playerEnt.object3D.position;
          }

          soundManager.playSpatialSound3D(sfxType, entity.object3D.position, playerPos, maxDist);
          ScriptSandbox.addLog(`[Audio 3D] Son spatial '${sfxType}' joué à l'entité ${entity.name}`, 'log');
        }

        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PlaySFX': {
        const sfxType = (node.values.type || node.values.sfx || 'coin') as SFXType;
        soundManager.playSFX(sfxType);
        ScriptSandbox.addLog(`[Audio SFX] Effet sonore '${sfxType}' joué`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetBGMState': {
        const bgmMode = (node.values.mode || node.values.bgm || 'exploration') as BGMMode;
        soundManager.setBGMMode(bgmMode);
        ScriptSandbox.addLog(`[Musique BGM] Mode de fond défini sur '${bgmMode}'`, 'log');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // ENEMY AI, HEALTH & INVENTORY NODE HANDLERS
      // ==========================================
      case 'CheckEnemyVision': {
        const fovAngle = Number(node.values.fov ?? node.values.angle ?? 60); // Degrees
        const range = Number(node.values.range ?? node.values.distance ?? 15);

        const allEnts = this.ecsWorld.getAllEntities();
        const playerEntity = allEnts.find(
          (e) =>
            e.active &&
            (e.object3D?.userData?.subType === 'player' ||
              e.name.toLowerCase().includes('player'))
        );

        let isSeen = false;
        if (entity.object3D && playerEntity && playerEntity.object3D) {
          const enemyPos = entity.object3D.position;
          const playerPos = playerEntity.object3D.position;

          const dist = enemyPos.distanceTo(playerPos);
          if (dist <= range) {
            // Forward vector of enemy
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(entity.object3D.quaternion);
            const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
            const angleDeg = THREE.MathUtils.radToDeg(forward.angleTo(toPlayer));

            if (angleDeg <= fovAngle / 2) {
              isSeen = true;
            }
          }
        }

        if (isSeen) {
          ScriptSandbox.addLog(`[IA Vision] Joueur repéré par ${entity.name} !`, 'warn');
          this.triggerNodeOutput(entity, graph, node.id, 'out_seen', context);
        } else {
          this.triggerNodeOutput(entity, graph, node.id, 'out_hidden', context);
        }
        break;
      }

      case 'DealDamage': {
        const damageAmount = Number(node.values.damage ?? node.values.dmg ?? 25);
        this.globalState.health = Math.max(0, this.globalState.health - damageAmount);
        this.dispatchAllVariables();

        // Spawn floating text above entity
        if (entity.object3D) {
          const pos = entity.object3D.position;
          this.floatingTexts.push({
            id: `dmg_${Date.now()}_${Math.random()}`,
            text: `-${damageAmount} HP`,
            x: pos.x,
            y: pos.y + 1.2,
            z: pos.z,
            color: '#f43f5e',
            timer: 1.5,
          });
        }

        soundManager.playSFX('explosion');
        this.onDamageEntity?.(entity.id, damageAmount, this.globalState.health);
        ScriptSandbox.addLog(`[Combat] Dégâts infligés: -${damageAmount} HP (Restants: ${this.globalState.health})`, 'warn');
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'CheckInventory': {
        const requiredItem = String(node.values.item || node.values.key || 'Clé Rouge');
        const hasItem = this.globalState.inventory.includes(requiredItem);

        if (hasItem) {
          ScriptSandbox.addLog(`[Inventaire] Item '${requiredItem}' trouvé dans l'inventaire`, 'log');
          this.triggerNodeOutput(entity, graph, node.id, 'out_has', context);
        } else {
          ScriptSandbox.addLog(`[Inventaire] Item '${requiredItem}' manquant`, 'log');
          this.triggerNodeOutput(entity, graph, node.id, 'out_none', context);
        }
        break;
      }

      case 'UnlockDoor': {
        if (entity.object3D) {
          // Rotate door open or make invisible
          entity.object3D.rotation.y += Math.PI / 2;
          ScriptSandbox.addLog(`[Porte] Porte '${entity.name}' déverrouillée et ouverte !`, 'log');
          soundManager.playSFX('coin');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PlayAnimation': {
        const anim = node.values.anim;
        if (anim && anim !== 'none') {
          if (entity.object3D) {
            if (anim === 'spin') {
              const spd = Number(node.values.speed ?? 90) * (Math.PI / 180);
              entity.object3D.rotation.y += spd * 0.016;
            } else if (anim === 'bounce') {
              entity.object3D.position.y += Math.sin(this.elapsedTime * 6) * 0.02;
            } else if (anim === 'pulse') {
              this.pulseEntity(entity);
            } else if (anim === 'patrol') {
              const axis = node.values.axis || 'x';
              const spd = Number(node.values.speed ?? 3);
              const delta = Math.sin(this.elapsedTime * spd) * 0.05;
              if (axis === 'y') {
                entity.object3D.position.y += delta;
              } else if (axis === 'z') {
                entity.object3D.position.z += delta;
              } else {
                entity.object3D.position.x += delta;
              }
            }
          }
        } else {
          const targetEntity = context.target || entity;
          const trackName = node.values.trackName || '';
          if (this.animationManager) {
            const tracks = this.animationManager.getTracksForObject(targetEntity.id);
            let targetTrack = tracks.find((t) => !trackName || t.name.toLowerCase().includes(trackName.toLowerCase()));
            if (!targetTrack && tracks.length > 0) targetTrack = tracks[0];

            if (targetTrack) {
              this.animationManager.playTrack(targetTrack.id, 1);
              ScriptSandbox.addLog(`[Animation] Lecture trajectoire '${targetTrack.name}' sur ${targetEntity.id}`, 'log');
            } else if (targetEntity.object3D?.userData.animations && this.onPlaySkeletalAnimation) {
              // Try to play skeletal animation if no track was found
              this.onPlaySkeletalAnimation(targetEntity.id, trackName);
              ScriptSandbox.addLog(`[Animation] Lecture animation GLTF '${trackName || 'Default'}' sur ${targetEntity.id}`, 'log');
            } else {
              ScriptSandbox.addLog(`[Animation] Aucune trajectoire ou animation GLTF trouvée pour ${targetEntity.id}`, 'warn');
            }
          }
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ReverseAnimation': {
        const targetEntity = context.target || entity;
        const trackName = node.values.trackName || '';
        if (this.animationManager) {
          const tracks = this.animationManager.getTracksForObject(targetEntity.id);
          let targetTrack = tracks.find((t) => !trackName || t.name.toLowerCase().includes(trackName.toLowerCase()));
          if (!targetTrack && tracks.length > 0) targetTrack = tracks[0];

          if (targetTrack) {
            this.animationManager.playTrack(targetTrack.id, -1);
            ScriptSandbox.addLog(`[Animation] Inversion trajectoire '${targetTrack.name}' sur ${targetEntity.id}`, 'log');
          }
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'PauseAnimation': {
        const targetEntity = context.target || entity;
        if (this.animationManager) {
          const tracks = this.animationManager.getTracksForObject(targetEntity.id);
          tracks.forEach((t) => this.animationManager?.pauseTrack(t.id));
          ScriptSandbox.addLog(`[Animation] Pause trajectoires sur ${targetEntity.id}`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'DestroyEntity': {
        const target = node.values.target === 'self' ? entity : context.target || entity;
        this.destroyEntity(target);
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      // ==========================================
      // ENVIRONMENTAL PHYSICS NODES (Vent, Feu, Pluie)
      // ==========================================

      case 'OnWindGust':
      case 'OnIgnite':
      case 'OnExtinguish':
      case 'OnRainStart':
      case 'OnRainStop': {
        // Event triggers forwarded to output flow
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'SetWind': {
        const speed = Number(node.values.speed ?? 35);
        const dirX = Number(node.values.dirX ?? 1);
        const dirY = Number(node.values.dirY ?? 0);
        const dirZ = Number(node.values.dirZ ?? 0.3);
        const gustiness = Number(node.values.gustiness ?? 0.5);
        const enabled = node.values.enabled !== false;

        if (this.environmentalPhysics) {
          this.environmentalPhysics.setWindConfig({
            enabled,
            speed,
            direction: { x: dirX, y: dirY, z: dirZ },
            gustiness,
          });
          ScriptSandbox.addLog(`[Physique Vent] Vent configuré: ${speed} km/h (actif: ${enabled})`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ApplyWindForce': {
        const target = context.target || entity;
        const force = Number(node.values.force ?? 25);
        const dirX = Number(node.values.dirX ?? 0);
        const dirY = Number(node.values.dirY ?? 1);
        const dirZ = Number(node.values.dirZ ?? 0);
        if (target?.object3D) {
          target.object3D.position.x += dirX * force * 0.04;
          target.object3D.position.y += dirY * force * 0.04;
          target.object3D.position.z += dirZ * force * 0.04;
          soundManager.playSFX('wind');
          ScriptSandbox.addLog(`[Physique Vent] Poussée de vent (${force} N) sur '${target.name || target.id}'`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'GetWind': {
        const windVec = this.environmentalPhysics ? this.environmentalPhysics.getWindVelocity() : new THREE.Vector3();
        const speedKmH = this.environmentalPhysics ? this.environmentalPhysics.windConfig.speed : 0;
        this.triggerNodeOutput(entity, graph, node.id, 'out_val', {
          ...context,
          speed: speedKmH,
          dirX: windVec.x,
          dirY: windVec.y,
          dirZ: windVec.z,
          val: speedKmH,
        });
        break;
      }

      case 'IgniteEntity': {
        const target = context.target || entity;
        if (this.environmentalPhysics) {
          this.environmentalPhysics.igniteEntity(target);
          ScriptSandbox.addLog(`[Physique Feu] Entité '${target.name || target.id}' allumée !`, 'warn');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'ExtinguishEntity': {
        const target = context.target || entity;
        if (this.environmentalPhysics) {
          this.environmentalPhysics.extinguishEntity(target.id);
          ScriptSandbox.addLog(`[Physique Feu] Flammes éteintes sur '${target.name || target.id}'`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'CheckIsBurning': {
        const target = context.target || entity;
        const burning = this.environmentalPhysics ? this.environmentalPhysics.isBurning(target.id) : false;
        if (burning) {
          this.triggerNodeOutput(entity, graph, node.id, 'out_true', context);
        } else {
          this.triggerNodeOutput(entity, graph, node.id, 'out_false', context);
        }
        break;
      }

      case 'SetRain': {
        const enabled = node.values.enabled !== false;
        const intensity = Number(node.values.intensity ?? 0.6);
        const isThunder = Boolean(node.values.isThunder ?? false);
        if (this.environmentalPhysics) {
          this.environmentalPhysics.setRainConfig({
            enabled,
            intensity,
            isThunder,
          });
          ScriptSandbox.addLog(`[Physique Pluie] Pluie ${enabled ? 'activée' : 'désactivée'} (intensité: ${intensity})`, 'log');
        }
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
      }

      case 'CheckIsRaining': {
        const isRaining = this.environmentalPhysics ? this.environmentalPhysics.rainConfig.enabled : false;
        const intensity = this.environmentalPhysics ? this.environmentalPhysics.rainConfig.intensity : 0;
        if (isRaining) {
          this.triggerNodeOutput(entity, graph, node.id, 'out_true', { ...context, intensity });
        } else {
          this.triggerNodeOutput(entity, graph, node.id, 'out_false', { ...context, intensity: 0 });
        }
        break;
      }

      default:
        // Default forward
        this.triggerNodeOutput(entity, graph, node.id, 'out_flow', context);
        break;
    }
  }

  // ==========================================
  // HELPER ACTIONS
  // ==========================================

  private collectEntity(entity: Entity, cfg: CollectableConfig): void {
    if (cfg.soundPreset && cfg.soundPreset !== 'none') {
      SoundEngine.play(cfg.soundPreset);
    }
    const scoreVal = cfg.scoreValue ?? 10;
    this.globalState.score += scoreVal;
    ScriptSandbox.addLog(`+${scoreVal} Points! Score total: ${this.globalState.score}`, 'log');
    this.dispatchAllVariables();

    // Visual disappear effect
    if (entity.object3D) {
      entity.object3D.visible = false;
    }
    entity.active = false;

    // Handle respawn if configured
    if (cfg.respawnTime && cfg.respawnTime > 0) {
      setTimeout(() => {
        if (this.isRunning && entity.object3D) {
          entity.active = true;
          entity.object3D.visible = true;
          SoundEngine.play('warp');
        }
      }, cfg.respawnTime * 1000);
    }
  }

  private applyDamageOnTouch(hazard: Entity, target: Entity, cfg: DamageOnTouchConfig): void {
    if (cfg.soundPreset) SoundEngine.play(cfg.soundPreset);
    const dmg = cfg.damage ?? 25;
    this.globalState.health = Math.max(0, this.globalState.health - dmg);
    this.dispatchAllVariables();
    ScriptSandbox.addLog(`Dégâts subis! -${dmg} PV (PV restants: ${this.globalState.health})`, 'warn');

    // Knockback
    if (target.object3D && hazard.object3D) {
      const dir = new THREE.Vector3().subVectors(target.object3D.position, hazard.object3D.position).normalize();
      target.object3D.position.addScaledVector(dir, (cfg.knockbackForce ?? 8.0) * 0.2);
      target.object3D.position.y += 0.5;
    }

    // Flash hazard mesh red
    this.pulseColor(hazard, 0xff0044);
  }

  private pulseEntity(entity: Entity): void {
    if (!entity.object3D) return;
    const origScale = entity.object3D.scale.clone();
    entity.object3D.scale.multiplyScalar(1.25);
    setTimeout(() => {
      if (entity.object3D) entity.object3D.scale.copy(origScale);
    }, 150);
  }

  private pulseColor(entity: Entity, hex: number): void {
    if (!entity.object3D) return;
    entity.object3D.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        const origColor = mat.color?.getHex() ?? 0xffffff;
        mat.color?.setHex(hex);
        setTimeout(() => {
          mat.color?.setHex(origColor);
        }, 180);
      }
    });
  }

  public destroyEntity(entity: Entity): void {
    entity.active = false;
    if (entity.object3D) {
      entity.object3D.visible = false;
    }
  }

  public findEntityByName(name: string): Entity | null {
    return this.ecsWorld.getAllEntities().find((e) => e.name === name) || null;
  }
}
