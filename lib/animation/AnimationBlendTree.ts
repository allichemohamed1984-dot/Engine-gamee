import { AnimationTrack, KeyframeData } from '../../types/animation';

export interface BlendTreeConfig {
  id: string;
  name: string;
  trackAId: string;
  trackBId: string;
  blendParameter: number; // 0.0 (Track A) to 1.0 (Track B)
}

export class AnimationBlendTree {
  /**
   * Blends keyframes between two tracks linearly based on blendParameter (0.0 -> 1.0)
   */
  public static blendTracks(
    trackA: AnimationTrack,
    trackB: AnimationTrack,
    blend: number,
    time: number
  ): { position: { x: number; y: number; z: number }; rotation: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } } {
    const clampedBlend = Math.max(0, Math.min(1, blend));

    // Simple placeholder evaluation for demonstration of 1D blend tree interpolation
    const evalTrack = (track: AnimationTrack, t: number) => {
      if (track.keyframes.length === 0) {
        return { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } };
      }
      const kf = track.keyframes[0];
      return { position: kf.position, rotation: kf.rotation, scale: kf.scale };
    };

    const poseA = evalTrack(trackA, time);
    const poseB = evalTrack(trackB, time);

    return {
      position: {
        x: poseA.position.x * (1 - clampedBlend) + poseB.position.x * clampedBlend,
        y: poseA.position.y * (1 - clampedBlend) + poseB.position.y * clampedBlend,
        z: poseA.position.z * (1 - clampedBlend) + poseB.position.z * clampedBlend,
      },
      rotation: {
        x: poseA.rotation.x * (1 - clampedBlend) + poseB.rotation.x * clampedBlend,
        y: poseA.rotation.y * (1 - clampedBlend) + poseB.rotation.y * clampedBlend,
        z: poseA.rotation.z * (1 - clampedBlend) + poseB.rotation.z * clampedBlend,
      },
      scale: {
        x: poseA.scale.x * (1 - clampedBlend) + poseB.scale.x * clampedBlend,
        y: poseA.scale.y * (1 - clampedBlend) + poseB.scale.y * clampedBlend,
        z: poseA.scale.z * (1 - clampedBlend) + poseB.scale.z * clampedBlend,
      },
    };
  }
}
