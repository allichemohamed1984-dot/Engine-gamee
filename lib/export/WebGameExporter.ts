import { SceneExportData } from '../../types/engine';
import { AtmosphereData } from '../../types/atmosphere';
import { TerrainConfig, FoliageLayer } from '../../types/terrain';
import { HUDConfig } from '../../types/hud';

export interface GameExportOptions {
  title: string;
  author?: string;
  description?: string;
  includeTerrain: boolean;
  includeHUD: boolean;
  includeAtmosphere: boolean;
  includeSound: boolean;
}

export class WebGameExporter {
  public static generateStandaloneHTML(
    sceneData: SceneExportData,
    options: GameExportOptions
  ): string {
    const title = options.title || 'Aether 3D Web Game';
    const jsonProjectString = JSON.stringify(sceneData).replace(/<\/script>/g, '<\\/script>');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>${title} - Propulsé par Aether 3D Engine</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
      -webkit-user-select: none;
    }
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0c0e14;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #game-container {
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
      touch-action: none;
    }
    /* HUD 2D In-Game Overlay */
    #hud-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }
    .hud-card {
      position: absolute;
      background: rgba(12, 14, 20, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 8px 16px;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      font-size: 13px;
    }
    .hp-bar-bg {
      width: 160px;
      height: 10px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 999px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .hp-bar-fill {
      height: 100%;
      background: #ef4444;
      width: 100%;
      transition: width 0.3s ease;
      border-radius: 999px;
    }
    /* Controls hint */
    #controls-badge {
      position: absolute;
      bottom: 20px;
      left: 20px;
      background: rgba(12, 14, 20, 0.7);
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 8px 14px;
      border-radius: 12px;
      color: #94a3b8;
      font-size: 11px;
      font-family: monospace;
      z-index: 10;
      pointer-events: none;
    }
    /* Crosshair */
    #crosshair {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 6px;
      height: 6px;
      background: #ffffff;
      border-radius: 50%;
      box-shadow: 0 0 8px rgba(255, 255, 255, 0.8);
      pointer-events: none;
      z-index: 10;
    }
    /* Pause / Start Screen */
    #pause-screen {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .dialog-box {
      background: #0f172a;
      border: 1px solid #334155;
      padding: 32px;
      border-radius: 24px;
      text-align: center;
      max-width: 380px;
      color: #ffffff;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
    }
    .btn-action {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 12px 24px;
      border-radius: 14px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      margin-top: 20px;
      width: 100%;
      transition: background 0.2s;
    }
    .btn-action:hover {
      background: #0369a1;
    }
  </style>
</head>
<body>
  <div id="game-container"></div>

  <!-- HUD Overlay -->
  <div id="hud-overlay">
    <div id="hud-hp-card" class="hud-card" style="top: 20px; left: 20px;">
      <span style="color: #ef4444; font-weight: bold;">❤</span>
      <div class="hp-bar-bg">
        <div id="hud-hp-fill" class="hp-bar-fill"></div>
      </div>
      <span id="hud-hp-val" style="font-family: monospace; font-size: 11px;">100/100</span>
    </div>

    <div id="hud-score-card" class="hud-card" style="top: 20px; right: 20px; border-color: rgba(56, 189, 248, 0.4);">
      <span style="color: #38bdf8; font-weight: bold;">★</span>
      <span>SCORE:</span>
      <span id="hud-score-val" style="font-family: monospace; font-weight: bold; color: #38bdf8; font-size: 15px;">0</span>
    </div>

    <div id="hud-coin-card" class="hud-card" style="top: 65px; right: 20px; border-color: rgba(234, 179, 8, 0.4);">
      <span style="color: #eab308; font-weight: bold;">🪙</span>
      <span id="hud-coin-val" style="font-family: monospace; font-weight: bold; color: #fde047; font-size: 14px;">0</span>
    </div>

    <div id="crosshair"></div>
  </div>

  <div id="controls-badge">
    [ZQSD / WASD] Déplacement | [Espace] Saut | [Clic & Glisser] Caméra | [Échap] Pause
  </div>

  <!-- Pause Screen -->
  <div id="pause-screen">
    <div class="dialog-box">
      <h2 style="font-size: 20px; margin-bottom: 8px;">Jeu en Pause</h2>
      <p style="font-size: 12px; color: #94a3b8;">Appuyez sur Reprendre ou Échap pour continuer votre partie.</p>
      <button id="btn-resume" class="btn-action">Reprendre la partie</button>
    </div>
  </div>

  <!-- Game Project Data JSON -->
  <script id="aether-project-data" type="application/json">
    ${jsonProjectString}
  </script>

  <!-- Standalone WebGL Runtime using Three.js ES Modules -->
  <script type="module">
    import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

    // 1. Web Audio Procedural Sound Synthesizer
    class SoundSynth {
      static ctx = null;
      static getContext() {
        if (!SoundSynth.ctx) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          SoundSynth.ctx = new AudioContext();
        }
        if (SoundSynth.ctx.state === 'suspended') {
          SoundSynth.ctx.resume();
        }
        return SoundSynth.ctx;
      }

      static play(preset) {
        try {
          const ctx = SoundSynth.getContext();
          const now = ctx.currentTime;

          if (preset === 'coin') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(987.77, now);
            osc.frequency.setValueAtTime(1318.51, now + 0.08);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
          } else if (preset === 'jump') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(450, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.2);
          } else if (preset === 'damage') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.linearRampToValueAtTime(40, now + 0.25);
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.25);
          }
        } catch (e) {
          console.warn('Audio play error:', e);
        }
      }
    }

    // 2. Parse Project Data
    const projectData = JSON.parse(document.getElementById('aether-project-data').textContent);
    const container = document.getElementById('game-container');

    // 3. Three.js Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(projectData.atmosphere?.fog?.color || '#0c0e14');
    if (projectData.atmosphere?.fog?.enabled) {
      scene.fog = new THREE.FogExp2(projectData.atmosphere.fog.color || '#0c0e14', projectData.atmosphere.fog.density || 0.015);
    }

    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 4, 8);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 4. Lights & Atmosphere
    const ambient = new THREE.AmbientLight(
      projectData.atmosphere?.ambientColor || '#ffffff',
      projectData.atmosphere?.ambientIntensity || 0.75
    );
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(
      projectData.atmosphere?.sunColor || '#fff8eb',
      projectData.atmosphere?.sunIntensity || 2.2
    );
    sun.position.set(12, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -30;
    sun.shadow.camera.right = 30;
    sun.shadow.camera.top = 30;
    sun.shadow.camera.bottom = -30;
    sun.shadow.bias = -0.0005;
    scene.add(sun);

    // 5. Sky Dome
    const skyGeo = new THREE.SphereGeometry(400, 32, 24);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(projectData.atmosphere?.skyTopColor || '#0284c7') },
        bottomColor: { value: new THREE.Color(projectData.atmosphere?.skyBottomColor || '#38bdf8') },
      },
      vertexShader: \`
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      \`,
      fragmentShader: \`
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(0.0, h)), 1.0);
        }
      \`
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // 6. Procedural Terrain Generation
    let terrainMesh = null;
    let terrainHeights = projectData.terrain?.heightmap || null;
    const terrainSize = projectData.terrain?.config?.size || 60;
    const terrainRes = projectData.terrain?.config?.resolution || 64;

    if (projectData.terrain?.config?.enabled !== false) {
      const tGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainRes, terrainRes);
      tGeo.rotateX(-Math.PI / 2);
      const pos = tGeo.attributes.position;
      const col = new Float32Array(pos.count * 3);

      const grass = new THREE.Color(projectData.terrain?.config?.colors?.grass || '#3d7a36');
      const rock = new THREE.Color(projectData.terrain?.config?.colors?.rock || '#52525b');
      const sand = new THREE.Color(projectData.terrain?.config?.colors?.sand || '#d4b483');

      for (let i = 0; i < pos.count; i++) {
        let h = 0;
        if (terrainHeights && terrainHeights[i] !== undefined) {
          h = terrainHeights[i];
        } else {
          const vx = pos.getX(i);
          const vz = pos.getZ(i);
          h = Math.sin(vx * 0.08) * Math.cos(vz * 0.08) * 3.5 + Math.sin(vx * 0.2) * 1.0;
        }
        pos.setY(i, h);

        const tempCol = h < 0.3 ? sand : (h > 4.5 ? rock : grass);
        col[i * 3] = tempCol.r;
        col[i * 3 + 1] = tempCol.g;
        col[i * 3 + 2] = tempCol.b;
      }

      tGeo.computeVertexNormals();
      tGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));

      const tMat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.85,
        flatShading: true,
      });

      terrainMesh = new THREE.Mesh(tGeo, tMat);
      terrainMesh.receiveShadow = true;
      scene.add(terrainMesh);
    }

    // Helper: get terrain height
    function getTerrainHeight(x, z) {
      if (!terrainMesh) return 0;
      const half = terrainSize / 2;
      const gx = Math.floor(((x + half) / terrainSize) * terrainRes);
      const gz = Math.floor(((z + half) / terrainSize) * terrainRes);
      if (gx < 0 || gx >= terrainRes || gz < 0 || gz >= terrainRes) return 0;
      const idx = gz * (terrainRes + 1) + gx;
      return terrainHeights && terrainHeights[idx] !== undefined ? terrainHeights[idx] : 0;
    }

    // 7. Reconstruct Scene Nodes
    const entities = [];
    let playerObj = null;

    (projectData.nodes || []).forEach((nodeData) => {
      let obj = null;

      if (nodeData.type === 'mesh') {
        let geo = new THREE.BoxGeometry(1, 1, 1);
        if (nodeData.subType === 'sphere') geo = new THREE.SphereGeometry(0.5, 32, 24);
        else if (nodeData.subType === 'cylinder') geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
        else if (nodeData.subType === 'torus') geo = new THREE.TorusGeometry(0.5, 0.2, 16, 32);
        else if (nodeData.subType === 'cone') geo = new THREE.ConeGeometry(0.5, 1, 24);
        else if (nodeData.subType === 'player') geo = new THREE.CapsuleGeometry(0.35, 0.9, 12, 16);

        const mat = new THREE.MeshStandardMaterial({
          color: nodeData.material?.color || '#38bdf8',
          roughness: nodeData.material?.roughness ?? 0.4,
          metalness: nodeData.material?.metalness ?? 0.1,
          emissive: nodeData.material?.emissive || '#000000',
          emissiveIntensity: nodeData.material?.emissiveIntensity || 0,
        });

        obj = new THREE.Mesh(geo, mat);
        obj.castShadow = nodeData.castShadow ?? true;
        obj.receiveShadow = nodeData.receiveShadow ?? true;

        if (nodeData.subType === 'player') {
          playerObj = obj;
        }
      } else if (nodeData.type === 'light') {
        if (nodeData.subType === 'point') {
          obj = new THREE.PointLight(nodeData.light?.color || '#ffffff', nodeData.light?.intensity || 2, 20);
        } else if (nodeData.subType === 'spot') {
          obj = new THREE.SpotLight(nodeData.light?.color || '#ffffff', nodeData.light?.intensity || 3);
        }
      }

      if (obj) {
        const t = nodeData.transform;
        obj.position.set(t.position.x, t.position.y, t.position.z);
        obj.rotation.set(
          (t.rotation.x * Math.PI) / 180,
          (t.rotation.y * Math.PI) / 180,
          (t.rotation.z * Math.PI) / 180
        );
        obj.scale.set(t.scale.x, t.scale.y, t.scale.z);
        obj.userData = {
          name: nodeData.name,
          logic: nodeData.logic,
          subType: nodeData.subType,
          initialY: t.position.y,
        };
        scene.add(obj);
        entities.push(obj);
      }
    });

    // Default Player if none found
    if (!playerObj) {
      const pGeo = new THREE.CapsuleGeometry(0.35, 0.9, 12, 16);
      const pMat = new THREE.MeshStandardMaterial({ color: '#38bdf8', roughness: 0.2 });
      playerObj = new THREE.Mesh(pGeo, pMat);
      playerObj.position.set(0, 1.5, 0);
      playerObj.castShadow = true;
      scene.add(playerObj);
      entities.push(playerObj);
    }

    // 8. Player Controller & Input
    const keys = {};
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;
      if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD' || e.code === 'Space') {
        SoundSynth.getContext();
      }
      if (e.code === 'Escape') {
        const p = document.getElementById('pause-screen');
        p.style.display = p.style.display === 'flex' ? 'none' : 'flex';
      }
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    document.getElementById('btn-resume').addEventListener('click', () => {
      document.getElementById('pause-screen').style.display = 'none';
    });

    // Mouse drag orbit/look
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraAngle = { yaw: 0, pitch: 0.35 };

    window.addEventListener('mousedown', (e) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
      SoundSynth.getContext();
    });
    window.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - prevMouse.x;
        const dy = e.clientY - prevMouse.y;
        cameraAngle.yaw -= dx * 0.005;
        cameraAngle.pitch = Math.max(0.1, Math.min(1.4, cameraAngle.pitch + dy * 0.005));
        prevMouse = { x: e.clientX, y: e.clientY };
      }
    });
    window.addEventListener('mouseup', () => { isDragging = false; });

    // 9. Game State & HUD Synchronization
    const gameState = {
      Health: 100,
      Score: 0,
      Coins: 0,
    };

    function updateHUD() {
      const hpFill = document.getElementById('hud-hp-fill');
      const hpVal = document.getElementById('hud-hp-val');
      const scoreVal = document.getElementById('hud-score-val');
      const coinVal = document.getElementById('hud-coin-val');

      if (hpFill) hpFill.style.width = Math.max(0, Math.min(100, gameState.Health)) + '%';
      if (hpVal) hpVal.textContent = Math.round(gameState.Health) + '/100';
      if (scoreVal) scoreVal.textContent = gameState.Score;
      if (coinVal) coinVal.textContent = gameState.Coins;
    }

    // 10. Main Game Loop
    let lastTime = performance.now();
    let playerVelocityY = 0;
    let isGrounded = false;

    function animate() {
      requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      // Player Movement
      const moveDir = new THREE.Vector3();
      const forward = new THREE.Vector3(-Math.sin(cameraAngle.yaw), 0, -Math.cos(cameraAngle.yaw));
      const right = new THREE.Vector3(Math.cos(cameraAngle.yaw), 0, -Math.sin(cameraAngle.yaw));

      if (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp']) moveDir.add(forward);
      if (keys['KeyS'] || keys['ArrowDown']) moveDir.sub(forward);
      if (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft']) moveDir.sub(right);
      if (keys['KeyD'] || keys['ArrowRight']) moveDir.add(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        const speed = 7.5;
        playerObj.position.x += moveDir.x * speed * dt;
        playerObj.position.z += moveDir.z * speed * dt;
        playerObj.rotation.y = Math.atan2(moveDir.x, moveDir.z);
      }

      // Jump & Gravity
      const terrainY = getTerrainHeight(playerObj.position.x, playerObj.position.z) + 0.9;
      if (playerObj.position.y <= terrainY + 0.05) {
        playerObj.position.y = terrainY;
        playerVelocityY = 0;
        isGrounded = true;
      } else {
        isGrounded = false;
        playerVelocityY -= 22 * dt;
        playerObj.position.y += playerVelocityY * dt;
      }

      if ((keys['Space']) && isGrounded) {
        playerVelocityY = 8.5;
        isGrounded = false;
        SoundSynth.play('jump');
      }

      // Camera Follow
      const camDist = 6.5;
      const camX = playerObj.position.x + Math.sin(cameraAngle.yaw) * Math.cos(cameraAngle.pitch) * camDist;
      const camY = playerObj.position.y + Math.sin(cameraAngle.pitch) * camDist + 1.2;
      const camZ = playerObj.position.z + Math.cos(cameraAngle.yaw) * Math.cos(cameraAngle.pitch) * camDist;

      camera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.15);
      camera.lookAt(playerObj.position.x, playerObj.position.y + 1.0, playerObj.position.z);

      // Entity Behaviors & Logic
      entities.forEach((ent) => {
        if (ent === playerObj) return;

        // Collectibles & Logic Cards
        const cards = ent.userData.logic?.cards || [];
        cards.forEach((c) => {
          if (c.type === 'Collectable') {
            ent.rotation.y += dt * 3.0;
            ent.position.y = (ent.userData.initialY || 1.0) + Math.sin(now * 0.004) * 0.25;

            // Collision check with player
            const dist = ent.position.distanceTo(playerObj.position);
            if (dist < 1.4 && ent.visible) {
              ent.visible = false;
              gameState.Score += Number(c.config?.points || 100);
              gameState.Coins += 1;
              SoundSynth.play('coin');
              updateHUD();
            }
          } else if (c.type === 'Patrol') {
            const axis = c.config?.axis || 'x';
            const dist = Number(c.config?.distance || 6);
            const spd = Number(c.config?.speed || 2.5);
            ent.position[axis] = (ent.userData.initialY || 0) + Math.sin(now * 0.001 * spd) * (dist / 2);
          } else if (c.type === 'DamageOnTouch') {
            const dist = ent.position.distanceTo(playerObj.position);
            if (dist < 1.3) {
              gameState.Health = Math.max(0, gameState.Health - 0.5);
              SoundSynth.play('damage');
              updateHUD();
            }
          }
        });
      });

      renderer.render(scene, camera);
    }

    animate();

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
  }

  public static downloadHTML(content: string, filename: string = 'AetherGame.html'): void {
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
