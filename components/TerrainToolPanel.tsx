'use client';

import React from 'react';
import {
  TerrainConfig,
  TerrainBrushConfig,
  FoliageType,
  TerrainSculptMode,
} from '../types/terrain';
import {
  Mountain,
  TreePine,
  Trees,
  Gem,
  Flower2,
  Sparkles,
  Eraser,
  RefreshCw,
  Sliders,
  ChevronUp,
  ChevronDown,
  Layers,
  CircleDot,
  Brush,
  Minus,
} from 'lucide-react';

interface TerrainToolPanelProps {
  brushConfig: TerrainBrushConfig;
  onUpdateBrush: (partial: Partial<TerrainBrushConfig>) => void;
  terrainConfig: TerrainConfig;
  onUpdateTerrainConfig: (partial: Partial<TerrainConfig>) => void;
  onRegenerateTerrain: () => void;
  onClearFoliage: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const TerrainToolPanel: React.FC<TerrainToolPanelProps> = ({
  brushConfig,
  onUpdateBrush,
  terrainConfig,
  onUpdateTerrainConfig,
  onRegenerateTerrain,
  onClearFoliage,
  isOpen,
  onToggleOpen,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute top-16 left-4 z-20 w-72 bg-zinc-950/90 backdrop-blur-xl border border-zinc-800/90 rounded-3xl shadow-2xl p-4 space-y-4 select-none animate-in fade-in slide-in-from-top-2 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Mountain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white">Sculpture & Peinture Terrain</h3>
            <p className="text-[10px] text-zinc-400">Raycasting & InstancedMesh 60 FPS</p>
          </div>
        </div>
      </div>

      {/* Terrain Enable Toggle */}
      <div className="flex items-center justify-between p-2 rounded-2xl bg-zinc-900/80 border border-zinc-800/80">
        <div>
          <span className="text-xs font-medium text-white block">Terrain Procédural 3D</span>
          <span className="text-[10px] text-zinc-400">
            {terrainConfig.enabled ? 'Actif sur la scène' : 'Désactivé (Plan de travail épuré)'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onUpdateTerrainConfig({ enabled: !terrainConfig.enabled })}
          className={`px-3 py-1 rounded-xl text-xs font-medium transition-all ${
            terrainConfig.enabled
              ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
              : 'bg-zinc-800 text-zinc-400 hover:text-white'
          }`}
        >
          {terrainConfig.enabled ? 'Activé' : 'Activer'}
        </button>
      </div>

      {/* Mode selection */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
          Mode de Pinceau (Brush)
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateBrush({ mode: 'raise' })}
            className={`p-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 border transition-colors ${
              brushConfig.mode === 'raise'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <ChevronUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Élever</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBrush({ mode: 'lower' })}
            className={`p-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 border transition-colors ${
              brushConfig.mode === 'lower'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <ChevronDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Creuser</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBrush({ mode: 'smooth' })}
            className={`p-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 border transition-colors ${
              brushConfig.mode === 'smooth'
                ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <CircleDot className="w-3.5 h-3.5 text-emerald-400" />
            <span>Lisser</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBrush({ mode: 'foliage_paint' })}
            className={`col-span-2 p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border transition-colors ${
              brushConfig.mode === 'foliage_paint'
                ? 'bg-sky-500/20 border-sky-500/50 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <TreePine className="w-3.5 h-3.5 text-sky-400" />
            <span>Peindre Végétation</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateBrush({ mode: 'foliage_erase' })}
            className={`p-2 rounded-xl text-xs font-medium flex flex-col items-center gap-1 border transition-colors ${
              brushConfig.mode === 'foliage_erase'
                ? 'bg-rose-500/20 border-rose-500/50 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            <Eraser className="w-3.5 h-3.5 text-rose-400" />
            <span>Gomme</span>
          </button>
        </div>
      </div>

      {/* Foliage type selection when foliage mode is active */}
      {brushConfig.mode === 'foliage_paint' && (
        <div className="space-y-1.5 pt-2 border-t border-zinc-800/80">
          <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-mono">
            Type d’Objet Instancié
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'pine_tree', name: 'Sapin', icon: TreePine },
              { id: 'oak_tree', name: 'Chêne', icon: Trees },
              { id: 'rock', name: 'Rocher', icon: Mountain },
              { id: 'grass_tuft', name: 'Herbe', icon: Sparkles },
              { id: 'flower', name: 'Fleur', icon: Flower2 },
              { id: 'crystal', name: 'Cristal', icon: Gem },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onUpdateBrush({ selectedFoliage: f.id as FoliageType })}
                className={`p-1.5 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 border transition-colors ${
                  brushConfig.selectedFoliage === f.id
                    ? 'bg-sky-500/20 border-sky-500/50 text-sky-200'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                <f.icon className="w-3 h-3" />
                <span>{f.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brush Sliders */}
      <div className="space-y-3 pt-2 border-t border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>Rayon du Pinceau</span>
            <span className="text-white">{brushConfig.radius} m</span>
          </div>
          <input
            type="range"
            min={1.0}
            max={12.0}
            step={0.5}
            value={brushConfig.radius}
            onChange={(e) => onUpdateBrush({ radius: Number(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
            <span>Force / Puissance</span>
            <span className="text-white">{brushConfig.strength}</span>
          </div>
          <input
            type="range"
            min={0.1}
            max={2.0}
            step={0.1}
            value={brushConfig.strength}
            onChange={(e) => onUpdateBrush({ strength: Number(e.target.value) })}
            className="w-full accent-emerald-500"
          />
        </div>
      </div>

      {/* Footer operations */}
      <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
        <button
          type="button"
          onClick={onRegenerateTerrain}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
          <span>Régénérer FBM</span>
        </button>

        <button
          type="button"
          onClick={onClearFoliage}
          className="p-1.5 rounded-xl bg-zinc-900 hover:bg-rose-500/20 border border-zinc-800 text-zinc-400 hover:text-rose-400 transition-colors"
          title="Vider la végétation"
        >
          <Eraser className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
