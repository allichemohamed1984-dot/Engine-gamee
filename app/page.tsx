'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import {
  Mountain,
  User,
  Sparkles,
  Play,
  Share2,
  PanelLeftClose,
  PanelLeft,
  Sliders,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { SceneManager } from '../lib/SceneManager';
import { Viewport } from '../components/Viewport';
import { Hierarchy } from '../components/Hierarchy';
import { Inspector } from '../components/Inspector';
import { Toolbar } from '../components/Toolbar';
import { AssetManager } from '../components/AssetManager';
import { NodeGraphModal } from '../components/NodeGraphModal';
import { AtmosphereModal } from '../components/AtmosphereModal';
import { TerrainToolPanel } from '../components/TerrainToolPanel';
import { HUDManagerModal } from '../components/HUDManagerModal';
import { InGameHUDOverlay } from '../components/InGameHUDOverlay';
import { ExportModal } from '../components/ExportModal';
import { ExportGameModal } from '../components/ExportGameModal';
import { TimelineEditorModal } from '../components/TimelineEditorModal';
import { TextureAssignerPanel } from '../components/TextureAssignerPanel';
import { EntityLogicData, NodeGraphData } from '../types/logic';
import {
  AtmosphereData,
  PostProcessingData,
  SkyPreset,
  DEFAULT_ATMOSPHERE,
  DEFAULT_POST_PROCESSING,
} from '../types/atmosphere';
import {
  TerrainConfig,
  TerrainBrushConfig,
  DEFAULT_TERRAIN_BRUSH,
  DEFAULT_TERRAIN_CONFIG,
} from '../types/terrain';
import { HUDConfig, DEFAULT_HUD_CONFIG } from '../types/hud';
import {
  SceneNode,
  GizmoMode,
  GizmoSpace,
  RenderMode,
  EngineStats,
  TransformData,
  MaterialData,
  LightData,
  PhysicsNodeData,
  RigAnimData,
  SceneExportData,
  WorkPlaneConfig,
  DEFAULT_WORK_PLANE_CONFIG,
  ParticleEmitterData,
} from '../types/engine';

export default function AetherStudioPage() {
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // Studio Reactive State
  const [nodes, setNodes] = useState<SceneNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>('translate');
  const [gizmoSpace, setGizmoSpace] = useState<GizmoSpace>('world');
  const [renderMode, setRenderMode] = useState<RenderMode>('shaded');
  const [snapping, setSnapping] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [is2DModeEnabled, setIs2DModeEnabled] = useState<boolean>(false);
  const [isAssetManagerOpen, setIsAssetManagerOpen] = useState<boolean>(true);
  const [isHierarchyOpen, setIsHierarchyOpen] = useState<boolean>(true);
  const [workflowMode, setWorkflowMode] = useState<'decor' | 'character' | 'rules' | 'test'>('decor');

  // Tools & Modals State
  const [isAtmosphereModalOpen, setIsAtmosphereModalOpen] = useState<boolean>(false);
  const [isTerrainPanelOpen, setIsTerrainPanelOpen] = useState<boolean>(false);
  const [isHUDModalOpen, setIsHUDModalOpen] = useState<boolean>(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isExportGameModalOpen, setIsExportGameModalOpen] = useState<boolean>(false);
  const [isTexturePanelOpen, setIsTexturePanelOpen] = useState<boolean>(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState<boolean>(false);
  const [exportSceneData, setExportSceneData] = useState<SceneExportData | null>(null);

  // Prefab System State
  const [prefabs, setPrefabs] = useState<Array<{ id: string; name: string; nodes: any[] }>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('aether_prefabs');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleSaveAsPrefab = useCallback((id: string) => {
    if (!sceneManagerRef.current) return;
    const sm = sceneManagerRef.current;

    // Get selected objects or fallback to single clicked object
    let objectsToSave: THREE.Object3D[] = [];
    if (sm.selectedObjects.length > 1 && sm.selectedObjects.some((o) => o.uuid === id)) {
      objectsToSave = [...sm.selectedObjects];
    } else {
      const single = (sm as any).objects.get(id);
      if (single) {
        objectsToSave = [single];
      }
    }

    if (objectsToSave.length === 0) return;

    const defaultName = objectsToSave.length === 1 ? objectsToSave[0].name : 'Nouveau Préfabriqué';
    const name = prompt(
      `Nommer le préfabriqué (${objectsToSave.length} objet(s) sélectionné(s)) :`,
      defaultName
    );
    if (!name) return;

    // Serialize each object
    const nodes = objectsToSave.map((obj) => (sm as any).toSceneNode(obj));

    const newPrefab = {
      id: `prefab_${Date.now()}`,
      name,
      nodes,
    };

    setPrefabs((prev) => {
      const next = [...prev, newPrefab];
      localStorage.setItem('aether_prefabs', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleAddPrefab = useCallback((nodes: any[]) => {
    if (!sceneManagerRef.current) return;
    sceneManagerRef.current.instantiatePrefab(nodes);
  }, []);

  const handleDeletePrefab = useCallback((prefabId: string) => {
    setPrefabs((prev) => {
      const next = prev.filter((p) => p.id !== prefabId);
      localStorage.setItem('aether_prefabs', JSON.stringify(next));
      return next;
    });
  }, []);

  // Engine Subsystem States
  const [workPlaneConfig, setWorkPlaneConfig] = useState<WorkPlaneConfig>(DEFAULT_WORK_PLANE_CONFIG);
  const [atmosphere, setAtmosphere] = useState<AtmosphereData>(DEFAULT_ATMOSPHERE);
  const [postProcessing, setPostProcessing] = useState<PostProcessingData>(DEFAULT_POST_PROCESSING);
  const [terrainBrush, setTerrainBrush] = useState<TerrainBrushConfig>(DEFAULT_TERRAIN_BRUSH);
  const [terrainConfig, setTerrainConfig] = useState<TerrainConfig>(DEFAULT_TERRAIN_CONFIG);
  const [hudConfig, setHudConfig] = useState<HUDConfig>(DEFAULT_HUD_CONFIG);

  // Node Graph Modal State
  const [isNodeGraphOpen, setIsNodeGraphOpen] = useState<boolean>(false);
  const [nodeGraphTargetNode, setNodeGraphTargetNode] = useState<SceneNode | null>(null);
  const [nodeGraphInitialData, setNodeGraphInitialData] = useState<NodeGraphData | undefined>(undefined);
  const [stats, setStats] = useState<EngineStats>({
    fps: 60,
    triangles: 0,
    drawCalls: 0,
    objectsCount: 0,
  });

  // Track selection id in ref to keep sync across re-renders
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedNode?.id || null;
  }, [selectedNode?.id]);

  // Initialize Three.js SceneManager once canvas container is mounted
  useEffect(() => {
    const viewportContainer = document.getElementById('aether-viewport');
    if (!viewportContainer) return;

    const sm = new SceneManager(viewportContainer, {
      onSelectionChange: (node, ids) => {
        setSelectedNode(node);
        setSelectedIds(ids || (node ? [node.id] : []));
      },
      onHierarchyChange: (updatedNodes) => {
        setNodes(updatedNodes);
        if (selectedIdRef.current) {
          const match = updatedNodes.find((n) => n.id === selectedIdRef.current);
          if (match) setSelectedNode(match);
        }
      },
      onTransformChange: (node) => {
        setSelectedNode(node);
        setNodes((prev) => prev.map((n) => (n.id === node.id ? node : n)));
      },
      onStatsUpdate: (engineStats) => {
        setStats(engineStats);
      },
      onPlayStateChange: (playing) => {
        setIsPlaying(playing);
      },
    });

    sceneManagerRef.current = sm;

    return () => {
      sm.dispose();
      sceneManagerRef.current = null;
    };
  }, []);

  // Handlers for Gizmo & Viewport Modes
  const handleGizmoModeChange = useCallback((mode: GizmoMode) => {
    setGizmoMode(mode);
    sceneManagerRef.current?.setGizmoMode(mode);
  }, []);

  const handleGizmoSpaceChange = useCallback((space: GizmoSpace) => {
    setGizmoSpace(space);
    sceneManagerRef.current?.setGizmoSpace(space);
  }, []);

  const handleRenderModeChange = useCallback((mode: RenderMode) => {
    setRenderMode(mode);
    sceneManagerRef.current?.setRenderMode(mode);
  }, []);

  const handleToggleSnapping = useCallback(() => {
    setSnapping((prev) => {
      const next = !prev;
      sceneManagerRef.current?.setSnapping(next);
      return next;
    });
  }, []);

  const handleTogglePlay = useCallback(() => {
    sceneManagerRef.current?.togglePlayMode();
  }, []);

  // Hierarchy Handlers
  const handleSelectNode = useCallback((id: string) => {
    sceneManagerRef.current?.selectById(id);
  }, []);

  const handleToggleVisibility = useCallback((id: string, currentVisible: boolean) => {
    sceneManagerRef.current?.setVisibility(id, !currentVisible);
  }, []);

  const handleDeleteNode = useCallback((id: string) => {
    sceneManagerRef.current?.deleteObject(id);
  }, []);

  const handleDuplicateNode = useCallback((id: string) => {
    sceneManagerRef.current?.duplicateObject(id);
  }, []);

  const handleRenameNode = useCallback((id: string, newName: string) => {
    sceneManagerRef.current?.updateObjectName(id, newName);
  }, []);

  // Primitives & Object Addition
  const handleAddPrimitive = useCallback(
    (
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
    ) => {
      sceneManagerRef.current?.addPrimitive(type, dropPos);
    },
    []
  );

  // Inspector Handlers
  const handleUpdateTransform = useCallback((id: string, transform: Partial<TransformData>) => {
    sceneManagerRef.current?.updateTransform(id, transform);
  }, []);

  const handleUpdateMaterial = useCallback((id: string, material: Partial<MaterialData>) => {
    sceneManagerRef.current?.updateMaterial(id, material);
  }, []);

  const handleUpdateRiverConfig = useCallback((id: string, config: Partial<any>) => {
    sceneManagerRef.current?.updateRiverConfig(id, config);
    // Refresh selectedNode to update Inspector UI immediately
    if (selectedNode && selectedNode.id === id) {
      const updatedNodes = sceneManagerRef.current?.getSceneHierarchy() || [];
      const updatedSelected = updatedNodes.find((n) => n.id === id);
      if (updatedSelected) {
        setSelectedNode(updatedSelected);
      }
    }
  }, [selectedNode]);

  const handleUpdateParticlesConfig = useCallback((id: string, config: Partial<ParticleEmitterData>) => {
    sceneManagerRef.current?.updateParticlesConfig(id, config);
    // Refresh selectedNode to update Inspector UI immediately
    if (selectedNode && selectedNode.id === id) {
      const updatedNodes = sceneManagerRef.current?.getSceneHierarchy() || [];
      const updatedSelected = updatedNodes.find((n) => n.id === id);
      if (updatedSelected) {
        setSelectedNode(updatedSelected);
      }
    }
  }, [selectedNode]);

  const handleUpdateLight = useCallback((id: string, light: Partial<LightData>) => {
    sceneManagerRef.current?.updateLight(id, light);
  }, []);

  const handleUpdatePhysics = useCallback((id: string, physics: Partial<PhysicsNodeData>) => {
    sceneManagerRef.current?.updatePhysics(id, physics);
  }, []);

  const handleUpdateLogic = useCallback((id: string, logic: Partial<EntityLogicData>) => {
    sceneManagerRef.current?.updateLogic(id, logic);
  }, []);

  const handleUpdateRigAnim = useCallback((id: string, rig: Partial<RigAnimData>) => {
    sceneManagerRef.current?.setRigAnim(id, rig);
    const updatedNodes = sceneManagerRef.current?.getSceneHierarchy() || [];
    setNodes(updatedNodes);
    const updatedSelected = updatedNodes.find((n) => n.id === id);
    if (updatedSelected) setSelectedNode(updatedSelected);
  }, []);

  const handleAppendAnimations = useCallback(async (id: string, file: File): Promise<string[]> => {
    if (!sceneManagerRef.current) return [];
    const added = await sceneManagerRef.current.appendAnimationsToModel(id, file);
    const updatedNodes = sceneManagerRef.current.getSceneHierarchy() || [];
    setNodes(updatedNodes);
    const updatedSelected = updatedNodes.find((n) => n.id === id);
    if (updatedSelected) setSelectedNode(updatedSelected);
    return added;
  }, []);

  const handleTestAnimation = useCallback((id: string, clipName: string) => {
    sceneManagerRef.current?.playSkeletalAnimation(id, clipName);
  }, []);

  const handleStopTestAnimation = useCallback((id: string) => {
    sceneManagerRef.current?.stopSkeletalAnimations(id);
  }, []);

  const handleTestRagdoll = useCallback((id: string) => {
    if (!sceneManagerRef.current) return;
    if (sceneManagerRef.current.isRagdollActive(id)) {
      sceneManagerRef.current.deactivateRagdoll(id);
    } else {
      sceneManagerRef.current.triggerRagdoll(id, new THREE.Vector3(0, 1.5, -2.5));
    }
  }, []);

  const handleToggleDebugWireframes = useCallback((id: string, show: boolean) => {
    sceneManagerRef.current?.showRagdollWireframes(id, show);
  }, []);

  const handleOpenNodeGraph = useCallback((node: SceneNode, initialGraph?: NodeGraphData) => {
    setNodeGraphTargetNode(node);
    setNodeGraphInitialData(initialGraph || node.logic?.nodeGraph);
    setIsNodeGraphOpen(true);
  }, []);

  const handleOpenTimeline = useCallback((node: SceneNode) => {
    setSelectedNode(node);
    setIsTimelineOpen(true);
  }, []);

  const handleSaveNodeGraph = useCallback((graph: NodeGraphData) => {
    if (nodeGraphTargetNode) {
      handleUpdateLogic(nodeGraphTargetNode.id, {
        nodeGraph: graph,
        activeLevel: 'graph',
      });
      
      // If simulation is running, restart to apply changes
      if (isPlaying) {
        sceneManagerRef.current?.setPlayMode(false).then(() => {
          sceneManagerRef.current?.setPlayMode(true);
        });
      }
    }
  }, [nodeGraphTargetNode, handleUpdateLogic, isPlaying]);

  const handleToggleShadows = useCallback((id: string, cast: boolean, receive: boolean) => {
    sceneManagerRef.current?.setShadows(id, cast, receive);
  }, []);

  const handleFocusObject = useCallback((id: string) => {
    sceneManagerRef.current?.focusOnObject(id);
  }, []);

  // Atmosphere & Post-Processing Handlers
  const handleUpdateAtmosphere = useCallback((data: Partial<AtmosphereData>) => {
    setAtmosphere((prev) => ({ ...prev, ...data }));
    sceneManagerRef.current?.updateAtmosphere(data);
  }, []);

  const handleUpdatePostProcessing = useCallback((data: Partial<PostProcessingData>) => {
    setPostProcessing((prev) => ({ ...prev, ...data }));
    sceneManagerRef.current?.updatePostProcessing(data);
  }, []);

  const handleApplySkyPreset = useCallback((preset: SkyPreset) => {
    sceneManagerRef.current?.applySkyPreset(preset);
    if (sceneManagerRef.current?.atmosphereManager) {
      setAtmosphere({ ...sceneManagerRef.current.atmosphereManager.atmosphere });
    }
  }, []);

  // 3D Work Plane Handlers
  const handleUpdateWorkPlaneConfig = useCallback((partial: Partial<WorkPlaneConfig>) => {
    setWorkPlaneConfig((prev) => {
      const updated = { ...prev, ...partial };
      sceneManagerRef.current?.setWorkPlaneConfig(updated);
      return updated;
    });
  }, []);

  // Terrain & Foliage Handlers
  const handleUpdateTerrainBrush = useCallback((brush: Partial<TerrainBrushConfig>) => {
    setTerrainBrush((prev) => {
      const updated = { ...prev, ...brush };
      sceneManagerRef.current?.setTerrainBrush(updated);
      return updated;
    });
  }, []);

  const handleUpdateTerrainConfig = useCallback((cfg: Partial<TerrainConfig>) => {
    setTerrainConfig((prev) => {
      const updated = { ...prev, ...cfg };
      if (sceneManagerRef.current?.terrainGenerator) {
        sceneManagerRef.current.terrainGenerator.config = updated;
      }
      return updated;
    });
  }, []);

  const handleRegenerateTerrain = useCallback(() => {
    sceneManagerRef.current?.regenerateTerrain();
  }, []);

  const handleClearFoliage = useCallback(() => {
    sceneManagerRef.current?.clearFoliage();
  }, []);

  // HUD Handlers
  const handleSaveHUDConfig = useCallback((config: HUDConfig) => {
    setHudConfig(config);
    sceneManagerRef.current?.updateHUDConfig(config);
  }, []);

  // One-Click Standalone Game Export
  const handleOpenExportModal = useCallback(() => {
    if (!sceneManagerRef.current) return;
    const currentScene = sceneManagerRef.current.exportScene();
    setExportSceneData(currentScene);
    setIsExportModalOpen(true);
  }, []);

  // Asset Management & Pipeline
  const handleImportGLTF = useCallback(async (file: File) => {
    if (!sceneManagerRef.current) return;
    await sceneManagerRef.current.importGLTF(file);
  }, []);

  const handleApplyMaterialPreset = useCallback(
    (presetName: string) => {
      if (!sceneManagerRef.current) return;
      if (selectedNode) {
        sceneManagerRef.current.applyMaterialPreset(selectedNode.id, presetName);
      } else {
        const firstMesh = nodes.find((n) => n.type === 'mesh' || n.type === 'group');
        if (firstMesh) {
          sceneManagerRef.current.selectById(firstMesh.id);
          sceneManagerRef.current.applyMaterialPreset(firstMesh.id, presetName);
        }
      }
    },
    [selectedNode, nodes]
  );

  // Scene Persistence (Export/Import JSON)
  const handleExportScene = useCallback(() => {
    if (!sceneManagerRef.current) return;
    const sceneData = sceneManagerRef.current.exportScene();
    const jsonStr = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aether-scene-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImportSceneJSON = useCallback((data: SceneExportData) => {
    sceneManagerRef.current?.importScene(data);
    if (data.atmosphere) setAtmosphere(data.atmosphere);
    if (data.postProcessing) setPostProcessing(data.postProcessing);
    if (data.hud) setHudConfig(data.hud);
    if (data.terrain?.config) setTerrainConfig(data.terrain.config);
  }, []);

  const handleClearScene = useCallback(() => {
    sceneManagerRef.current?.clearUserScene();
  }, []);

  const handleToggle2DMode = useCallback(() => {
    setIs2DModeEnabled((prev) => {
      const next = !prev;
      sceneManagerRef.current?.toggle2DEffect(next);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans select-none">
      {/* Studio Top Toolbar */}
      <Toolbar
        isPlaying={isPlaying}
        gizmoMode={gizmoMode}
        gizmoSpace={gizmoSpace}
        renderMode={renderMode}
        snapping={snapping}
        isAssetManagerOpen={isAssetManagerOpen}
        isTerrainPanelOpen={isTerrainPanelOpen}
        is2DModeEnabled={is2DModeEnabled}
        onTogglePlay={handleTogglePlay}
        onGizmoModeChange={handleGizmoModeChange}
        onGizmoSpaceChange={handleGizmoSpaceChange}
        onRenderModeChange={handleRenderModeChange}
        onToggleSnapping={handleToggleSnapping}
        onToggleAssetManager={() => setIsAssetManagerOpen(!isAssetManagerOpen)}
        onToggleTerrainPanel={() => {
          const next = !isTerrainPanelOpen;
          setIsTerrainPanelOpen(next);
          sceneManagerRef.current?.setTerrainBrush(
            next ? terrainBrush : { ...terrainBrush, mode: 'none' }
          );
        }}
        onToggle2DMode={handleToggle2DMode}
        onOpenAtmosphereModal={() => setIsAtmosphereModalOpen(true)}
        onOpenHUDModal={() => setIsHUDModalOpen(true)}
        onOpenTexturePanel={() => setIsTexturePanelOpen(true)}
        onOpenExportModal={handleOpenExportModal}
        onAddPrimitive={handleAddPrimitive}
        onImportGLTF={handleImportGLTF}
        onExportScene={handleExportScene}
      />

      {/* Canva/Roblox Studio Style Workflow Navigation Bar */}
      <div className="h-[52px] w-full bg-zinc-950 border-b border-zinc-800/80 px-4 flex items-center justify-between shadow-md z-30 relative backdrop-blur-md shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsHierarchyOpen((prev) => !prev)}
            className="p-1.5 rounded-xl hover:bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all shadow-sm flex items-center gap-1.5"
            title={isHierarchyOpen ? "Masquer le panneau gauche" : "Afficher le panneau gauche"}
          >
            {isHierarchyOpen ? (
              <PanelLeftClose className="w-4 h-4 text-sky-400" />
            ) : (
              <PanelLeft className="w-4 h-4 text-sky-400" />
            )}
            <span className="text-[11px] font-semibold hidden sm:inline">Hiérarchie</span>
          </button>
        </div>

        {/* Centered 4-Workflow Tabs (Navigation Supérieure) */}
        <div className="flex bg-zinc-900/90 p-1 rounded-2xl border border-zinc-800/60 shadow-lg gap-1.5">
          <button
            onClick={() => {
              setWorkflowMode('decor');
              setIsAssetManagerOpen(true);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              workflowMode === 'decor'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span>🗺️</span>
            <span className="hidden md:inline">1. Décor & Monde</span>
            <span className="md:hidden">Monde</span>
          </button>

          <button
            onClick={() => {
              setWorkflowMode('character');
              setIsAssetManagerOpen(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              workflowMode === 'character'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span>👤</span>
            <span className="hidden md:inline">2. Personnage & Anims</span>
            <span className="md:hidden">Héros</span>
          </button>

          <button
            onClick={() => {
              setWorkflowMode('rules');
              setIsAssetManagerOpen(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              workflowMode === 'rules'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span>⚡</span>
            <span className="hidden md:inline">3. Règles du Jeu</span>
            <span className="md:hidden">Règles</span>
          </button>

          <button
            onClick={() => {
              setWorkflowMode('test');
              setIsAssetManagerOpen(false);
              setIsHierarchyOpen(false);
            }}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
              workflowMode === 'test'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <span>🚀</span>
            <span className="hidden md:inline">4. Tester & Partager</span>
            <span className="md:hidden">Tester</span>
          </button>
        </div>

        {/* Right Help / Mode indicator */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Mode : {workflowMode.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Main Studio Work Area (Bento Layout) */}
      <main className="flex-1 flex w-full h-[calc(100vh-6.5rem)] overflow-hidden relative">
        {/* Left: Scene Hierarchy (Retractable / Collapsible) */}
        {isHierarchyOpen && (
          <Hierarchy
            nodes={nodes}
            selectedNode={selectedNode}
            selectedIds={selectedIds}
            onSelectNode={handleSelectNode}
            onToggleVisibility={handleToggleVisibility}
            onDeleteNode={handleDeleteNode}
            onDuplicateNode={handleDuplicateNode}
            onRenameNode={handleRenameNode}
            onAddPrimitive={handleAddPrimitive}
            workflowMode={workflowMode}
          />
        )}

        {/* Center: 3D Viewport & Bottom Asset Manager Shelf */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          {/* Central 3D Viewport with Raycasting Drop Target */}
          <div className="flex-1 relative overflow-hidden">
            <Viewport
              sceneManagerRef={sceneManagerRef}
              selectedNode={selectedNode}
              gizmoMode={gizmoMode}
              gizmoSpace={gizmoSpace}
              isPlaying={isPlaying}
              stats={stats}
              workPlaneConfig={workPlaneConfig}
              onUpdateWorkPlaneConfig={handleUpdateWorkPlaneConfig}
              onGizmoModeChange={handleGizmoModeChange}
              onGizmoSpaceChange={handleGizmoSpaceChange}
              onTogglePlay={handleTogglePlay}
              onImportGLTF={handleImportGLTF}
              onImportSceneJSON={handleImportSceneJSON}
              onAddPrimitiveAtPos={(type, pos) =>
                handleAddPrimitive(type as Parameters<typeof handleAddPrimitive>[0], pos)
              }
              onApplyMaterialPreset={handleApplyMaterialPreset}
            />

            {/* Overlaid WYSIWYG In-Game HUD (Visible during gameplay & editor preview) */}
            <InGameHUDOverlay
              config={hudConfig}
              isPlaying={isPlaying}
              onRestart={() => {
                sceneManagerRef.current?.setPlayMode(false);
                setTimeout(() => sceneManagerRef.current?.setPlayMode(true), 100);
              }}
              onResume={() => {
                // Resume game
              }}
              onPause={() => {
                // Pause game
              }}
            />

            {/* Floating Terrain Sculpting & Foliage Painter Tool Panel */}
            <TerrainToolPanel
              isOpen={isTerrainPanelOpen}
              onToggleOpen={() => {
                setIsTerrainPanelOpen(false);
                sceneManagerRef.current?.setTerrainBrush({ mode: 'none' });
              }}
              brushConfig={terrainBrush}
              onUpdateBrush={handleUpdateTerrainBrush}
              terrainConfig={terrainConfig}
              onUpdateTerrainConfig={handleUpdateTerrainConfig}
              onRegenerateTerrain={handleRegenerateTerrain}
              onClearFoliage={handleClearFoliage}
            />
          </div>

          {/* Bottom Docked Asset Manager Shelf */}
          <AssetManager
            isOpen={isAssetManagerOpen}
            onToggleOpen={() => setIsAssetManagerOpen(!isAssetManagerOpen)}
            onAddPrimitive={handleAddPrimitive}
            onApplyMaterialPreset={handleApplyMaterialPreset}
            onImportGLTF={handleImportGLTF}
            onExportScene={handleExportScene}
            onImportSceneJSON={handleImportSceneJSON}
            onClearScene={handleClearScene}
            hasSelectedNode={Boolean(selectedNode)}
            workflowMode={workflowMode}
            prefabs={prefabs}
            onAddPrefab={handleAddPrefab}
            onDeletePrefab={handleDeletePrefab}
          />
        </div>

        {/* Right: Object Inspector with Advanced PBR Sliders */}
        <Inspector
          selectedNode={selectedNode}
          onUpdateTransform={handleUpdateTransform}
          onUpdateMaterial={handleUpdateMaterial}
          onUpdateLight={handleUpdateLight}
          onUpdatePhysics={handleUpdatePhysics}
          onUpdateLogic={handleUpdateLogic}
          onUpdateRigAnim={handleUpdateRigAnim}
          onGetChildNames={(id) => sceneManagerRef.current?.getChildNames(id) || []}
          onAppendAnimations={handleAppendAnimations}
          onTestAnimation={handleTestAnimation}
          onStopTestAnimation={handleStopTestAnimation}
          onTestRagdoll={handleTestRagdoll}
          onToggleDebugWireframes={handleToggleDebugWireframes}
          onOpenNodeGraph={handleOpenNodeGraph}
          onOpenTimeline={handleOpenTimeline}
          onUpdateName={handleRenameNode}
          onToggleVisibility={handleToggleVisibility}
          onToggleShadows={handleToggleShadows}
          onFocusObject={handleFocusObject}
          onDuplicateObject={handleDuplicateNode}
          onDeleteObject={handleDeleteNode}
          onUpdateRiverConfig={handleUpdateRiverConfig}
          onUpdateParticles={handleUpdateParticlesConfig}
          onSaveAsPrefab={handleSaveAsPrefab}
          workflowMode={workflowMode}
        />
      </main>

      {/* Animation & Trajectory Keyframe Editor Modal */}
      {isTimelineOpen && selectedNode && (
        <TimelineEditorModal
          isOpen={isTimelineOpen}
          selectedNode={selectedNode}
          sceneManagerRef={sceneManagerRef}
          onClose={() => setIsTimelineOpen(false)}
        />
      )}

      {/* Level 2: Visual Node Graph Modal */}
      {isNodeGraphOpen && nodeGraphTargetNode && (
        <NodeGraphModal
          key={nodeGraphTargetNode.id}
          isOpen={isNodeGraphOpen}
          onClose={() => setIsNodeGraphOpen(false)}
          entityId={nodeGraphTargetNode.id}
          entityName={nodeGraphTargetNode.name}
          initialGraph={nodeGraphInitialData || nodeGraphTargetNode.logic?.nodeGraph}
          onSave={handleSaveNodeGraph}
        />
      )}

      {/* Atmosphere & Sky Manager Modal */}
      {isAtmosphereModalOpen && (
        <AtmosphereModal
          isOpen={isAtmosphereModalOpen}
          onClose={() => setIsAtmosphereModalOpen(false)}
          atmosphere={atmosphere}
          postProcessing={postProcessing}
          onUpdateAtmosphere={handleUpdateAtmosphere}
          onApplySkyPreset={handleApplySkyPreset}
          onUpdatePostProcessing={handleUpdatePostProcessing}
          onSelectWaterNode={() => {
            const waterMesh = sceneManagerRef.current?.waterManager?.waterMesh;
            if (waterMesh) {
              sceneManagerRef.current?.selectById(waterMesh.uuid);
            }
          }}
          onAddRiver={() => handleAddPrimitive('river')}
          nodes={nodes}
          onUpdateRiverConfig={handleUpdateRiverConfig}
        />
      )}

      {/* WYSIWYG In-Game HUD Manager Modal */}
      {isHUDModalOpen && (
        <HUDManagerModal
          isOpen={isHUDModalOpen}
          onClose={() => setIsHUDModalOpen(false)}
          config={hudConfig}
          onSave={handleSaveHUDConfig}
        />
      )}

      {/* Standalone One-Click Web Game Exporter Modal */}
      {isExportModalOpen && exportSceneData && (
        <ExportModal
          isOpen={isExportModalOpen}
          onClose={() => setIsExportModalOpen(false)}
          sceneData={exportSceneData}
        />
      )}

      {/* Standalone Itch.io / Web Game Exporter Modal */}
      <ExportGameModal
        isOpen={isExportGameModalOpen}
        onClose={() => setIsExportGameModalOpen(false)}
        sceneManagerRef={sceneManagerRef}
        appName="Aether Game Project"
      />

      {/* Texture Assigner Modal Panel */}
      <TextureAssignerPanel
        isOpen={isTexturePanelOpen}
        onClose={() => setIsTexturePanelOpen(false)}
        selectedNode={selectedNode}
        onUpdateMaterial={handleUpdateMaterial}
      />
    </div>
  );
}

