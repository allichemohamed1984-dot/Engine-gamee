'use client';

import React, { useState } from 'react';
import { SceneExportData } from '../types/engine';
import { WebGameExporter, GameExportOptions } from '../lib/export/WebGameExporter';
import {
  X,
  Download,
  Share2,
  FileCode,
  Check,
  Globe,
  Sparkles,
  Layers,
  Volume2,
  Tv,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneData: SceneExportData;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, sceneData }) => {
  const [options, setOptions] = useState<GameExportOptions>({
    title: sceneData.projectName || 'Aether 3D Island Adventure',
    author: 'Aether Creator',
    description: 'Jeu 3D interactif généré avec Aether 3D Engine.',
    includeTerrain: true,
    includeHUD: true,
    includeAtmosphere: true,
    includeSound: true,
  });

  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const generatedHtml = WebGameExporter.generateStandaloneHTML(sceneData, options);
  const fileSizeKb = Math.round(new Blob([generatedHtml]).size / 1024);

  const handleDownload = () => {
    setDownloading(true);
    const filename = `${options.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'game'}.html`;
    WebGameExporter.downloadHTML(generatedHtml, filename);
    setTimeout(() => {
      setDownloading(false);
    }, 600);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadJSON = () => {
    const jsonStr = JSON.stringify(sceneData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${options.title.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'scene'}.aether.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-16 px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shadow-md">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Exportateur de Jeu Web Autonome
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-mono border border-emerald-500/30">
                  One-Click Standalone
                </span>
              </h2>
              <p className="text-[11px] text-zinc-400">
                Générez un fichier HTML autonome intégrant Three.js, terrain, HUD et logique de jeu.
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

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Game Title & Metadata */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Titre du Jeu</label>
              <input
                type="text"
                value={options.title}
                onChange={(e) => setOptions({ ...options, title: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white focus:outline-none focus:border-sky-500 font-medium"
                placeholder="Mon Super Jeu 3D"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400">Créateur / Auteur</label>
                <input
                  type="text"
                  value={options.author}
                  onChange={(e) => setOptions({ ...options, author: e.target.value })}
                  className="w-full px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400">Poids estimé du build</label>
                <div className="px-3 py-1.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs text-sky-400 font-mono flex items-center justify-between">
                  <span>~{fileSizeKb} Ko</span>
                  <span className="text-[10px] text-zinc-500">Zéro dépendance locale</span>
                </div>
              </div>
            </div>
          </div>

          {/* Module Inclusions */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-300">Composants à embarquer</label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeTerrain}
                  onChange={(e) => setOptions({ ...options, includeTerrain: e.target.checked })}
                  className="rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 border-zinc-700"
                />
                <Layers className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-zinc-200">Terrain & Sculpting</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeHUD}
                  onChange={(e) => setOptions({ ...options, includeHUD: e.target.checked })}
                  className="rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 border-zinc-700"
                />
                <Tv className="w-4 h-4 text-sky-400" />
                <span className="text-xs text-zinc-200">HUD 2D & Overlay</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeAtmosphere}
                  onChange={(e) => setOptions({ ...options, includeAtmosphere: e.target.checked })}
                  className="rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 border-zinc-700"
                />
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-zinc-200">Atmosphère & SkyDome</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 cursor-pointer hover:bg-zinc-800/50 transition-colors">
                <input
                  type="checkbox"
                  checked={options.includeSound}
                  onChange={(e) => setOptions({ ...options, includeSound: e.target.checked })}
                  className="rounded text-sky-500 focus:ring-0 focus:ring-offset-0 bg-zinc-950 border-zinc-700"
                />
                <Volume2 className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-zinc-200">Synthétiseur Audio Web</span>
              </label>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3.5 rounded-2xl bg-sky-950/30 border border-sky-500/20 flex items-start gap-3">
            <Share2 className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <p className="text-xs text-sky-200 leading-relaxed">
              Le fichier généré est un fichier standard <code className="text-sky-300 font-mono bg-sky-950/80 px-1 py-0.5 rounded">.html</code>.
              Vous pouvez double-cliquer dessus pour y jouer directement hors-ligne ou l’héberger sur GitHub Pages, Netlify, Itch.io ou Vercel.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="h-20 px-6 border-t border-zinc-800/80 bg-zinc-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleDownloadJSON}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono transition-colors"
          >
            <FileCode className="w-4 h-4" />
            <span>Export JSON (.aether)</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCopyCode}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <FileCode className="w-4 h-4" />}
              <span>{copied ? 'Code Copié !' : 'Copier HTML'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white text-xs font-semibold shadow-lg shadow-sky-500/25 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Téléchargement...' : 'Télécharger index.html'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
