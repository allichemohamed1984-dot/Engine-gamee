import * as THREE from 'three';
import { TerrainConfig, DEFAULT_TERRAIN_CONFIG } from '../../types/terrain';

// Simple deterministic 2D Simplex/Perlin noise implementation
class SimplexNoise2D {
  private perm: number[] = [];

  constructor(seed: number = 42) {
    const p: number[] = [];
    for (let i = 0; i < 256; i++) p[i] = i;

    // Shuffle with seed
    let s = seed;
    for (let i = 255; i > 0; i--) {
      s = (s * 9301 + 49297) % 233280;
      const j = Math.floor((s / 233280) * (i + 1));
      const temp = p[i];
      p[i] = p[j];
      p[j] = temp;
    }

    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  private grad2(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return (h & 1 ? -u : u) + (h & 2 ? -2.0 * v : 2.0 * v);
  }

  public noise(x: number, y: number): number {
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

    let n0 = 0;
    let n1 = 0;
    let n2 = 0;

    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;

    let i1 = 0;
    let j1 = 0;
    if (x0 > y0) {
      i1 = 1;
      j1 = 0;
    } else {
      i1 = 0;
      j1 = 1;
    }

    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.perm[ii + this.perm[jj]];
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]];

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 > 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.grad2(gi0, x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 > 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.grad2(gi1, x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 > 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.grad2(gi2, x2, y2);
    }

    return 70.0 * (n0 + n1 + n2);
  }

  public fbm(x: number, y: number, octaves: number = 4, roughness: number = 0.5): number {
    let value = 0;
    let amplitude = 1.0;
    let frequency = 1.0;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= roughness;
      frequency *= 2.0;
    }

    return value / maxValue;
  }
}

export class TerrainGenerator {
  public config: TerrainConfig;
  public mesh!: THREE.Mesh;
  public geometry!: THREE.PlaneGeometry;
  public material!: THREE.MeshStandardMaterial;
  private noise: SimplexNoise2D;

  private heightArray!: Float32Array;

  constructor(config?: Partial<TerrainConfig>) {
    this.config = { ...DEFAULT_TERRAIN_CONFIG, ...config };
    this.noise = new SimplexNoise2D(this.config.seed);
    this.buildTerrainMesh();
  }

  public buildTerrainMesh(customHeights?: number[]): THREE.Mesh {
    const { size, resolution, heightScale, roughness, octaves, colors } = this.config;

    // Plane Geometry oriented horizontally
    this.geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
    this.geometry.rotateX(-Math.PI / 2);

    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const vertexCount = posAttr.count;

    this.heightArray = new Float32Array(vertexCount);
    const colorArray = new Float32Array(vertexCount * 3);

    const grassColor = new THREE.Color(colors.grass);
    const rockColor = new THREE.Color(colors.rock);
    const sandColor = new THREE.Color(colors.sand);
    const snowColor = new THREE.Color(colors.snow);

    const halfSize = size / 2;

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      let h = 0;
      if (customHeights && customHeights.length === vertexCount) {
        h = customHeights[i];
      } else {
        // Compute procedural FBM height
        const nx = (vx + halfSize) * roughness;
        const nz = (vz + halfSize) * roughness;
        const elevation = this.noise.fbm(nx, nz, octaves, 0.5);

        // Island / edge falloff to keep edges grounded
        const distFromCenter = Math.sqrt(vx * vx + vz * vz) / (halfSize * 1.05);
        const edgeFalloff = Math.max(0, 1 - Math.pow(distFromCenter, 2.8));

        h = elevation * heightScale * edgeFalloff;
      }

      posAttr.setY(i, h);
      this.heightArray[i] = h;
    }

    this.geometry.computeVertexNormals();

    // Compute slope & elevation-based vertex colors
    this.updateColors(grassColor, rockColor, sandColor, snowColor);

    this.geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;

    // PBR Material with vertex colors
    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.1,
      wireframe: this.config.wireframe,
      flatShading: true,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = '__AETHER_PROCEDURAL_TERRAIN__';
    this.mesh.castShadow = this.config.castShadow;
    this.mesh.receiveShadow = this.config.receiveShadow;
    this.mesh.userData = {
      isTerrain: true,
      terrainConfig: this.config,
    };

    return this.mesh;
  }

  public updateColors(
    grassColor: THREE.Color,
    rockColor: THREE.Color,
    sandColor: THREE.Color,
    snowColor: THREE.Color
  ): void {
    const posAttr = this.geometry.attributes.position;
    const normAttr = this.geometry.attributes.normal;
    let colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;

    if (!colorAttr) {
      const arr = new Float32Array(posAttr.count * 3);
      this.geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    }

    const tempColor = new THREE.Color();
    const maxH = this.config.heightScale;

    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      const ny = normAttr ? normAttr.getY(i) : 1.0; // Slope normal Y (1 = flat, 0 = vertical cliff)

      if (ny < 0.7) {
        // Steep slope -> Rock
        tempColor.copy(rockColor);
      } else if (y > maxH * 0.75) {
        // High mountain peak -> Snow
        tempColor.copy(snowColor);
      } else if (y < 0.3) {
        // Low valley / coastline -> Sand
        tempColor.copy(sandColor);
      } else {
        // Grassy plains
        const variation = (Math.sin(posAttr.getX(i) * 2) * 0.05);
        tempColor.copy(grassColor).offsetHSL(0, 0, variation);
      }

      colorAttr.setXYZ(i, tempColor.r, tempColor.g, tempColor.b);
    }

    colorAttr.needsUpdate = true;
  }

  // Real-time sculpt methods via Raycasting
  public sculptAt(
    worldPoint: THREE.Vector3,
    mode: 'raise' | 'lower' | 'smooth' | 'flatten',
    radius: number,
    strength: number,
    targetHeight: number = 0
  ): void {
    if (!this.geometry) return;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const vertexCount = posAttr.count;
    const localPoint = this.mesh.worldToLocal(worldPoint.clone());

    // For smooth mode: calculate average height in radius
    let avgHeight = 0;
    let avgCount = 0;
    if (mode === 'smooth') {
      for (let i = 0; i < vertexCount; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);
        const dist = Math.hypot(vx - localPoint.x, vz - localPoint.z);
        if (dist < radius) {
          avgHeight += posAttr.getY(i);
          avgCount++;
        }
      }
      if (avgCount > 0) avgHeight /= avgCount;
    }

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.hypot(vx - localPoint.x, vz - localPoint.z);

      if (dist < radius) {
        // Cosine falloff for smooth organic sculpting
        const factor = 0.5 * (1 + Math.cos((Math.PI * dist) / radius)) * strength * 0.15;
        const curY = posAttr.getY(i);

        let newY = curY;
        switch (mode) {
          case 'raise':
            newY = curY + factor * 2.0;
            break;
          case 'lower':
            newY = Math.max(-5, curY - factor * 2.0);
            break;
          case 'smooth':
            newY = curY + (avgHeight - curY) * factor * 1.5;
            break;
          case 'flatten':
            newY = curY + (targetHeight - curY) * factor * 2.0;
            break;
        }

        posAttr.setY(i, newY);
        this.heightArray[i] = newY;
      }
    }

    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();

    // Re-apply slope colors
    const colors = this.config.colors;
    this.updateColors(
      new THREE.Color(colors.grass),
      new THREE.Color(colors.rock),
      new THREE.Color(colors.sand),
      new THREE.Color(colors.snow)
    );
  }

  // Paint custom vertex colors directly onto the terrain
  public paintColorAt(worldPoint: THREE.Vector3, colorHex: string, radius: number, strength: number): void {
    if (!this.geometry) return;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    if (!colorAttr) return;

    const localPoint = this.mesh.worldToLocal(worldPoint.clone());
    const targetColor = new THREE.Color(colorHex);
    const curColor = new THREE.Color();

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.hypot(vx - localPoint.x, vz - localPoint.z);

      if (dist < radius) {
        const factor = 0.5 * (1 + Math.cos((Math.PI * dist) / radius)) * strength;
        curColor.setRGB(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i));
        curColor.lerp(targetColor, factor);
        colorAttr.setXYZ(i, curColor.r, curColor.g, curColor.b);
      }
    }

    colorAttr.needsUpdate = true;
  }

  // Get interpolated terrain height at any world (X, Z) coordinate
  public getHeightAt(x: number, z: number): number {
    if (!this.geometry) return 0;
    const { size, resolution } = this.config;
    const halfSize = size / 2;

    const gx = ((x + halfSize) / size) * resolution;
    const gz = ((z + halfSize) / size) * resolution;

    const col = Math.floor(Math.max(0, Math.min(resolution - 1, gx)));
    const row = Math.floor(Math.max(0, Math.min(resolution - 1, gz)));

    const idx = row * (resolution + 1) + col;
    if (this.heightArray && idx >= 0 && idx < this.heightArray.length) {
      return this.heightArray[idx];
    }
    return 0;
  }

  public exportHeightmap(): number[] {
    return Array.from(this.heightArray);
  }

  public importHeightmap(heights: number[]): void {
    if (!this.geometry) return;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const count = Math.min(posAttr.count, heights.length);

    for (let i = 0; i < count; i++) {
      posAttr.setY(i, heights[i]);
      this.heightArray[i] = heights[i];
    }

    posAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();

    const colors = this.config.colors;
    this.updateColors(
      new THREE.Color(colors.grass),
      new THREE.Color(colors.rock),
      new THREE.Color(colors.sand),
      new THREE.Color(colors.snow)
    );
  }

  public carveRiverBed(
    riverMesh: {
      config: { width: number };
      mesh: THREE.Mesh;
      curve: THREE.CatmullRomCurve3;
      getRiverHeightAndFlowAt: (x: number, z: number) => { height: number; flow: THREE.Vector3; inRiver: boolean };
    },
    depth: number = 2.0,
    bankWidth: number = 4.0
  ): void {
    if (!this.geometry) return;
    const posAttr = this.geometry.attributes.position as THREE.BufferAttribute;
    const colorAttr = this.geometry.attributes.color as THREE.BufferAttribute;
    const vertexCount = posAttr.count;

    const riverWidth = riverMesh.config.width;
    const riverHalfWidth = riverWidth / 2;
    const totalEffectRadius = riverHalfWidth + bankWidth;

    const sandColor = new THREE.Color(this.config.colors.sand || '#d6d3d1');
    const gravelColor = new THREE.Color('#78716c');

    for (let i = 0; i < vertexCount; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);

      // Transform local terrain vertex to world space
      const worldV = this.mesh.localToWorld(new THREE.Vector3(vx, posAttr.getY(i), vz));

      // Local position relative to river
      const riverLocalP = riverMesh.mesh.worldToLocal(worldV.clone());

      // Find distance to river curve
      let closestDistSq = Infinity;
      let closestU = 0;
      const steps = 60;
      for (let s = 0; s <= steps; s++) {
        const u = s / steps;
        const p = riverMesh.curve.getPointAt(u);
        const d2 = (p.x - riverLocalP.x) * (p.x - riverLocalP.x) + (p.z - riverLocalP.z) * (p.z - riverLocalP.z);
        if (d2 < closestDistSq) {
          closestDistSq = d2;
          closestU = u;
        }
      }

      const dist = Math.sqrt(closestDistSq);
      if (dist < totalEffectRadius) {
        const curvePoint = riverMesh.curve.getPointAt(closestU);
        const worldCurvePoint = riverMesh.mesh.localToWorld(curvePoint.clone());

        // Target height: river surface height minus river bed depth
        const targetBedHeight = worldCurvePoint.y - depth;

        // Smooth falloff factor
        let factor = 0;
        if (dist <= riverHalfWidth) {
          factor = 1.0;
        } else {
          const edgeT = (dist - riverHalfWidth) / bankWidth;
          factor = 0.5 * (1.0 + Math.cos(Math.PI * edgeT));
        }

        const curY = posAttr.getY(i);
        const newY = curY * (1 - factor) + targetBedHeight * factor;

        posAttr.setY(i, newY);
        this.heightArray[i] = newY;

        // Paint sand/gravel on carved riverbed
        if (colorAttr) {
          const curC = new THREE.Color(colorAttr.getX(i), colorAttr.getY(i), colorAttr.getZ(i));
          curC.lerp(factor > 0.6 ? gravelColor : sandColor, factor * 0.85);
          colorAttr.setXYZ(i, curC.r, curC.g, curC.b);
        }
      }
    }

    posAttr.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
    this.geometry.computeVertexNormals();
  }

  public regenerate(seed?: number): void {
    if (seed !== undefined) this.config.seed = seed;
    this.noise = new SimplexNoise2D(this.config.seed);
    this.buildTerrainMesh();
  }

  public setWireframe(wireframe: boolean): void {
    this.config.wireframe = wireframe;
    if (this.material) this.material.wireframe = wireframe;
  }

  public dispose(): void {
    if (this.geometry) this.geometry.dispose();
    if (this.material) this.material.dispose();
  }
}
