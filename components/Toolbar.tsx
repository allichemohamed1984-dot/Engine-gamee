'use client';

import React, { useState, useRef } from 'react';
import { GizmoMode, GizmoSpace, RenderMode } from '../types/engine';
import {
  Play,
  Square,
  Move,
  RotateCw,
  Maximize2,
  Box,
  Circle,
  Cylinder,
  LifeBuoy,
  Triangle,
  Sun,
  Magnet,
  Sparkles,
  Layers,
  ChevronDown,
  Plus,
  Compass,
  UploadCloud,
  Download,
  FolderOpen,
  CloudSun,
  Mountain,
  LayoutTemplate,
  Rocket,
  Image as ImageIcon,
  Waves,
  Target,
  Flag,
  BoxSelect,
} from 'lucide-react';

interface ToolbarProps {
  isPlaying: boolean;
  gizmoMode: GizmoMode;
  gizmoSpace: GizmoSpace;
  renderMode: RenderMode;
  snapping: boolean;
  isAssetManagerOpen?: boolean;
  isTerrainPanelOpen?: boolean;
  is2DModeEnabled?: boolean;
  onTogglePlay: () => void;
  onGizmoModeChange: (mode: GizmoMode) => void;
  onGizmoSpaceChange: (space: GizmoSpace) => void;
  onRenderModeChange: (mode: RenderMode) => void;
  onToggleSnapping: () => void;
  onToggleAssetManager?: () => void;
  onToggleTerrainPanel?: () => void;
  onToggle2DMode?: () => void;
  onOpenAtmosphereModal?: () => void;
  onOpenHUDModal?: () => void;
  onOpenExportModal?: () => void;
  onOpenTexturePanel?: () => void;
  onAddPrimitive: (
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
      | 'checkpoint'
  ) => void;
  onImportGLTF?: (file: File) => void;
  onExportScene?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isPlaying,
  gizmoMode,
  gizmoSpace,
  renderMode,
  snapping,
  isAssetManagerOpen,
  isTerrainPanelOpen,
  is2DModeEnabled,
  onTogglePlay,
  onGizmoModeChange,
  onGizmoSpaceChange,
  onRenderModeChange,
  onToggleSnapping,
  onToggleAssetManager,
  onToggleTerrainPanel,
  onToggle2DMode,
  onOpenAtmosphereModal,
  onOpenHUDModal,
  onOpenExportModal,
  onOpenTexturePanel,
  onAddPrimitive,
  onImportGLTF,
  onExportScene,
}) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showRenderMenu, setShowRenderMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0 && onImportGLTF) {
      onImportGLTF(files[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header
      id="aether-toolbar"
      className="h-[52px] w-full bg-zinc-950/95 border-b border-zinc-800/80 px-4 flex items-center justify-between select-none z-30 shadow-md backdrop-blur-md"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".gltf,.glb"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Left: Brand Identity, Quick Add & World Tools */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xs font-bold tracking-tight text-white">Aether 3D Engine</h1>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 text-[9px] font-mono">
                v0.3
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">Zero-Code WebGL Studio</p>
          </div>
        </div>

        <span className="w-px h-5 bg-zinc-800" />

        {/* Quick Add Menu */}
        <div className="relative">
          <button
            id="toolbar-btn-add"
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-700/80 text-xs font-medium text-zinc-200 hover:text-white hover:border-zinc-600 transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Ajouter</span>
            <ChevronDown className="w-3 h-3 text-zinc-400" />
          </button>

          {showAddMenu && (
            <div
              id="toolbar-add-popup"
              className="absolute left-0 top-full mt-2 w-52 p-1.5 rounded-2xl bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/80 shadow-2xl z-50 text-xs space-y-0.5"
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Primitives 3D
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('cube');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" />
                <span>Boîte / Cube</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('sphere');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Circle className="w-3.5 h-3.5 text-rose-400" />
                <span>Sphère PBR</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('cylinder');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Cylinder className="w-3.5 h-3.5 text-emerald-400" />
                <span>Cylindre</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('torus');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-amber-400" />
                <span>Tore (Donut)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('cone');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Triangle className="w-3.5 h-3.5 text-purple-400" />
                <span>Cône</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Lumières & Éclairage
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('pointLight');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Sun className="w-3.5 h-3.5 text-amber-300" />
                <span>Lumière Ponctuelle</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('spotLight');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Sun className="w-3.5 h-3.5 text-yellow-400" />
                <span>Spot Light</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                VFX & Particules 3D
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('particles');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>Émetteur de Particules 3D</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Eau & Environnement
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('river');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                <span>Rivière Procédurale 3D</span>
              </button>

              <div className="my-1 border-t border-zinc-800" />
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                IA & Navigation Gameplay
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('navMeshAgent');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Target className="w-3.5 h-3.5 text-red-400" />
                <span>Ennemi / PNJ Pathfinding (A*)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('triggerVolume');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <BoxSelect className="w-3.5 h-3.5 text-violet-400" />
                <span>Zone de Déclenchement (Trigger)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('checkpoint');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Flag className="w-3.5 h-3.5 text-emerald-400" />
                <span>Point de Réapparition (Checkpoint)</span>
              </button>
            </div>
          )}
        </div>

        {/* Atmosphere & Sky Manager Button */}
        {onOpenAtmosphereModal && (
          <button
            id="toolbar-btn-atmosphere"
            type="button"
            onClick={onOpenAtmosphereModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-amber-300 hover:border-amber-500/40 transition-colors shadow-sm"
            title="Gérer l'Atmosphère, le Ciel HDR, le Brouillard et le Post-Processing"
          >
            <CloudSun className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Atmosphère</span>
          </button>
        )}

        {/* Terrain & Foliage Painter Button */}
        {onToggleTerrainPanel && (
          <button
            id="toolbar-btn-terrain"
            type="button"
            onClick={onToggleTerrainPanel}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors shadow-sm ${
              isTerrainPanelOpen
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-emerald-300 hover:border-emerald-500/40'
            }`}
            title="Outil de sculpture de terrain et peinture d'arbres/rochers"
          >
            <Mountain className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Terrain</span>
          </button>
        )}

        {/* In-Game HUD UI Creator Button */}
        {onOpenHUDModal && (
          <button
            id="toolbar-btn-hud"
            type="button"
            onClick={onOpenHUDModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-indigo-300 hover:border-indigo-500/40 transition-colors shadow-sm"
            title="Éditeur WYSIWYG de Canvas UI / HUD In-Game (Barres de vie, score, pause)"
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">HUD In-Game</span>
          </button>
        )}

        {/* Texture Assigner Panel Button */}
        {onOpenTexturePanel && (
          <button
            id="toolbar-btn-textures"
            type="button"
            onClick={onOpenTexturePanel}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-sky-300 hover:border-sky-500/40 transition-colors shadow-sm"
            title="Gestionnaire et assignation de textures PBR, reliefs et tiling"
          >
            <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">Textures</span>
          </button>
        )}

        {/* 2D Cel-Shading Mode Toggle Button */}
        {onToggle2DMode && (
          <button
            id="toolbar-btn-2d-mode"
            type="button"
            onClick={onToggle2DMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
              is2DModeEnabled
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.4)] animate-pulse'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:border-zinc-700'
            }`}
            title="Activer/Désactiver le Mode 2D / Cel-Shading (Bande dessinée & ombres nettes)"
          >
            <span>{is2DModeEnabled ? '🎨 Mode 2D' : '🧊 Mode 3D'}</span>
          </button>
        )}
      </div>

      {/* Center: Play/Simulation & Gizmo Modes */}
      <div className="flex items-center gap-2">
        {/* Play/Pause Button */}
        <button
          id="toolbar-btn-play"
          type="button"
          onClick={onTogglePlay}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-all ${
            isPlaying
              ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/25 animate-pulse'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/25'
          }`}
          title={isPlaying ? 'Arrêter la simulation (Espace)' : 'Lancer la simulation (Espace)'}
        >
          {isPlaying ? (
            <>
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play</span>
            </>
          )}
        </button>

        <span className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Gizmo Mode Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800">
          <button
            id="toolbar-gizmo-translate"
            type="button"
            onClick={() => onGizmoModeChange('translate')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              gizmoMode === 'translate'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Déplacement (W)"
          >
            <Move className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Trans</span>
          </button>
          <button
            id="toolbar-gizmo-rotate"
            type="button"
            onClick={() => onGizmoModeChange('rotate')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              gizmoMode === 'rotate'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Rotation (E)"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Rot</span>
          </button>
          <button
            id="toolbar-gizmo-scale"
            type="button"
            onClick={() => onGizmoModeChange('scale')}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
              gizmoMode === 'scale'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
            title="Échelle (R)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Scale</span>
          </button>
        </div>

        {/* Snap toggle */}
        <button
          id="toolbar-btn-snap"
          type="button"
          onClick={onToggleSnapping}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            snapping
              ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
          title="Accrochage à la grille (0.5m & 15°)"
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Snap</span>
        </button>
      </div>

      {/* Right: One-Click Game Exporter & Render Mode */}
      <div className="flex items-center gap-2">
        {/* One-Click Standalone Game Web Exporter */}
        {onOpenExportModal && (
          <button
            id="toolbar-btn-export-game"
            type="button"
            onClick={onOpenExportModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all transform active:scale-95"
            title="Exporter le jeu autonome complet en 1 clic (fichier HTML exécutable partout)"
          >
            <Rocket className="w-3.5 h-3.5" />
            <span>Exporter Jeu</span>
          </button>
        )}

        {/* Toggle Asset Manager Shelf */}
        {onToggleAssetManager && (
          <button
            type="button"
            onClick={onToggleAssetManager}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
              isAssetManagerOpen
                ? 'bg-sky-500/15 border-sky-500/50 text-sky-400'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
            }`}
            title="Afficher / Masquer l'Asset Manager"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Assets</span>
          </button>
        )}

        {/* Render Mode Dropdown */}
        <div className="relative">
          <button
            id="toolbar-btn-rendermode"
            type="button"
            onClick={() => setShowRenderMenu(!showRenderMenu)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-sky-400" />
            <span className="capitalize">{renderMode}</span>
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>

          {showRenderMenu && (
            <div
              id="toolbar-rendermode-popup"
              className="absolute right-0 top-full mt-2 w-36 p-1 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl z-50 text-xs space-y-0.5"
            >
              <button
                type="button"
                onClick={() => {
                  onRenderModeChange('shaded');
                  setShowRenderMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  renderMode === 'shaded'
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>Shaded (PBR)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onRenderModeChange('wireframe');
                  setShowRenderMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  renderMode === 'wireframe'
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>Wireframe</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onRenderModeChange('normals');
                  setShowRenderMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                  renderMode === 'normals'
                    ? 'bg-sky-500/15 text-sky-400 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-800'
                }`}
              >
                <span>Normals</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

