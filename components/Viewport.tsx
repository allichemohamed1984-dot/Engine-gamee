'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SceneManager } from '../lib/SceneManager';
import {
  GizmoMode,
  GizmoSpace,
  EngineStats,
  SceneNode,
  SceneExportData,
  WorkPlaneConfig,
  DEFAULT_WORK_PLANE_CONFIG,
} from '../types/engine';
import {
  Move,
  RotateCw,
  Maximize2,
  Focus,
  RotateCcw,
  Globe,
  Play,
  HelpCircle,
  UploadCloud,
  Grid,
  Sliders,
  ChevronDown,
  Layers,
  Compass,
  Check,
  Eye,
  EyeOff,
  Crosshair,
  Maximize,
} from 'lucide-react';
import { SpeedometerHUD } from './SpeedometerHUD';

interface ViewportProps {
  sceneManagerRef: React.MutableRefObject<SceneManager | null>;
  selectedNode: SceneNode | null;
  gizmoMode: GizmoMode;
  gizmoSpace: GizmoSpace;
  isPlaying: boolean;
  stats: EngineStats;
  workPlaneConfig?: WorkPlaneConfig;
  onUpdateWorkPlaneConfig?: (partial: Partial<WorkPlaneConfig>) => void;
  onGizmoModeChange: (mode: GizmoMode) => void;
  onGizmoSpaceChange: (space: GizmoSpace) => void;
  onTogglePlay: () => void;
  onImportGLTF?: (file: File) => Promise<void>;
  onImportSceneJSON?: (data: SceneExportData) => void;
  onAddPrimitiveAtPos?: (type: string, pos: { x: number; y: number; z: number }) => void;
  onApplyMaterialPreset?: (presetId: string) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  sceneManagerRef,
  selectedNode,
  gizmoMode,
  gizmoSpace,
  isPlaying,
  stats,
  workPlaneConfig = DEFAULT_WORK_PLANE_CONFIG,
  onUpdateWorkPlaneConfig,
  onGizmoModeChange,
  onGizmoSpaceChange,
  onImportGLTF,
  onImportSceneJSON,
  onAddPrimitiveAtPos,
  onApplyMaterialPreset,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showWorkPlaneMenu, setShowWorkPlaneMenu] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Real-time Vehicle Dashboard HUD polling
  const [vehicleHUDData, setVehicleHUDData] = useState<{
    active: boolean;
    speedKmH: number;
    maxSpeedKmH: number;
    isDrifting: boolean;
    isBoosting: boolean;
  }>({ active: false, speedKmH: 0, maxSpeedKmH: 140, isDrifting: false, isBoosting: false });

  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      const sm = sceneManagerRef.current;
      if (!sm) return;

      const vehicleEntity = sm.ecsWorld
        .getAllEntities()
        .find((e) => e.active && e.object3D?.userData?.physics?.vehicleController?.enabled);

      if (vehicleEntity && vehicleEntity.object3D) {
        const vc = vehicleEntity.object3D.userData.physics.vehicleController;
        const vehicleSys = sm.physicsManager?.vehicleSystem;
        setVehicleHUDData({
          active: true,
          speedKmH: vc.currentSpeedKmH || 0,
          maxSpeedKmH: vc.maxSpeed || 140,
          isDrifting: vehicleSys?.input?.jump || false,
          isBoosting: vehicleSys?.input?.sprint || false,
        });
      } else {
        setVehicleHUDData((prev) => (prev.active ? { ...prev, active: false } : prev));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, sceneManagerRef]);

  // Resize observer to keep Three.js responsive
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      const width = rect.width || container.clientWidth;
      const height = rect.height || container.clientHeight;
      if (width > 0 && height > 0) {
        sceneManagerRef.current?.handleResize(width, height);
      }
    };

    // Immediate and delayed resize check to ensure container layout is computed
    updateDimensions();
    const rafId = requestAnimationFrame(updateDimensions);
    const timeoutId = setTimeout(updateDimensions, 50);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          sceneManagerRef.current?.handleResize(width, height);
        }
      }
    });

    resizeObserver.observe(container);
    window.addEventListener('resize', updateDimensions);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, [sceneManagerRef]);

  // Keyboard shortcut listener ('G' for Grid, 'F' for Focus)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === 'g' || e.key === 'G') {
        const nextVisible = !workPlaneConfig.gridVisible;
        if (onUpdateWorkPlaneConfig) {
          onUpdateWorkPlaneConfig({ gridVisible: nextVisible });
        } else {
          sceneManagerRef.current?.toggleWorkPlaneGrid();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [workPlaneConfig.gridVisible, onUpdateWorkPlaneConfig, sceneManagerRef]);

  const handleFocus = () => {
    sceneManagerRef.current?.focusOnObject();
  };

  const handleResetCamera = () => {
    sceneManagerRef.current?.resetCamera();
  };

  const handleViewChange = (
    view: 'iso' | 'top' | 'bottom' | 'front' | 'back' | 'side' | 'right' | 'left'
  ) => {
    sceneManagerRef.current?.setCameraView(view);
  };

  const handleWorkPlaneUpdate = (partial: Partial<WorkPlaneConfig>) => {
    if (onUpdateWorkPlaneConfig) {
      onUpdateWorkPlaneConfig(partial);
    } else {
      sceneManagerRef.current?.setWorkPlaneConfig(partial);
    }
  };

  // Drag and drop onto 3D Viewport
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // 1. Check if dropped files (.gltf, .glb, .json)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.gltf') || lower.endsWith('.glb')) {
        if (onImportGLTF) {
          await onImportGLTF(file);
        }
        return;
      } else if (lower.endsWith('.json')) {
        if (onImportSceneJSON) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            onImportSceneJSON(parsed);
          } catch {
            console.error('Erreur parsing JSON');
          }
        }
        return;
      }
    }

    // 2. Check if dropped asset item from AssetManager shelf
    const rawData = e.dataTransfer.getData('application/json');
    if (rawData) {
      try {
        const item = JSON.parse(rawData);
        const groundPos = sceneManagerRef.current?.getGroundIntersection(e.clientX, e.clientY) || {
          x: 0,
          y: workPlaneConfig.height,
          z: 0,
        };

        if (item.type === 'primitive' && item.subType) {
          if (onAddPrimitiveAtPos) {
            onAddPrimitiveAtPos(item.subType, groundPos);
          } else {
            sceneManagerRef.current?.addPrimitive(item.subType, groundPos);
          }
        } else if (item.type === 'material' && item.presetId) {
          if (onApplyMaterialPreset) {
            onApplyMaterialPreset(item.presetId);
          }
        }
      } catch (err) {
        console.warn('Drop parsing error', err);
      }
    }
  };

  return (
    <div
      id="aether-viewport"
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex-1 h-full w-full bg-[#0a0c10] overflow-hidden select-none outline-none focus:ring-1 focus:ring-sky-500/50"
      tabIndex={0}
    >
      {/* Visual Drag Over Indicator */}
      {isDragOver && (
        <div
          id="viewport-drop-overlay"
          className="absolute inset-0 z-30 pointer-events-none bg-sky-950/40 backdrop-blur-xs border-2 border-dashed border-sky-400/80 flex flex-col items-center justify-center gap-3 animate-fade-in"
        >
          <div className="w-16 h-16 rounded-3xl bg-sky-500/20 border border-sky-400/50 flex items-center justify-center text-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.4)]">
            <UploadCloud className="w-8 h-8 animate-bounce" />
          </div>
          <div className="text-center">
            <h4 className="text-base font-bold text-white tracking-wide">
              Déposer dans la Scène 3D
            </h4>
            <p className="text-xs text-sky-200 mt-0.5">
              Positionnement automatique par raycasting sur le plan de travail 3D (Y={workPlaneConfig.height}m)
            </p>
          </div>
        </div>
      )}

      {/* Top-Left Floating Controls: Camera Views, Actions & 3D Work Plane Panel */}
      <div
        id="viewport-camera-toolbar"
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 shadow-2xl text-xs text-zinc-300"
      >
        <button
          id="btn-view-iso"
          type="button"
          onClick={() => handleViewChange('iso')}
          className="px-2.5 py-1 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors font-medium text-sky-400"
          title="Vue Perspective Isométrique"
        >
          Perspective
        </button>
        <span className="w-px h-3.5 bg-zinc-700/60" />
        <button
          id="btn-view-top"
          type="button"
          onClick={() => handleViewChange('top')}
          className="px-2 py-1 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors"
          title="Vue Dessus (Haut / Top)"
        >
          Haut
        </button>
        <button
          id="btn-view-front"
          type="button"
          onClick={() => handleViewChange('front')}
          className="px-2 py-1 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors"
          title="Vue Face (Front)"
        >
          Face
        </button>
        <button
          id="btn-view-side"
          type="button"
          onClick={() => handleViewChange('side')}
          className="px-2 py-1 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors"
          title="Vue Profil (Side / Droite)"
        >
          Profil
        </button>

        <span className="w-px h-3.5 bg-zinc-700/60" />

        {/* 3D Work Plane Dropdown Toggle Button */}
        <div className="relative">
          <button
            id="btn-workplane-dropdown"
            type="button"
            onClick={() => setShowWorkPlaneMenu(!showWorkPlaneMenu)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all text-xs ${
              showWorkPlaneMenu || workPlaneConfig.gridVisible
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 font-medium'
                : 'border-transparent text-zinc-400 hover:text-white hover:bg-zinc-800/80'
            }`}
            title="Configurer le Plan de travail 3D (Grille, Repères, Altitude, Magnétisme)"
          >
            <Grid className="w-3.5 h-3.5 text-sky-400" />
            <span>Plan de Travail</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {/* Work Plane Config Flyout Modal */}
          {showWorkPlaneMenu && (
            <div
              id="workplane-config-popover"
              className="absolute left-0 top-full mt-2 w-72 p-3.5 rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-700/80 shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 text-xs text-zinc-200 space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
                    <Grid className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white tracking-wide">Plan de Travail 3D</h4>
                    <p className="text-[10px] text-zinc-400 font-mono">Grille, Axes & Raycast</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWorkPlaneMenu(false)}
                  className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800"
                >
                  ✕
                </button>
              </div>

              {/* Toggles */}
              <div className="space-y-2">
                {/* Grid Visibility */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <Grid className="w-3.5 h-3.5 text-sky-400" />
                    <span className="text-xs text-zinc-200">Grille Principale & Mineure</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleWorkPlaneUpdate({ gridVisible: !workPlaneConfig.gridVisible })}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                      workPlaneConfig.gridVisible
                        ? 'bg-sky-500 text-white shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {workPlaneConfig.gridVisible ? 'Visible' : 'Masquée'}
                  </button>
                </div>

                {/* Axes & Center Origin */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <Crosshair className="w-3.5 h-3.5 text-rose-400" />
                    <div>
                      <span className="text-xs text-zinc-200 block">Axes X (Rouge) / Z (Bleu)</span>
                      <span className="text-[9px] text-zinc-500 font-mono">Repère et centre (0,0)</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleWorkPlaneUpdate({ axesVisible: !workPlaneConfig.axesVisible })}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                      workPlaneConfig.axesVisible
                        ? 'bg-rose-500 text-white shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {workPlaneConfig.axesVisible ? 'Visible' : 'Masqué'}
                  </button>
                </div>

                {/* Shadow Catcher Plane */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/80 border border-zinc-800/80">
                  <div className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs text-zinc-200">Ombres Portées au Sol</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleWorkPlaneUpdate({ shadowPlaneVisible: !workPlaneConfig.shadowPlaneVisible })
                    }
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                      workPlaneConfig.shadowPlaneVisible
                        ? 'bg-amber-500 text-zinc-950 font-semibold shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                        : 'bg-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {workPlaneConfig.shadowPlaneVisible ? 'Active' : 'Off'}
                  </button>
                </div>
              </div>

              {/* Work Plane Altitude (Height Y) */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">Altitude du Plan (Y)</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-white font-mono bg-zinc-800 px-1.5 py-0.2 rounded border border-zinc-700">
                      {workPlaneConfig.height.toFixed(1)} m
                    </span>
                    {workPlaneConfig.height !== 0 && (
                      <button
                        type="button"
                        onClick={() => handleWorkPlaneUpdate({ height: 0 })}
                        className="text-[10px] text-sky-400 hover:text-sky-300 underline"
                      >
                        Reset (0)
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="range"
                  min={-5}
                  max={5}
                  step={0.25}
                  value={workPlaneConfig.height}
                  onChange={(e) => handleWorkPlaneUpdate({ height: parseFloat(e.target.value) })}
                  className="w-full accent-sky-500"
                />
              </div>

              {/* Grid Snap Unit Selection */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">Pas de Grille / Magnétisme</span>
                  <span className="text-sky-400 font-mono text-[10px]">
                    {workPlaneConfig.snapUnit} m
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0.25, 0.5, 1.0, 2.0].map((unit) => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => handleWorkPlaneUpdate({ snapUnit: unit })}
                      className={`py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                        workPlaneConfig.snapUnit === unit
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {unit} m
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid Size preset */}
              <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-zinc-400 font-medium">Envergure de la Grille</span>
                  <span className="text-zinc-300 font-mono text-[10px]">
                    {workPlaneConfig.gridSize}m × {workPlaneConfig.gridSize}m
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { size: 20, divs: 20, label: '20m (Studio)' },
                    { size: 40, divs: 40, label: '40m (Standard)' },
                    { size: 80, divs: 80, label: '80m (Vaste)' },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      type="button"
                      onClick={() =>
                        handleWorkPlaneUpdate({
                          gridSize: preset.size,
                          gridDivisions: preset.divs,
                        })
                      }
                      className={`py-1 rounded-lg text-[10px] font-mono border transition-colors ${
                        workPlaneConfig.gridSize === preset.size
                          ? 'bg-sky-500/20 border-sky-500 text-sky-300 font-bold'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {preset.size}m
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <span className="w-px h-3.5 bg-zinc-700/60" />

        <button
          id="btn-focus-object"
          type="button"
          onClick={handleFocus}
          disabled={!selectedNode}
          className={`p-1.5 rounded-xl transition-colors ${
            selectedNode
              ? 'hover:bg-zinc-800 hover:text-sky-400 text-zinc-300'
              : 'text-zinc-600 cursor-not-allowed'
          }`}
          title="Centrer sur l'objet sélectionné (Touche F)"
        >
          <Focus className="w-3.5 h-3.5" />
        </button>

        <button
          id="btn-reset-camera"
          type="button"
          onClick={handleResetCamera}
          className="p-1.5 rounded-xl hover:bg-zinc-800 hover:text-white transition-colors text-zinc-400"
          title="Réinitialiser la caméra (Perspective par défaut)"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Top-Right Performance Stats Chip */}
      <div
        id="viewport-stats-chip"
        className="absolute top-4 right-4 z-20 flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 shadow-2xl text-[11px] font-mono text-zinc-300 pointer-events-none"
      >
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              stats.fps >= 50
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                : stats.fps >= 30
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
          <span className="font-semibold text-zinc-100">{stats.fps} FPS</span>
        </div>
        <span className="w-px h-3 bg-zinc-700/50" />
        <div className="flex items-center gap-1 text-zinc-400">
          <span>{stats.triangles.toLocaleString()}</span>
          <span className="text-zinc-500">tris</span>
        </div>
        <span className="w-px h-3 bg-zinc-700/50" />
        <div className="flex items-center gap-1 text-zinc-400">
          <span>{stats.drawCalls}</span>
          <span className="text-zinc-500">calls</span>
        </div>
      </div>

      {/* Top-Right Interactive 3D Orientation Cube / Compass Gizmo */}
      <div
        id="viewport-orientation-gizmo"
        className="absolute top-16 right-4 z-20 p-2 rounded-3xl bg-zinc-950/85 backdrop-blur-xl border border-zinc-800/80 shadow-2xl flex flex-col items-center gap-1 text-zinc-300"
        title="Boussole d'orientation 3D (Cliquer sur un axe pour orienter la vue)"
      >
        <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider mb-0.5">
          Orientation
        </div>
        <div className="relative w-20 h-20 flex items-center justify-center">
          {/* Circular Track */}
          <div className="absolute inset-0 rounded-full border border-zinc-800/80 pointer-events-none" />

          {/* Top Button (+Y) */}
          <button
            type="button"
            onClick={() => handleViewChange('top')}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-md bg-emerald-500/20 hover:bg-emerald-500 hover:text-white border border-emerald-500/40 text-[9px] font-bold text-emerald-400 flex items-center justify-center transition-all shadow-xs"
            title="Vue Haut (+Y)"
          >
            +Y
          </button>

          {/* Bottom Button (-Y) */}
          <button
            type="button"
            onClick={() => handleViewChange('bottom')}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 rounded-md bg-emerald-950/40 hover:bg-emerald-600 hover:text-white border border-emerald-800/40 text-[9px] font-bold text-emerald-500 flex items-center justify-center transition-all shadow-xs"
            title="Vue Dessous (-Y)"
          >
            -Y
          </button>

          {/* Left Button (-X) */}
          <button
            type="button"
            onClick={() => handleViewChange('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-rose-950/40 hover:bg-rose-600 hover:text-white border border-rose-800/40 text-[9px] font-bold text-rose-400 flex items-center justify-center transition-all shadow-xs"
            title="Vue Gauche (-X)"
          >
            -X
          </button>

          {/* Right Button (+X) */}
          <button
            type="button"
            onClick={() => handleViewChange('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md bg-rose-500/20 hover:bg-rose-500 hover:text-white border border-rose-500/40 text-[9px] font-bold text-rose-400 flex items-center justify-center transition-all shadow-xs"
            title="Vue Droite (+X)"
          >
            +X
          </button>

          {/* Center Perspective (Iso) Button */}
          <button
            type="button"
            onClick={() => handleViewChange('iso')}
            className="w-7 h-7 rounded-xl bg-sky-500/20 hover:bg-sky-500 hover:text-white border border-sky-400/50 text-[10px] font-bold text-sky-300 flex items-center justify-center transition-all shadow-[0_0_10px_rgba(56,189,248,0.3)]"
            title="Vue Perspective Isométrique"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Orthogonal Face (+Z) & Back (-Z) shortcuts */}
        <div className="flex items-center gap-1 mt-0.5">
          <button
            type="button"
            onClick={() => handleViewChange('front')}
            className="px-2 py-0.5 rounded-lg bg-blue-500/20 hover:bg-blue-500 hover:text-white border border-blue-500/40 text-[9px] font-bold text-blue-400 transition-colors"
            title="Vue Face (+Z)"
          >
            +Z Face
          </button>
          <button
            type="button"
            onClick={() => handleViewChange('back')}
            className="px-2 py-0.5 rounded-lg bg-blue-950/40 hover:bg-blue-600 hover:text-white border border-blue-800/40 text-[9px] font-bold text-blue-500 transition-colors"
            title="Vue Arrière (-Z)"
          >
            -Z
          </button>
        </div>
      </div>

      {/* Center Top Mode Indicator (if in Play simulation mode) */}
      {isPlaying && (
        <div
          id="viewport-playmode-banner"
          className="absolute top-16 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 text-xs font-medium backdrop-blur-md shadow-2xl animate-pulse"
        >
          <Play className="w-3.5 h-3.5 fill-emerald-400 text-emerald-400" />
          <span>Simulation Physique Rapier 3D Active</span>
          <span className="w-1 h-1 rounded-full bg-emerald-400" />
          <span className="text-emerald-400/90 font-normal">ZQSD / Flèches + Espace</span>
        </div>
      )}

      {/* Floating Bottom Quick Gizmo Palette */}
      <div
        id="viewport-gizmo-controls"
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 p-1.5 rounded-2xl bg-zinc-950/90 backdrop-blur-md border border-zinc-800/90 shadow-2xl"
      >
        <button
          id="gizmo-mode-translate"
          type="button"
          onClick={() => onGizmoModeChange('translate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            gizmoMode === 'translate'
              ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
          }`}
          title="Déplacement / Translation (W)"
        >
          <Move className="w-3.5 h-3.5" />
          <span>Trans</span>
        </button>
        <button
          id="gizmo-mode-rotate"
          type="button"
          onClick={() => onGizmoModeChange('rotate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            gizmoMode === 'rotate'
              ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
          }`}
          title="Rotation (E)"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Rot</span>
        </button>
        <button
          id="gizmo-mode-scale"
          type="button"
          onClick={() => onGizmoModeChange('scale')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            gizmoMode === 'scale'
              ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(14,165,233,0.4)]'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/80'
          }`}
          title="Échelle / Scale (R)"
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Scale</span>
        </button>

        <span className="w-px h-4 bg-zinc-700/60 mx-1" />

        <button
          id="gizmo-space-toggle"
          type="button"
          onClick={() => onGizmoSpaceChange(gizmoSpace === 'world' ? 'local' : 'world')}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors"
          title={`Espace de transformation actuel : ${gizmoSpace.toUpperCase()} (Cliquer pour alterner)`}
        >
          <Globe className="w-3.5 h-3.5 text-zinc-400" />
          <span className="uppercase tracking-wider text-[11px]">{gizmoSpace}</span>
        </button>
      </div>

      {/* Bottom-Left Keyboard Shortcuts & Help */}
      <div className="absolute bottom-5 left-4 z-20">
        <button
          id="btn-toggle-shortcuts"
          type="button"
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800/80 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-all shadow-lg"
          title="Raccourcis Clavier"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>Raccourcis</span>
        </button>

        {showShortcuts && (
          <div
            id="shortcuts-popup"
            className="absolute bottom-10 left-0 w-64 p-3 rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-zinc-700/70 shadow-2xl text-xs text-zinc-300 space-y-2"
          >
            <div className="font-semibold text-zinc-100 flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span>Contrôles Éditeur 3D</span>
              <span className="text-[10px] text-zinc-500 font-normal">Aether 3D</span>
            </div>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Basculer Grille Sol</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">G</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Déplacement / Trans</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">W</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Rotation</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">E</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Échelle / Scale</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">R</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Centrer la caméra</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">F</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Play / Pause</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">Espace</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Supprimer</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">Suppr / Backspace</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Désélectionner</span>
                <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-200">Échap</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-zinc-400">Orbite / Pan</span>
                <span className="text-zinc-400 text-[10px]">Clic G / Droit + Glisser</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Selection Hint when empty */}
      {!selectedNode && !isPlaying && (
        <div className="absolute top-16 right-32 z-10 pointer-events-none px-3 py-1.5 rounded-xl bg-zinc-950/70 backdrop-blur-sm border border-zinc-800/50 text-[11px] text-zinc-400 transition-opacity">
          💡 Plan de travail 3D interactif • Glissez un asset ou cliquez un objet 3D
        </div>
      )}

      {/* Speedometer & Driving HUD */}
      {isPlaying && vehicleHUDData.active && (
        <SpeedometerHUD
          speedKmH={vehicleHUDData.speedKmH}
          maxSpeedKmH={vehicleHUDData.maxSpeedKmH}
          isDrifting={vehicleHUDData.isDrifting}
          isBoosting={vehicleHUDData.isBoosting}
        />
      )}
    </div>
  );
};
