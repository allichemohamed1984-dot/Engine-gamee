import * as THREE from 'three';
import { Entity } from '../ecs/ECS';
import { SoundEngine } from '../audio/SoundSynth';
import { Script } from '../../types/logic';

export interface ScriptExecutionContext {
  log: (...args: any[]) => void;
  playSound: (preset: string) => void;
  getVariable: (name: string) => any;
  setVariable: (name: string, val: any) => void;
  findEntity: (name: string) => Entity | null;
  destroy: (entity: Entity) => void;
  time: number;
}

/**
 * ScriptSandbox
 * Safely parses, instantiates and controls custom Level 3 user scripts
 */
export class ScriptSandbox {
  private static globalVariables: Map<string, any> = new Map();
  private static logs: { time: string; message: string; type: 'log' | 'warn' | 'error' }[] = [];

  public static getLogs() {
    return this.logs;
  }

  public static clearLogs() {
    this.logs = [];
  }

  public static addLog(message: string, type: 'log' | 'warn' | 'error' = 'log') {
    const time = new Date().toLocaleTimeString();
    this.logs.unshift({ time, message, type });
    if (this.logs.length > 100) this.logs.pop();
  }

  public static getVariables() {
    return Object.fromEntries(this.globalVariables);
  }

  public static setVariable(name: string, val: any) {
    this.globalVariables.set(name, val);
  }

  /**
   * Compiles code string into a class extending Script
   */
  public static compile(code: string): {
    ScriptClass: (new () => Script) | null;
    error: string | null;
  } {
    try {
      // Strip 'export default' or 'export' if provided by user
      let cleaned = code.trim();
      cleaned = cleaned.replace(/export\s+default\s+/g, '');
      cleaned = cleaned.replace(/export\s+/g, '');

      // Build wrapper function that provides Base Script and Engine sandbox
      const factory = new Function(
        'Script',
        'THREE',
        'Engine',
        `
        ${cleaned}

        // Return the script class (either UserScript, CustomScript, MyScript, or last defined class)
        if (typeof UserScript !== 'undefined') return UserScript;
        if (typeof CustomScript !== 'undefined') return CustomScript;
        if (typeof MyScript !== 'undefined') return MyScript;

        // Try searching for any class extending Script
        try {
          const matched = "${cleaned}".match(/class\\s+([A-Za-z0-9_]+)\\s+extends\\s+Script/);
          if (matched && matched[1] && eval("typeof " + matched[1]) !== 'undefined') {
            return eval(matched[1]);
          }
        } catch(e) {}

        // Fallback default
        return class DefaultScript extends Script {
          onStart() {}
          onUpdate(dt) {}
          onCollision(other) {}
        };
      `
      );

      const mockEngine = {
        log: (msg: any) => this.addLog(String(msg), 'log'),
        playSound: (s: string) => SoundEngine.play(s),
        getVariable: (name: string) => this.globalVariables.get(name),
        setVariable: (name: string, val: any) => this.setVariable(name, val),
      };

      const ScriptClass = factory(Script, THREE, mockEngine);
      return { ScriptClass, error: null };
    } catch (err: any) {
      return { ScriptClass: null, error: err.message || 'Erreur de syntaxe dans le script.' };
    }
  }

  /**
   * Instantiates the script with entity binding and runtime Engine injection
   */
  public static instantiate(
    ScriptClass: new () => Script,
    entity: Entity,
    findEntityFn: (name: string) => Entity | null,
    destroyEntityFn: (entity: Entity) => void
  ): Script | null {
    try {
      const instance = new ScriptClass();
      instance.entity = entity;

      // Attach Engine sandbox on prototype or instance
      const engineAPI = {
        log: (...args: any[]) => {
          const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          this.addLog(`[${entity.name}] ${msg}`, 'log');
        },
        warn: (...args: any[]) => {
          const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          this.addLog(`[${entity.name}] ${msg}`, 'warn');
        },
        error: (...args: any[]) => {
          const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
          this.addLog(`[${entity.name}] ${msg}`, 'error');
        },
        playSound: (preset: string) => SoundEngine.play(preset),
        getVariable: (name: string) => this.globalVariables.get(name),
        setVariable: (name: string, val: any) => this.setVariable(name, val),
        findEntity: findEntityFn,
        destroy: destroyEntityFn,
      };

      (instance as any).Engine = engineAPI;
      (window as any).Engine = engineAPI;

      return instance;
    } catch (err: any) {
      this.addLog(`Erreur d'instanciation sur ${entity.name}: ${err.message}`, 'error');
      return null;
    }
  }
}
