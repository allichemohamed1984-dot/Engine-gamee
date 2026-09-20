import * as THREE from 'three';
import { FoliageType, FoliageInstance, FoliageLayer } from '../../types/terrain';

// Procedural Geometry & Material Factories for Instanced Foliage
function createPineTreeGeometry(): THREE.BufferGeometry {
  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.8, 6);
  trunkGeo.translate(0, 0.4, 0);

  const foliage1 = new THREE.ConeGeometry(1.2, 1.4, 7);
  foliage1.translate(0, 1.3, 0);

  const foliage2 = new THREE.ConeGeometry(0.9, 1.2, 7);
  foliage2.translate(0, 2.0, 0);

  const foliage3 = new THREE.ConeGeometry(0.6, 1.0, 7);
  foliage3.translate(0, 2.7, 0);

  // Combine
  const merged = new THREE.BufferGeometry();
  const geos = [trunkGeo, foliage1, foliage2, foliage3];
  
  // Quick manual merge
  let totalPos = 0;
  geos.forEach((g) => (totalPos += g.attributes.position.count));

  const posArray = new Float32Array(totalPos * 3);
  const normArray = new Float32Array(totalPos * 3);
  let offset = 0;

  geos.forEach((g) => {
    const p = g.attributes.position.array;
    const n = g.attributes.normal.array;
    posArray.set(p, offset * 3);
    normArray.set(n, offset * 3);
    offset += g.attributes.position.count;
  });

  merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
  merged.computeVertexNormals();

  return merged;
}

function createOakTreeGeometry(): THREE.BufferGeometry {
  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 1.2, 6);
  trunkGeo.translate(0, 0.6, 0);

  const canopyGeo = new THREE.DodecahedronGeometry(1.4, 1);
  canopyGeo.translate(0, 2.0, 0);

  const totalPos = trunkGeo.attributes.position.count + canopyGeo.attributes.position.count;
  const posArray = new Float32Array(totalPos * 3);
  const normArray = new Float32Array(totalPos * 3);

  posArray.set(trunkGeo.attributes.position.array, 0);
  normArray.set(trunkGeo.attributes.normal.array, 0);

  const offset = trunkGeo.attributes.position.count * 3;
  posArray.set(canopyGeo.attributes.position.array, offset);
  normArray.set(canopyGeo.attributes.normal.array, offset);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normArray, 3));
  merged.computeVertexNormals();

  return merged;
}

function createRockGeometry(): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(0.75, 0);
  const pos = geo.attributes.position;
  // Jitter vertices for rocky look
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * (0.8 + (Math.sin(i * 3) * 0.25));
    const y = pos.getY(i) * (0.6 + (Math.cos(i * 5) * 0.2));
    const z = pos.getZ(i) * (0.8 + (Math.sin(i * 7) * 0.25));
    pos.setXYZ(i, x, Math.max(0.05, y + 0.35), z);
  }
  geo.computeVertexNormals();
  return geo;
}

function createGrassTuftGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const bladeCount = 5;
  const posArray = new Float32Array(bladeCount * 3 * 3 * 2); // triangles

  let idx = 0;
  for (let b = 0; b < bladeCount; b++) {
    const angle = (b / bladeCount) * Math.PI + (Math.random() * 0.3);
    const height = 0.5 + Math.random() * 0.35;
    const width = 0.08;

    const dx = Math.cos(angle) * width;
    const dz = Math.sin(angle) * width;

    // Triangle 1
    posArray[idx++] = -dx;
    posArray[idx++] = 0;
    posArray[idx++] = -dz;

    posArray[idx++] = dx;
    posArray[idx++] = 0;
    posArray[idx++] = dz;

    posArray[idx++] = (Math.random() - 0.5) * 0.2;
    posArray[idx++] = height;
    posArray[idx++] = (Math.random() - 0.5) * 0.2;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  geo.computeVertexNormals();
  return geo;
}

function createFlowerGeometry(): THREE.BufferGeometry {
  const stem = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 4);
  stem.translate(0, 0.2, 0);

  const head = new THREE.SphereGeometry(0.08, 6, 6);
  head.translate(0, 0.42, 0);

  const total = stem.attributes.position.count + head.attributes.position.count;
  const pos = new Float32Array(total * 3);
  pos.set(stem.attributes.position.array, 0);
  pos.set(head.attributes.position.array, stem.attributes.position.count * 3);

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  return merged;
}

function createCrystalGeometry(): THREE.BufferGeometry {
  const geo = new THREE.OctahedronGeometry(0.45, 0);
  geo.scale(0.6, 1.8, 0.6);
  geo.translate(0, 0.45, 0);
  return geo;
}

function createBushGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.65, 7, 6);
  geo.scale(1.2, 0.8, 1.2);
  geo.translate(0, 0.4, 0);
  return geo;
}

export class FoliagePainter {
  private scene: THREE.Scene;
  private maxInstancesPerType: number = 2000;

  private layers: Map<FoliageType, {
    mesh: THREE.InstancedMesh;
    instances: FoliageInstance[];
    material: THREE.MeshStandardMaterial;
  }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initLayers();
  }

  private initLayers(): void {
    const types: FoliageType[] = [
      'pine_tree',
      'oak_tree',
      'rock',
      'grass_tuft',
      'flower',
      'crystal',
      'bush',
    ];

    types.forEach((type) => {
      let geo: THREE.BufferGeometry;
      let mat: THREE.MeshStandardMaterial;

      switch (type) {
        case 'pine_tree':
          geo = createPineTreeGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#2d6a4f',
            roughness: 0.8,
            metalness: 0.05,
            flatShading: true,
          });
          break;

        case 'oak_tree':
          geo = createOakTreeGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#40916c',
            roughness: 0.85,
            metalness: 0.05,
            flatShading: true,
          });
          break;

        case 'rock':
          geo = createRockGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#64748b',
            roughness: 0.9,
            metalness: 0.2,
            flatShading: true,
          });
          break;

        case 'grass_tuft':
          geo = createGrassTuftGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#52b788',
            roughness: 0.7,
            side: THREE.DoubleSide,
          });
          break;

        case 'flower':
          geo = createFlowerGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#f43f5e',
            roughness: 0.6,
          });
          break;

        case 'crystal':
          geo = createCrystalGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#38bdf8',
            emissive: '#0284c7',
            emissiveIntensity: 0.9,
            roughness: 0.2,
            metalness: 0.8,
          });
          break;

        case 'bush':
          geo = createBushGeometry();
          mat = new THREE.MeshStandardMaterial({
            color: '#1b4332',
            roughness: 0.85,
            flatShading: true,
          });
          break;
      }

      const instMesh = new THREE.InstancedMesh(geo, mat, this.maxInstancesPerType);
      instMesh.count = 0;
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;
      instMesh.name = `__AETHER_FOLIAGE_${type.toUpperCase()}__`;
      instMesh.userData = { isFoliage: true, foliageType: type };
      instMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

      this.scene.add(instMesh);
      this.layers.set(type, { mesh: instMesh, instances: [], material: mat });
    });
  }

  public paintAt(
    worldPoint: THREE.Vector3,
    type: FoliageType,
    radius: number,
    density: number,
    scaleMin: number,
    scaleMax: number,
    surfaceNormal?: THREE.Vector3
  ): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    const countToSpawn = Math.max(1, Math.round(density * (radius / 2.5)));

    for (let i = 0; i < countToSpawn; i++) {
      if (layer.instances.length >= this.maxInstancesPerType) break;

      // Random offset in circle radius
      const r = Math.sqrt(Math.random()) * radius;
      const theta = Math.random() * Math.PI * 2;
      const x = worldPoint.x + r * Math.cos(theta);
      const z = worldPoint.z + r * Math.sin(theta);
      const y = worldPoint.y + (Math.random() - 0.5) * 0.05;

      const rotY = Math.random() * Math.PI * 2;
      const scale = scaleMin + Math.random() * (scaleMax - scaleMin);

      const inst: FoliageInstance = { x, y, z, rotY, scale };
      layer.instances.push(inst);
    }

    this.rebuildLayerMatrices(type);
  }

  public eraseAt(worldPoint: THREE.Vector3, radius: number): void {
    this.layers.forEach((layer, type) => {
      const remaining = layer.instances.filter((inst) => {
        const dist = Math.hypot(inst.x - worldPoint.x, inst.z - worldPoint.z);
        return dist >= radius;
      });

      if (remaining.length !== layer.instances.length) {
        layer.instances = remaining;
        this.rebuildLayerMatrices(type);
      }
    });
  }

  public rebuildLayerMatrices(type: FoliageType): void {
    const layer = this.layers.get(type);
    if (!layer) return;

    const dummy = new THREE.Object3D();
    const instances = layer.instances;
    layer.mesh.count = instances.length;

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      dummy.position.set(inst.x, inst.y, inst.z);
      dummy.rotation.set(0, inst.rotY, 0);
      dummy.scale.set(inst.scale, inst.scale, inst.scale);
      dummy.updateMatrix();

      layer.mesh.setMatrixAt(i, dummy.matrix);
    }

    layer.mesh.instanceMatrix.needsUpdate = true;
  }

  public loadLayers(savedLayers: FoliageLayer[]): void {
    savedLayers.forEach((saved) => {
      const layer = this.layers.get(saved.type);
      if (layer) {
        layer.instances = [...saved.instances];
        this.rebuildLayerMatrices(saved.type);
      }
    });
  }

  public importLayers(savedLayers: FoliageLayer[]): void {
    this.loadLayers(savedLayers);
  }

  public exportLayers(): FoliageLayer[] {
    const result: FoliageLayer[] = [];
    this.layers.forEach((layer, type) => {
      if (layer.instances.length > 0) {
        result.push({
          type,
          name: type,
          instances: [...layer.instances],
        });
      }
    });
    return result;
  }

  public adjustFoliageHeights(terrainGenerator: any): void {
    this.layers.forEach((layer, type) => {
      let changed = false;
      for (let i = 0; i < layer.instances.length; i++) {
        const inst = layer.instances[i];
        const currentTerrainY = terrainGenerator.getHeightAt(inst.x, inst.z);
        if (Math.abs(inst.y - currentTerrainY) > 0.001) {
          inst.y = currentTerrainY;
          changed = true;
        }
      }
      if (changed) {
        this.rebuildLayerMatrices(type);
      }
    });
  }

  public clear(): void {
    this.layers.forEach((layer, type) => {
      layer.instances = [];
      layer.mesh.count = 0;
      layer.mesh.instanceMatrix.needsUpdate = true;
    });
  }

  public clearAll(): void {
    this.clear();
  }

  public dispose(): void {
    this.layers.forEach((layer) => {
      this.scene.remove(layer.mesh);
      layer.mesh.geometry.dispose();
      layer.material.dispose();
    });
    this.layers.clear();
  }
}
