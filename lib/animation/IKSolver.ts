import * as THREE from 'three';

/**
 * Analytical Two-Bone IK Solver for limbs (arms/legs: Root -> Joint -> End Effector)
 */
export class IKSolver {
  /**
   * Solves 2-bone IK for a chain (e.g. Shoulder -> Elbow -> Wrist)
   * @param root Bone 1 (Root, e.g. Shoulder/Hip)
   * @param middle Bone 2 (Middle, e.g. Elbow/Knee)
   * @param end Bone 3 (End effector, e.g. Hand/Foot)
   * @param targetPosition Desired world position for the end effector
   * @param poleVector Desired world direction for joint bending (e.g. knee/elbow pointing vector)
   */
  public static solveTwoBoneIK(
    root: THREE.Object3D,
    middle: THREE.Object3D,
    end: THREE.Object3D,
    targetPosition: THREE.Vector3,
    poleVector: THREE.Vector3
  ): void {
    const rootPos = new THREE.Vector3();
    const middlePos = new THREE.Vector3();
    const endPos = new THREE.Vector3();

    root.getWorldPosition(rootPos);
    middle.getWorldPosition(middlePos);
    end.getWorldPosition(endPos);

    const l1 = rootPos.distanceTo(middlePos);
    const l2 = middlePos.distanceTo(endPos);
    const maxReach = l1 + l2;

    const targetDist = rootPos.distanceTo(targetPosition);
    const clampedDist = Math.min(targetDist, maxReach * 0.9999); // Prevent overextension

    // Direction from root to target
    const rootToTarget = new THREE.Vector3().subVectors(targetPosition, rootPos).normalize();

    // Cosine rule for angle at root
    const cosAngleRoot = (l1 * l1 + clampedDist * clampedDist - l2 * l2) / (2 * l1 * clampedDist);
    const angleRoot = Math.acos(Math.max(-1, Math.min(1, cosAngleRoot)));

    // Plane normal defined by root-to-target and pole vector
    const cross = new THREE.Vector3().crossVectors(rootToTarget, new THREE.Vector3().subVectors(poleVector, rootPos)).normalize();
    const computedAxis = new THREE.Vector3().crossVectors(rootToTarget, cross).normalize();

    // Rotate root towards target with elbow bending offset
    const targetRotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0), // Default bone orientation assumption
      rootToTarget
    );

    if (root.parent) {
      const parentWorldQuat = new THREE.Quaternion();
      root.parent.getWorldQuaternion(parentWorldQuat);
      root.quaternion.copy(parentWorldQuat.clone().invert().multiply(targetRotation));
    } else {
      root.quaternion.copy(targetRotation);
    }

    // Solve middle joint rotation
    const cosAngleMiddle = (l1 * l1 + l2 * l2 - clampedDist * clampedDist) / (2 * l1 * l2);
    const angleMiddle = Math.acos(Math.max(-1, Math.min(1, cosAngleMiddle)));
    const bendAngle = Math.PI - angleMiddle;

    // Apply bend rotation to middle joint local space
    middle.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), bendAngle);
  }
}
