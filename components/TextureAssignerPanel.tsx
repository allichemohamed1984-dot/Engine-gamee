/**
 * TextureAssignerPanel.tsx
 * Dedicated panel for assigning PBR textures, procedural patterns, tiling scale, and custom image maps to selected objects.
 */

'use client';

import React, { useState } from 'react';
import { SceneNode, TexturePreset } from '../types/engine';
import { X, Image as ImageIcon, Grid, Sparkles, Sliders, Check, Layers, Upload } from 'lucide-react';

interface TextureAssignerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNode: SceneNode | null;
  onUpdateMaterial: (id: string, materialData: any) => void;
}

const TEXTURE_PRESETS: Array<{ id: TexturePreset; name: string; category: string; previewColor: string; description: string }> = [
  { id: 'none', name: 'Aucune (Lisse pur)', category: 'Basique', previewColor: '#71717a', description: 'Matériau standard sans texture de relief.' },
  { id: 'carbon', name: 'Fibre de Carbone', category: 'Industriel', previewColor: '#18181b', description: 'Trame tissée high-tech pour véhicules et coques.' },
  { id: 'brushed', name: 'Métal Brossé', category: 'Métal', previewColor: '#a1a1aa', description: 'Stries métalliques directionnelles polies.' },
  { id: 'grid', name: 'Grille Cyber / Carrelage', category: 'Architecture', previewColor: '#0ea5e9', description: 'Lignes géométriques et dalles lumineuses.' },
  { id: 'pebbles', name: 'Galets & Roches', category: 'Nature', previewColor: '#78716c', description: 'Reliefs organiques et minéraux rugueux.' },
  { id: 'diamond', name: 'Tôle Striée (Diamond)', category: 'Industriel', previewColor: '#f59e0b', description: 'Plaque antidérapante en relief pour sols sci-fi.' },
];

const PRESET_IMAGE_URLS = [
  { name: 'Sci-Fi Metal Panel', url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=512&auto=format&fit=crop&q=80' },
  { name: 'Briques Rouges', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=512&auto=format&fit=crop&q=80' },
  { name: 'Bois Sombre Chêne', url: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?w=512&auto=format&fit=crop&q=80' },
  { name: 'Marbre Blanc Lux', url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=512&auto=format&fit=crop&q=80' },
  { name: 'Béton Brut Industriel', url: 'https://images.unsplash.com/photo-1518640467707-6811f4aefbd7?w=512&auto=format&fit=crop&q=80' },
];

export const TextureAssignerPanel: React.FC<TextureAssignerPanelProps> = ({
  isOpen,
  onClose,
  selectedNode,
  onUpdateMaterial,
}) => {
  const [customUrl, setCustomUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'presets' | 'images' | 'tiling'>('presets');

  if (!isOpen) return null;

  const mat = selectedNode?.material;

  const handleApplyPreset = (preset: TexturePreset) => {
    if (!selectedNode) return;
    onUpdateMaterial(selectedNode.id, {
      texturePreset: preset,
      hasNormalMap: preset !== 'none',
    });
  };

  const handleApplyImageMap = (url: string) => {
    if (!selectedNode) return;
    onUpdateMaterial(selectedNode.id, {
      mapUrl: url,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="h-16 px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Gestionnaire & Assignation de Textures</h2>
              <p className="text-[11px] text-zinc-400">
                {selectedNode ? `Objet actif : ${selectedNode.name}` : 'Aucun objet sélectionné'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-2xl hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-3 gap-2 px-6 pt-4 pb-2 bg-zinc-950 border-b border-zinc-800/60">
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'presets'
                ? 'bg-sky-500/15 border border-sky-500/40 text-sky-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Reliefs & Presets</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'images'
                ? 'bg-sky-500/15 border border-sky-500/40 text-sky-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Textures Albedo HD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tiling')}
            className={`py-2 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'tiling'
                ? 'bg-sky-500/15 border border-sky-500/40 text-sky-300 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Répétition UV / Tiling</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!selectedNode ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-600">
                <Layers className="w-6 h-6" />
              </div>
              <p className="text-xs text-zinc-400">Veuillez sélectionner un objet 3D dans le viewport pour lui assigner des textures.</p>
            </div>
          ) : (
            <>
              {activeTab === 'presets' && (
                <div className="grid grid-cols-2 gap-3">
                  {TEXTURE_PRESETS.map((p) => {
                    const isSelected = mat?.texturePreset === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleApplyPreset(p.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 group relative overflow-hidden ${
                          isSelected
                            ? 'bg-sky-500/10 border-sky-500/60 shadow-lg shadow-sky-500/10'
                            : 'bg-zinc-900/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-xl border border-white/20 shadow-inner flex items-center justify-center font-bold text-[10px] text-white"
                              style={{ backgroundColor: p.previewColor }}
                            >
                              {p.name.charAt(0)}
                            </div>
                            <div>
                              <span className="text-xs font-bold text-zinc-200 block">{p.name}</span>
                              <span className="text-[10px] text-zinc-500">{p.category}</span>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center shadow">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">{p.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === 'images' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-zinc-300">Bibliothèque de textures HD prêtes à l&apos;emploi</span>
                    <div className="grid grid-cols-1 gap-2.5">
                      {PRESET_IMAGE_URLS.map((img, idx) => {
                        const isSelected = mat?.mapUrl === img.url;
                        return (
                          <div
                            key={idx}
                            onClick={() => handleApplyImageMap(img.url)}
                            className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500/60'
                                : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={img.url}
                                alt={img.name}
                                className="w-12 h-12 rounded-xl object-cover border border-zinc-700"
                                referrerPolicy="no-referrer"
                              />
                              <div>
                                <h4 className="text-xs font-semibold text-white">{img.name}</h4>
                                <span className="text-[10px] text-zinc-400 truncate max-w-[260px] block">{img.url}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="px-2.5 py-1 rounded-xl bg-sky-500/20 border border-sky-500/40 text-[10px] text-sky-300 font-medium">
                                Actif
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom URL Input */}
                  <div className="space-y-2 pt-3 border-t border-zinc-800/60">
                    <span className="text-xs font-semibold text-zinc-300">URL d&apos;image personnalisée</span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="https://example.com/texture.jpg"
                        value={customUrl}
                        onChange={(e) => setCustomUrl(e.target.value)}
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-sky-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customUrl) handleApplyImageMap(customUrl);
                        }}
                        className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs rounded-xl transition-all shadow-md shadow-sky-500/20"
                      >
                        Appliquer
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tiling' && (
                <div className="space-y-6 py-2">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 font-medium">Répétition Horizontale (Repeat U)</span>
                      <span className="font-mono text-sky-400">{(mat?.repeatU ?? 1).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={mat?.repeatU ?? 1}
                      onChange={(e) =>
                        onUpdateMaterial(selectedNode.id, { repeatU: parseFloat(e.target.value) })
                      }
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-300 font-medium">Répétition Verticale (Repeat V)</span>
                      <span className="font-mono text-sky-400">{(mat?.repeatV ?? 1).toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10"
                      step="0.5"
                      value={mat?.repeatV ?? 1}
                      onChange={(e) =>
                        onUpdateMaterial(selectedNode.id, { repeatV: parseFloat(e.target.value) })
                      }
                      className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
                    <span className="text-xs font-semibold text-zinc-300">Conseil d&apos;utilisation</span>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      Ajustez le tiling pour répéter les motifs de briques, de bois ou de plaques métalliques sur les grands murs et sols sans effet de flou.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
