'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Trash2,
  Sparkles,
  Zap,
  Info,
} from 'lucide-react';
import { CustomScriptData } from '../types/logic';
import { ScriptSandbox } from '../lib/logic/ScriptSandbox';

// Dynamic Monaco editor import to prevent SSR hydration mismatch
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface CustomScriptEditorProps {
  entityId: string;
  entityName: string;
  initialScript?: CustomScriptData;
  onUpdateScript: (script: CustomScriptData) => void;
}

const DEFAULT_SCRIPT_TEMPLATE = `// Aether 3D Engine - Niveau 3 Custom Script
// API abstraite disponible:
// export abstract class Script {
//   entity: Entity;
//   abstract onStart(): void;
//   abstract onUpdate(dt: number): void;
//   abstract onCollision(other: Entity): void;
// }

export default class CustomEntityScript extends Script {
  // Déclenché au lancement de la simulation Play
  onStart() {
    Engine.log("Initialisation de " + this.entity.name);
    Engine.playSound("powerup");
  }

  // Déclenché à chaque frame avec le delta-time (dt en secondes)
  onUpdate(dt) {
    if (this.entity.object3D) {
      // Rotation fluide sur l'axe Y
      this.entity.object3D.rotation.y += 1.8 * dt;
    }
  }

  // Déclenché lors d'un impact physique avec une autre entité
  onCollision(other) {
    Engine.log("Collision détectée avec : " + other.name);
    Engine.playSound("coin");
  }
}
`;

export const CustomScriptEditor: React.FC<CustomScriptEditorProps> = ({
  entityId,
  entityName,
  initialScript,
  onUpdateScript,
}) => {
  const [code, setCode] = useState<string>(
    initialScript?.code || DEFAULT_SCRIPT_TEMPLATE
  );
  const [enabled, setEnabled] = useState<boolean>(initialScript?.enabled ?? true);
  const [compileStatus, setCompileStatus] = useState<{
    ok: boolean;
    error?: string;
  }>({ ok: true });
  const [logs, setLogs] = useState<{ time: string; message: string; type: 'log' | 'warn' | 'error' }[]>([]);

  // Refresh logs periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setLogs([...ScriptSandbox.getLogs()]);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  const handleCompile = (currentCode: string = code) => {
    const { ScriptClass, error } = ScriptSandbox.compile(currentCode);
    if (error) {
      setCompileStatus({ ok: false, error });
      onUpdateScript({
        enabled,
        code: currentCode,
        compiledOk: false,
        lastError: error,
      });
    } else {
      setCompileStatus({ ok: true });
      onUpdateScript({
        enabled,
        code: currentCode,
        compiledOk: true,
      });
    }
  };

  const handleToggleEnabled = () => {
    const nextEnabled = !enabled;
    setEnabled(nextEnabled);
    onUpdateScript({
      enabled: nextEnabled,
      code,
      compiledOk: compileStatus.ok,
      lastError: compileStatus.error,
    });
  };

  const insertSnippet = (snippet: string) => {
    setCode(snippet);
    handleCompile(snippet);
  };

  return (
    <div id="custom-script-editor" className="space-y-3">
      {/* Header & Toggle */}
      <div className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <FileCode2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">Script JavaScript / TypeScript</div>
            <div className="text-[10px] text-zinc-400">Niveau 3 : Contrôle total par le code</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToggleEnabled}
            className={`w-8 h-4 flex items-center rounded-full p-0.5 transition-colors ${
              enabled ? 'bg-emerald-500 justify-end' : 'bg-zinc-800 justify-start'
            }`}
          >
            <span className="w-3 h-3 rounded-full bg-white shadow" />
          </button>
        </div>
      </div>

      {/* Snippets Toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() =>
            insertSnippet(`export default class SpinScript extends Script {
  onStart() {
    Engine.playSound("powerup");
  }
  onUpdate(dt) {
    if (this.entity.object3D) {
      this.entity.object3D.rotation.y += 2.5 * dt;
    }
  }
  onCollision(other) {
    Engine.playSound("coin");
  }
}`)
          }
          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 whitespace-nowrap transition-colors"
        >
          Snippet : Rotation
        </button>

        <button
          type="button"
          onClick={() =>
            insertSnippet(`export default class BounceScript extends Script {
  onStart() {
    this.initialY = this.entity.object3D ? this.entity.object3D.position.y : 0;
    this.timer = 0;
  }
  onUpdate(dt) {
    this.timer += dt * 3;
    if (this.entity.object3D) {
      this.entity.object3D.position.y = this.initialY + Math.sin(this.timer) * 0.5;
    }
  }
  onCollision(other) {
    Engine.playSound("jump");
  }
}`)
          }
          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 whitespace-nowrap transition-colors"
        >
          Snippet : Lévitation
        </button>

        <button
          type="button"
          onClick={() =>
            insertSnippet(`export default class DamageTrapScript extends Script {
  onStart() {}
  onUpdate(dt) {}
  onCollision(other) {
    Engine.log("Piège déclenché par: " + other.name);
    Engine.playSound("hit");
  }
}`)
          }
          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 whitespace-nowrap transition-colors"
        >
          Snippet : Piège Dégâts
        </button>
      </div>

      {/* Monaco Code Editor Container */}
      <div className="relative rounded-xl border border-zinc-800 overflow-hidden bg-[#1e1e1e] shadow-lg">
        <Editor
          height="280px"
          language="javascript"
          theme="vs-dark"
          value={code}
          onChange={(newVal) => {
            const val = newVal || '';
            setCode(val);
            handleCompile(val);
          }}
          options={{
            minimap: { enabled: false },
            fontSize: 11,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
            formatOnPaste: true,
            tabSize: 2,
          }}
        />

        {/* Compile Status Floating Banner */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/90 border-t border-zinc-800 text-[11px]">
          {compileStatus.ok ? (
            <div className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Script vérifié & prêt pour Play</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-rose-400 truncate max-w-[200px]" title={compileStatus.error}>
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{compileStatus.error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => handleCompile(code)}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-medium transition-colors"
          >
            Recompiler
          </button>
        </div>
      </div>

      {/* Script Console Output Panel */}
      <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Console Engine.log()</span>
          </div>
          <button
            type="button"
            onClick={() => ScriptSandbox.clearLogs()}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Vider</span>
          </button>
        </div>

        <div className="h-24 overflow-y-auto space-y-1 font-mono text-[10px] p-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/60">
          {logs.length === 0 ? (
            <div className="text-zinc-500 italic py-2 text-center">
              Passez en mode Simulation Play pour voir les logs d&apos;exécution...
            </div>
          ) : (
            logs.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-2 ${
                  item.type === 'error'
                    ? 'text-rose-400'
                    : item.type === 'warn'
                    ? 'text-amber-400'
                    : 'text-zinc-300'
                }`}
              >
                <span className="text-zinc-500 flex-shrink-0">[{item.time}]</span>
                <span className="break-all">{item.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
