import * as THREE from 'three';
import { System, Entity } from './ECS';
import { ToonMaterialComponent, OutlineComponent } from './ECS';

/**
 * System to apply Toon Shading and Outline properties to entities
 */
export class ToonMaterialSystem extends System {
  readonly name = 'ToonMaterialSystem';

  update(dt: number, entities: Entity[]): void {
    for (const entity of entities) {
      if (!entity.object3D) continue;

      const toonComp = entity.getComponent<ToonMaterialComponent>('ToonMaterial');
      const outlineComp = entity.getComponent<OutlineComponent>('Outline');

      if (toonComp || outlineComp) {
        entity.object3D.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            // Get or create component dynamically from Mesh properties if needed
            let toonComp = entity.getComponent<ToonMaterialComponent>('ToonMaterial');
            let outlineComp = entity.getComponent<OutlineComponent>('Outline');

            // Apply Toon Shading (Switch to MeshToonMaterial if not already)
            if (toonComp && !(child.material instanceof THREE.MeshToonMaterial)) {
              const originalMaterial = child.material as THREE.Material;
              const toonMaterial = new THREE.MeshToonMaterial({
                color: (originalMaterial as any).color || 0xffffff,
                map: (originalMaterial as any).map || null,
              });
              child.material = toonMaterial;
            }

            // Apply Outline (simplified implementation: backface expansion)
            if (outlineComp) {
              // Check if outline mesh already exists
              let outlineMesh = child.getObjectByName('outline') as THREE.Mesh;
              if (!outlineMesh) {
                const outlineGeo = (child.geometry as THREE.BufferGeometry).clone();
                const outlineMat = new THREE.MeshBasicMaterial({
                  color: outlineComp.color,
                  side: THREE.BackSide,
                });
                outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
                outlineMesh.name = 'outline';
                child.add(outlineMesh);
              }
              outlineMesh.scale.set(1 + 0.05 * outlineComp.strength, 1 + 0.05 * outlineComp.strength, 1 + 0.05 * outlineComp.strength);
              // Update outline color if changed
              const outlineMat = outlineMesh.material as THREE.MeshBasicMaterial;
              if (outlineMat.color.getHexString() !== outlineComp.color.replace('#', '')) {
                outlineMat.color.set(outlineComp.color);
              }
            }
          }
        });
      }
    }
  }
}
