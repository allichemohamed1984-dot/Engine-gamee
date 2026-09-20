/**
 * GhostManager.ts
 * Records player movement frames during gameplay and replays a translucent ghost avatar for Time Trial / Ghost Racing.
 */

import * as THREE from 'three';

export interface GhostFrame {
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number };
}

export class GhostManager {
  private isRecording = false;
  private isPlayingBack = false;
  private recordStartTime = 0;
  private playbackStartTime = 0;

  public currentRecording: GhostFrame[] = [];
  public bestGhost: GhostFrame[] = [];
  public ghostMesh: THREE.Mesh | null = null;

  constructor(private scene: THREE.Scene) {}

  public startRecording() {
    this.isRecording = true;
    this.isPlayingBack = false;
    this.currentRecording = [];
    this.recordStartTime = performance.now();
  }

  public stopRecording() {
    this.isRecording = false;
    if (this.currentRecording.length > 0) {
      // Save as best ghost if it's the first or longer/better
      if (this.bestGhost.length === 0 || this.currentRecording.length >= this.bestGhost.length) {
        this.bestGhost = [...this.currentRecording];
      }
    }
  }

  public recordFrame(playerObj: THREE.Object3D) {
    if (!this.isRecording || !playerObj) return;

    const time = (performance.now() - this.recordStartTime) / 1000;
    this.currentRecording.push({
      time,
      position: {
        x: playerObj.position.x,
        y: playerObj.position.y,
        z: playerObj.position.z,
      },
      rotation: {
        x: playerObj.quaternion.x,
        y: playerObj.quaternion.y,
        z: playerObj.quaternion.z,
        w: playerObj.quaternion.w,
      },
    });
  }

  public startPlayback() {
    if (this.bestGhost.length === 0) return;
    this.isPlayingBack = true;
    this.playbackStartTime = performance.now();

    // Create ghost mesh if not exists
    if (!this.ghostMesh) {
      const geo = new THREE.BoxGeometry(0.8, 1.8, 0.8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
        roughness: 0.2,
        metalness: 0.8,
      });
      this.ghostMesh = new THREE.Mesh(geo, mat);
      this.ghostMesh.name = '__AETHER_GHOST_AVATAR__';
      this.scene.add(this.ghostMesh);
    }
    this.ghostMesh.visible = true;
  }

  public stopPlayback() {
    this.isPlayingBack = false;
    if (this.ghostMesh) {
      this.ghostMesh.visible = false;
    }
  }

  public updatePlayback() {
    if (!this.isPlayingBack || this.bestGhost.length === 0 || !this.ghostMesh) return;

    const currentTime = (performance.now() - this.playbackStartTime) / 1000;

    // Find surrounding frames for interpolation
    const ghost = this.bestGhost;
    if (currentTime > ghost[ghost.length - 1].time) {
      // Loop playback
      this.playbackStartTime = performance.now();
      return;
    }

    let nextIdx = ghost.findIndex((f) => f.time >= currentTime);
    if (nextIdx === -1) nextIdx = ghost.length - 1;
    const prevIdx = Math.max(0, nextIdx - 1);

    const fPrev = ghost[prevIdx];
    const fNext = ghost[nextIdx];

    const t0 = fPrev.time;
    const t1 = fNext.time;
    const alpha = t1 > t0 ? (currentTime - t0) / (t1 - t0) : 0;

    const pPrev = new THREE.Vector3(fPrev.position.x, fPrev.position.y, fPrev.position.z);
    const pNext = new THREE.Vector3(fNext.position.x, fNext.position.y, fNext.position.z);
    this.ghostMesh.position.lerpVectors(pPrev, pNext, alpha);

    const qPrev = new THREE.Quaternion(fPrev.rotation.x, fPrev.rotation.y, fPrev.rotation.z, fPrev.rotation.w);
    const qNext = new THREE.Quaternion(fNext.rotation.x, fNext.rotation.y, fNext.rotation.z, fNext.rotation.w);
    this.ghostMesh.quaternion.slerpQuaternions(qPrev, qNext, alpha);
  }
}
