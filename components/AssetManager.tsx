'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Circle,
  Cylinder,
  LifeBuoy,
  Triangle,
  Sun,
  Camera,
  UploadCloud,
  Download,
  FolderOpen,
  Sparkles,
  ChevronUp,
  ChevronDown,
  Layers,
  Palette,
  FileCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  Gamepad2,
  Waves,
  Target,
  Flag,
  BoxSelect,
  Trash2,
} from 'lucide-react';
import { ModelInfo, SceneExportData } from '../types/engine';

interface AssetManagerProps {
  isOpen: boolean;
  onToggleOpen: () => void;
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
      | 'river'
      | 'triggerVolume'
      | 'navMeshAgent'
      | 'checkpoint',
    dropPos?: { x: number; y: number; z: number }
  ) => void;
  onApplyMaterialPreset: (presetName: string) => void;
  onImportGLTF: (file: File) => Promise<void>;
  onExportScene: () => void;
  onImportSceneJSON: (data: SceneExportData) => void;
  onClearScene: () => void;
  hasSelectedNode: boolean;
  workflowMode?: 'decor' | 'character' | 'rules' | 'test';
  prefabs?: Array<{ id: string; name: string; nodes: any[] }>;
  onAddPrefab?: (nodes: any[]) => void;
  onDeletePrefab?: (id: string) => void;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  isOpen,
  onToggleOpen,
  onAddPrimitive,
  onApplyMaterialPreset,
  onImportGLTF,
  onExportScene,
  onImportSceneJSON,
  onClearScene,
  hasSelectedNode,
  workflowMode = 'decor',
  prefabs = [],
  onAddPrefab,
  onDeletePrefab,
}) => {
  const [activeTab, setActiveTab] = useState<'primitives' | 'materials' | 'models' | 'scene' | 'prefabs'>('primitives');
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [importStatus, setImportStatus] = useState<{
    loading: boolean;
    success?: string;
    error?: string;
    info?: ModelInfo;
  }>({ loading: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Primitives library definition
  const primitives = [
    { type: 'cube', label: 'Cube', icon: Box, color: 'text-sky-400', desc: 'Boîte 1.5m' },
    { type: 'sphere', label: 'Sphère', icon: Circle, color: 'text-rose-400', desc: 'Sphère PBR' },
    { type: 'player', label: 'Joueur FPS/3P', icon: Gamepad2, color: 'text-cyan-400', desc: 'Contrôleur ZQSD' },
    { type: 'cylinder', label: 'Cylindre', icon: Cylinder, color: 'text-emerald-400', desc: 'Pilier 1.8m' },
    { type: 'torus', label: 'Tore', icon: LifeBuoy, color: 'text-amber-400', desc: 'Anneau 0.9m' },
    { type: 'cone', label: 'Cône', icon: Triangle, color: 'text-purple-400', desc: 'Cône 1.8m' },
    { type: 'plane', label: 'Plan', icon: Layers, color: 'text-zinc-400', desc: 'Surface sol' },
    { type: 'pointLight', label: 'Lumière Point', icon: Sun, color: 'text-amber-300', desc: 'Lueur omnidirectionnelle' },
    { type: 'spotLight', label: 'Spot Light', icon: Zap, color: 'text-yellow-400', desc: 'Faisceau conique' },
    { type: 'dirLight', label: 'Soleil Dir', icon: Sun, color: 'text-orange-400', desc: 'Ombres parallèles' },
    { type: 'camera', label: 'Caméra Cible', icon: Camera, color: 'text-emerald-300', desc: 'Repère visuel' },
    { type: 'river', label: 'Rivière 3D', icon: Waves, color: 'text-cyan-400', desc: 'Rivière animée' },
    { type: 'navMeshAgent', label: 'PNJ NavMesh', icon: Target, color: 'text-rose-400', desc: 'IA Pathfinding A*' },
    { type: 'triggerVolume', label: 'Zone Trigger', icon: BoxSelect, color: 'text-purple-400', desc: 'Volume déclencheur' },
    { type: 'checkpoint', label: 'Checkpoint', icon: Flag, color: 'text-emerald-400', desc: 'Point de réapparition' },
  ] as const;

  // Material presets definition
  const materialPresets = [
    { id: 'gold', name: 'Or Brossé', color: '#f59e0b', roughness: 0.18, metalness: 0.95, texture: 'brushed' },
    { id: 'chrome', name: 'Chrome Miroir', color: '#ffffff', roughness: 0.05, metalness: 1.0, texture: 'lisse' },
    { id: 'emerald', name: 'Émeraude Émissive', color: '#10b981', roughness: 0.15, metalness: 0.4, glow: true },
    { id: 'ruby', name: 'Rubis Rayonnant', color: '#e11d48', roughness: 0.2, metalness: 0.5, glow: true },
    { id: 'carbon', name: 'Fibre de Carbone', color: '#1e293b', roughness: 0.4, metalness: 0.3, texture: 'carbone' },
    { id: 'cyberNeon', name: 'Néon Cyber Cyan', color: '#06b6d4', roughness: 0.2, metalness: 0.1, glow: true },
    { id: 'obsidian', name: 'Obsidienne Noire', color: '#0f172a', roughness: 0.1, metalness: 0.8, texture: 'lisse' },
    { id: 'industrialDiamond', name: 'Tôle Striée', color: '#94a3b8', roughness: 0.35, metalness: 0.8, texture: 'strié' },
  ];

  // Drag start handler for 3D Viewport drop
  const handleDragStartPrimitive = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'primitive', subType: type }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartMaterial = (e: React.DragEvent, presetId: string) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'material', presetId }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // GLTF/GLB File upload handler
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      await processUploadedFile(file);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processUploadedFile(files[0]);
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processUploadedFile = async (file: File) => {
    const isGLTF = file.name.toLowerCase().endsWith('.gltf') || file.name.toLowerCase().endsWith('.glb');
    const isJSON = file.name.toLowerCase().endsWith('.json');

    if (isJSON) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        onImportSceneJSON(parsed);
        setImportStatus({
          loading: false,
          success: `Scène restaurée depuis "${file.name}"`,
        });
      } catch {
        setImportStatus({
          loading: false,
          error: 'Fichier JSON de scène invalide ou corrompu.',
        });
      }
      return;
    }

    if (!isGLTF) {
      setImportStatus({
        loading: false,
        error: 'Format non supporté. Veuillez déposer un fichier .gltf ou .glb.',
      });
      return;
    }

    setImportStatus({ loading: true, error: undefined, success: undefined });

    try {
      await onImportGLTF(file);
      setImportStatus({
        loading: false,
        success: `Modèle 3D "${file.name}" importé et centré avec succès.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setImportStatus({
        loading: false,
        error: `Erreur d'importation : ${msg}`,
      });
    }
  };

  const handleJSONFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      try {
        const text = await files[0].text();
        const data = JSON.parse(text);
        onImportSceneJSON(data);
      } catch {
        alert('Erreur lors de la lecture du fichier JSON');
      }
    }
    if (jsonInputRef.current) jsonInputRef.current.value = '';
  };

  return (
    <div
      id="asset-manager-shelf"
      className={`w-full bg-zinc-950/95 border-t border-zinc-800/80 backdrop-blur-xl transition-all duration-300 ease-in-out select-none z-20 flex flex-col ${
        isOpen ? 'h-56' : 'h-10'
      }`}
    >
      {/* Shelf Header bar */}
      <div className="h-10 px-4 flex items-center justify-between border-b border-zinc-800/60 text-xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex items-center gap-1.5 font-semibold text-zinc-200 hover:text-white transition-colors"
          >
            <FolderOpen className="w-4 h-4 text-sky-400" />
            <span>Asset Manager & Bibliothèque</span>
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-zinc-400" /> : <ChevronUp className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {isOpen && (
            <div className="flex items-center gap-1 ml-4 p-0.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <button
                type="button"
                onClick={() => setActiveTab('primitives')}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'primitives'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Primitives & Lumières
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('materials')}
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'materials'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Matériaux PBR
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('models')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'models'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <UploadCloud className="w-3 h-3" />
                <span>Import GLTF / GLB</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('scene')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'scene'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <FileCode className="w-3 h-3" />
                <span>Scène (JSON)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('prefabs')}
                className={`flex items-center gap-1 px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
                  activeTab === 'prefabs'
                    ? 'bg-amber-500 text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                <span>Préfabriqués ({prefabs.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Info badge */}
        <div className="flex items-center gap-3 text-[11px] text-zinc-400">
          <span className="hidden sm:inline">
            Glissez un asset directement dans le Viewport 3D
          </span>
          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            title={isOpen ? 'Réduire' : 'Agrandir'}
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Shelf Body when open */}
      {isOpen && (
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-3 bg-zinc-950/60">
          {/* TAB 1: Primitives & Lights */}
          {activeTab === 'primitives' && (
            <div className="flex items-center gap-2.5 h-full">
              {primitives.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={(e) => handleDragStartPrimitive(e, item.type)}
                    onClick={() => onAddPrimitive(item.type)}
                    className="flex-shrink-0 w-28 h-36 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-sky-500/60 p-3 flex flex-col items-center justify-between cursor-grab active:cursor-grabbing transition-all hover:scale-102 hover:shadow-lg group text-center"
                    title={`Glisser ou cliquer pour ajouter ${item.label}`}
                  >
                    <div className="w-12 h-12 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center group-hover:border-sky-500/40 group-hover:bg-sky-500/10 transition-colors">
                      <Icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[90px]">
                        {item.desc}
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-sky-400/80 bg-sky-500/10 px-1.5 py-0.5 rounded">
                      + Glisser
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: PBR Materials Presets */}
          {activeTab === 'materials' && (
            <div className="flex items-center gap-2.5 h-full">
              {materialPresets.map((mat) => (
                <div
                  key={mat.id}
                  draggable
                  onDragStart={(e) => handleDragStartMaterial(e, mat.id)}
                  onClick={() => onApplyMaterialPreset(mat.id)}
                  className="flex-shrink-0 w-32 h-36 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-rose-500/60 p-3 flex flex-col items-center justify-between cursor-pointer transition-all hover:scale-102 hover:shadow-lg group text-center"
                  title={
                    hasSelectedNode
                      ? `Appliquer ${mat.name} à l'objet sélectionné`
                      : 'Sélectionnez un objet ou glissez sur le modèle 3D'
                  }
                >
                  <div
                    className="w-12 h-12 rounded-2xl border-2 border-zinc-700 shadow-md relative overflow-hidden group-hover:scale-105 transition-transform"
                    style={{ backgroundColor: mat.color }}
                  >
                    {mat.glow && (
                      <span className="absolute inset-0 bg-white/20 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                      {mat.name}
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      R: {mat.roughness} | M: {mat.metalness}
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">
                    Appliquer
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: GLTF/GLB Drag & Drop Importer */}
          {activeTab === 'models' && (
            <div className="flex items-center gap-4 h-full">
              {/* Drop Box */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(true);
                }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 h-36 rounded-2xl border-2 border-dashed p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${
                  isDraggingFile
                    ? 'border-sky-400 bg-sky-500/15'
                    : 'border-zinc-700 hover:border-sky-500/60 bg-zinc-900/50 hover:bg-zinc-900'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".gltf,.glb"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-center text-sky-400 mb-2">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs font-semibold text-zinc-200">
                  Déposez un fichier 3D <span className="text-sky-400 font-mono">.gltf</span> ou{' '}
                  <span className="text-sky-400 font-mono">.glb</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5 text-center">
                  Décompression DRACO automatique, recalcul des normales, centrage au sol et activation des ombres.
                </div>
              </div>

              {/* Status & Feedback box */}
              <div className="w-80 h-36 rounded-2xl bg-zinc-900/80 border border-zinc-800 p-3.5 flex flex-col justify-between text-xs">
                <div className="flex items-center gap-2 font-semibold text-zinc-300">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Pipeline d&apos;importation 3D</span>
                </div>

                {importStatus.loading ? (
                  <div className="flex items-center gap-2 text-sky-400 font-mono">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Décodage DRACO & Analyse des géométries...</span>
                  </div>
                ) : importStatus.success ? (
                  <div className="flex items-start gap-2 text-emerald-400 text-[11px]">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{importStatus.success}</span>
                  </div>
                ) : importStatus.error ? (
                  <div className="flex items-start gap-2 text-rose-400 text-[11px]">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{importStatus.error}</span>
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-400 leading-relaxed">
                    Prêt pour l&apos;analyse. Le moteur Three.js réajustera le pivot au centre, recalcule le bounding box et élève le modèle sur le plancher Y=0.
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
                  <span>Three.js GLTFLoader v0.186</span>
                  <span className="text-sky-400 font-mono">DRACO v1.5.7</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Scene JSON Export & Import */}
          {activeTab === 'scene' && (
            <div className="flex items-center gap-4 h-full">
              {/* Export Scene Button Card */}
              <div
                onClick={onExportScene}
                className="w-56 h-36 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-emerald-500/60 p-3.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-102 hover:shadow-lg group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Download className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                    .JSON
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Exporter la Scène
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-snug">
                    Télécharge un JSON contenant tous les nœuds, transforms, matériaux PBR et lumières.
                  </div>
                </div>
              </div>

              {/* Import Scene Button Card */}
              <div
                onClick={() => jsonInputRef.current?.click()}
                className="w-56 h-36 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-sky-500/60 p-3.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-102 hover:shadow-lg group"
              >
                <input
                  ref={jsonInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleJSONFileSelect}
                  className="hidden"
                />
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                    Recharger
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Importer une Scène
                  </div>
                  <div className="text-[10px] text-zinc-500 leading-snug">
                    Reconstitue l&apos;environnement complet à partir d&apos;un fichier JSON Aether.
                  </div>
                </div>
              </div>

              {/* Clear Scene Button Card */}
              <div
                onClick={onClearScene}
                className="w-48 h-36 rounded-2xl bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 hover:border-rose-500/60 p-3.5 flex flex-col justify-between cursor-pointer transition-all hover:scale-102 group"
              >
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <RefreshCw className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">
                    Nouvelle Scène
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Effacer tous les objets utilisateur
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Prefabricated Library */}
          {activeTab === 'prefabs' && (
            <div className="flex flex-col gap-2 h-full overflow-y-auto pr-2">
              {prefabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-4">
                  <Sparkles className="w-8 h-8 text-zinc-700 mb-2" />
                  <p className="text-xs">Aucun préfabriqué sauvegardé pour le moment.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    Sélectionnez un ou plusieurs objets 3D et cliquez sur <span className="text-amber-400 font-semibold">★ Sauvegarder</span> dans l&apos;inspecteur !
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 py-1">
                  {prefabs.map((prefab) => (
                    <div
                      key={prefab.id}
                      className="group relative flex flex-col justify-between p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-amber-500/40 cursor-pointer transition-all hover:bg-zinc-800/50"
                      onClick={() => onAddPrefab?.(prefab.nodes)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <Sparkles className="w-3.5 h-3.5" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Supprimer le préfabriqué "${prefab.name}" ?`)) {
                              onDeletePrefab?.(prefab.id);
                            }
                          }}
                          className="p-1 rounded text-zinc-600 hover:text-rose-400 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100"
                          title="Supprimer le préfabriqué"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="mt-2 text-left">
                        <div className="text-[11px] font-semibold text-zinc-200 truncate group-hover:text-white" title={prefab.name}>
                          {prefab.name}
                        </div>
                        <div className="text-[9px] text-zinc-500">
                          {prefab.nodes.length} objet(s)
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
