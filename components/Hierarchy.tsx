'use client';

import React, { useState } from 'react';
import { SceneNode } from '../types/engine';
import {
  Layers,
  Box,
  Circle,
  Cylinder,
  Disc,
  LifeBuoy,
  Triangle,
  Lightbulb,
  Sun,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Search,
  Check,
  Edit2,
  ChevronDown,
  Car,
  Waves,
} from 'lucide-react';

interface HierarchyProps {
  nodes: SceneNode[];
  selectedNode: SceneNode | null;
  selectedIds?: string[];
  onSelectNode: (id: string) => void;
  onToggleVisibility: (id: string, currentVisible: boolean) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onRenameNode: (id: string, newName: string) => void;
  onAddPrimitive: (
    type: 'cube' | 'sphere' | 'cylinder' | 'plane' | 'torus' | 'cone' | 'pointLight' | 'vehicle'
  ) => void;
  workflowMode?: 'decor' | 'character' | 'rules' | 'test';
}

export const Hierarchy: React.FC<HierarchyProps> = ({
  nodes,
  selectedNode,
  selectedIds = [],
  onSelectNode,
  onToggleVisibility,
  onDeleteNode,
  onDuplicateNode,
  onRenameNode,
  onAddPrimitive,
  workflowMode = 'decor',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);

  const filteredNodes = nodes.filter((n) =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getNodeIcon = (node: SceneNode) => {
    if (node.type === 'light') {
      if (node.subType === 'directional') return <Sun className="w-3.5 h-3.5 text-amber-400" />;
      return <Lightbulb className="w-3.5 h-3.5 text-amber-300" />;
    }

    switch (node.subType) {
      case 'cube':
        return <Box className="w-3.5 h-3.5 text-sky-400" />;
      case 'sphere':
        return <Circle className="w-3.5 h-3.5 text-rose-400" />;
      case 'cylinder':
        return <Cylinder className="w-3.5 h-3.5 text-emerald-400" />;
      case 'torus':
        return <LifeBuoy className="w-3.5 h-3.5 text-amber-400" />;
      case 'cone':
        return <Triangle className="w-3.5 h-3.5 text-purple-400" />;
      case 'plane':
        return <Disc className="w-3.5 h-3.5 text-zinc-400" />;
      case 'water':
        return <Waves className="w-3.5 h-3.5 text-cyan-400" />;
      default:
        return <Box className="w-3.5 h-3.5 text-sky-400" />;
    }
  };

  const startRename = (node: SceneNode, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(node.id);
    setEditName(node.name);
  };

  const submitRename = (id: string) => {
    if (editName.trim()) {
      onRenameNode(id, editName.trim());
    }
    setEditingId(null);
  };

  return (
    <div
      id="hierarchy-panel"
      className="w-72 h-full flex flex-col bg-zinc-950/95 border-r border-zinc-800/80 select-none z-20"
    >
      {/* Hierarchy Header */}
      <div className="p-3 border-b border-zinc-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
            Scene Hierarchy
          </h2>
          <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-[10px] font-mono text-zinc-400">
            {nodes.length}
          </span>
        </div>

        {/* Add Entity Dropdown */}
        <div className="relative">
          <button
            id="btn-hierarchy-add-entity"
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-xs font-medium transition-all"
            title="Ajouter une entité à la scène"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter</span>
            <ChevronDown className="w-3 h-3" />
          </button>

          {showAddMenu && (
            <div
              id="hierarchy-add-dropdown"
              className="absolute right-0 top-full mt-1.5 w-44 p-1.5 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-2xl z-50 text-xs space-y-0.5"
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
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Box className="w-3.5 h-3.5 text-sky-400" />
                <span>Cube</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('sphere');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Circle className="w-3.5 h-3.5 text-rose-400" />
                <span>Sphère</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('cylinder');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
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
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <LifeBuoy className="w-3.5 h-3.5 text-amber-400" />
                <span>Tore / Anneau</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('cone');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Triangle className="w-3.5 h-3.5 text-purple-400" />
                <span>Cône</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('plane');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Disc className="w-3.5 h-3.5 text-zinc-400" />
                <span>Plan / Sol</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('vehicle');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-sky-500/10 text-sky-300 hover:text-sky-200 transition-colors text-left font-medium border border-sky-500/20"
              >
                <Car className="w-3.5 h-3.5 text-sky-400" />
                <span>Véhicule 3D (Voiture)</span>
              </button>
              <div className="my-1 border-t border-zinc-800" />
              <div className="px-2 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Éclairage
              </div>
              <button
                type="button"
                onClick={() => {
                  onAddPrimitive('pointLight');
                  setShowAddMenu(false);
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors text-left"
              >
                <Lightbulb className="w-3.5 h-3.5 text-amber-300" />
                <span>Point Light</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-zinc-800/80">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 pointer-events-none" />
          <input
            id="hierarchy-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filtrer les objets..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-900/80 border border-zinc-800/80 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-sky-500/60 transition-colors"
          />
        </div>
      </div>

      {/* Scene Tree List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            {searchQuery ? 'Aucun objet correspondant' : 'Scène vide'}
          </div>
        ) : (
          filteredNodes.map((node) => {
            const isSelected = selectedIds.length > 0 ? selectedIds.includes(node.id) : selectedNode?.id === node.id;

            return (
              <div
                key={node.id}
                id={`hierarchy-item-${node.id}`}
                onClick={() => onSelectNode(node.id)}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-sky-500/15 border border-sky-500/40 text-white font-medium shadow-sm'
                    : 'hover:bg-zinc-900/80 border border-transparent text-zinc-300'
                } ${!node.visible ? 'opacity-40' : 'opacity-100'}`}
              >
                {/* Node Identity & Name */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="shrink-0">{getNodeIcon(node)}</div>

                  {editingId === node.id ? (
                    <div
                      className="flex items-center gap-1 flex-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') submitRename(node.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                        className="w-full px-1.5 py-0.5 bg-zinc-900 border border-sky-500 rounded text-xs text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitRename(node.id)}
                        className="p-1 hover:text-emerald-400 text-zinc-400"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <span
                      onDoubleClick={(e) => startRename(node, e)}
                      className="truncate text-xs font-normal"
                      title={node.name}
                    >
                      {node.name}
                    </span>
                  )}
                </div>

                {/* Node Quick Action Buttons */}
                <div
                  className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleVisibility(node.id, node.visible);
                    }}
                    className={`p-1 rounded hover:bg-zinc-800 transition-colors ${
                      node.visible ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600'
                    }`}
                    title={node.visible ? 'Masquer' : 'Afficher'}
                  >
                    {node.visible ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateNode(node.id);
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                    title="Dupliquer"
                  >
                    <Copy className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-2.5 border-t border-zinc-800/80 text-[11px] text-zinc-500 flex justify-between items-center bg-zinc-950/60">
        <span>Arborescence dynamique</span>
        <span className="text-[10px] text-zinc-600 font-mono">Three.js Graph</span>
      </div>
    </div>
  );
};
