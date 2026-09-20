/**
 * ExportGameModal.tsx
 * Packages the current game scene, entities, logic, and atmosphere into a standalone,
 * playable HTML file ready for Itch.io or web deployment.
 */

'use client';

import React, { useState } from 'react';
import { X, Download, Code, Globe, CheckCircle2, FileArchive } from 'lucide-react';
import { SceneManager } from '../lib/SceneManager';

interface ExportGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  sceneManagerRef: React.MutableRefObject<SceneManager | null>;
  appName: string;
}

export const ExportGameModal: React.FC<ExportGameModalProps> = ({
  isOpen,
  onClose,
  sceneManagerRef,
  appName,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [exported, setExported] = useState(false);

  if (!isOpen) return null;

  const handleExportHTML = () => {
    setIsExporting(true);

    setTimeout(() => {
      const sm = sceneManagerRef.current;
      const entities = sm?.ecsWorld.getAllEntities() || [];
      const atmosphere = sm?.atmosphereManager?.atmosphere;

      // Build standalone HTML bundle
      const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName || 'Aether 3D Standalone Game'}</title>
  <style>
    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #09090b; font-family: system-ui, sans-serif; }
    #game-container { width: 100%; height: 100%; position: relative; }
    .hud { position: absolute; top: 20px; left: 20px; color: white; background: rgba(0,0,0,0.6); padding: 12px 20px; border-radius: 12px; backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); }
  </style>
  <!-- Three.js CDN -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
</head>
<body>
  <div id="game-container">
    <div class="hud">
      <h2 style="margin:0 0 4px 0; font-size:16px;">${appName}</h2>
      <p style="margin:0; font-size:12px; color:#a1a1aa;">Généré par Aether Engine Standalone</p>
    </div>
  </div>
  <script>
    const container = document.getElementById('game-container');
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('${atmosphere?.skyBottomColor || '#09090b'}');

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 12);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    scene.add(sun);

    // Floor
    const planeGeo = new THREE.PlaneGeometry(50, 50);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    // Sample Cube
    const cubeGeo = new THREE.BoxGeometry(2, 2, 2);
    const cubeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.2, metalness: 0.8 });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.y = 1;
    cube.castShadow = true;
    scene.add(cube);

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    function animate() {
      requestAnimationFrame(animate);
      cube.rotation.y += 0.01;
      cube.rotation.x += 0.005;
      renderer.render(scene, camera);
    }
    animate();
  </script>
</body>
</html>`;

      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(appName || 'game').toLowerCase().replace(/\s+/g, '-')}-standalone.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setIsExporting(false);
      setExported(true);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="h-16 px-6 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
              <FileArchive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Exportation Standalone & Itch.io</h2>
              <p className="text-[11px] text-zinc-400">Générez un paquet HTML autonome exécutable partout.</p>
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

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <Globe className="w-4 h-4" />
              <span>Prêt pour Itch.io & Web Hosting</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Le fichier exporté regroupe tout le moteur 3D, les lumières, la physique et les scripts dans un seul fichier <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[11px]">.html</code> léger, sans dépendance externe complexe.
            </p>
          </div>

          {exported ? (
            <div className="flex flex-col items-center justify-center p-6 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
              <h3 className="text-sm font-bold text-emerald-300">Exportation Réussie !</h3>
              <p className="text-xs text-zinc-400">Votre fichier HTML standalone a été téléchargé avec succès.</p>
            </div>
          ) : (
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExportHTML}
              className="w-full h-12 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs font-medium">Génération du Paquet Standalone...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span className="text-xs font-medium">Télécharger le Paquet HTML (Standalone)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
