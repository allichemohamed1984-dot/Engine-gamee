import * as THREE from 'three';
import { Entity, CharacterControllerComponent, TransformComponent } from '../ecs/ECS';

/**
 * Keyboard Input State Manager for Character Control
 * Supports both ZQSD (AZERTY) and WASD (QWERTY) + Arrow Keys + Space
 */
export class InputManager {
  public forward: boolean = false;
  public backward: boolean = false;
  public left: boolean = false;
  public right: boolean = false;
  public jump: boolean = false;
  public sprint: boolean = false;

  private isBound: boolean = false;

  public bind(): void {
    if (this.isBound || typeof window === 'undefined') return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    this.isBound = true;
  }

  public unbind(): void {
    if (!this.isBound || typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.reset();
    this.isBound = false;
  }

  public reset(): void {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.jump = false;
    this.sprint = false;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const key = e.key.toLowerCase();
    switch (key) {
      case 'z':
      case 'w':
      case 'arrowup':
        this.forward = true;
        break;
      case 's':
      case 'arrowdown':
        this.backward = true;
        break;
      case 'q':
      case 'a':
      case 'arrowleft':
        this.left = true;
        break;
      case 'd':
      case 'arrowright':
        this.right = true;
        break;
      case ' ':
        e.preventDefault();
        this.jump = true;
        break;
      case 'shift':
        this.sprint = true;
        break;
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    const key = e.key.toLowerCase();
    switch (key) {
      case 'z':
      case 'w':
      case 'arrowup':
        this.forward = false;
        break;
      case 's':
      case 'arrowdown':
        this.backward = false;
        break;
      case 'q':
      case 'a':
      case 'arrowleft':
        this.left = false;
        break;
      case 'd':
      case 'arrowright':
        this.right = false;
        break;
      case ' ':
        this.jump = false;
        break;
      case 'shift':
        this.sprint = false;
        break;
    }
  };
}

/**
 * CharacterControllerSystem (ECS System)
 * Manages player movement, gravity, jump impulse, grounded state, and camera follow
 */
export class CharacterControllerSystem {
  public input: InputManager = new InputManager();
  public camera: THREE.PerspectiveCamera | null = null;
  private cameraOffset = new THREE.Vector3(0, 3.2, 5.5);
  private cameraLookTarget = new THREE.Vector3();
  private currentCameraPos = new THREE.Vector3();

  constructor(camera?: THREE.PerspectiveCamera) {
    if (camera) this.camera = camera;
  }

  public setCamera(camera: THREE.PerspectiveCamera): void {
    this.camera = camera;
  }

  public getCamera(): THREE.PerspectiveCamera | null {
    return this.camera;
  }

  public activate(): void {
    this.input.bind();
  }

  public deactivate(): void {
    this.input.unbind();
  }

  public update(dt: number, entities: Entity[]): void {
    // Find active player entity with CharacterControllerComponent
    const playerEntity = entities.find(
      (e) => e.active && e.hasComponent('CharacterController') && e.object3D
    );

    if (!playerEntity || !playerEntity.object3D) return;

    const controller = playerEntity.getComponent<CharacterControllerComponent>('CharacterController');
    const transform = playerEntity.getComponent<TransformComponent>('Transform');
    if (!controller || !controller.enabled || !transform) return;

    const obj = playerEntity.object3D;

    // Movement speed with sprint modifier
    const moveSpeed = controller.speed * (this.input.sprint ? 1.5 : 1.0);

    // Camera-relative forward & right vectors (projected onto horizontal plane)
    const moveDir = new THREE.Vector3();
    let forward = new THREE.Vector3(0, 0, -1);
    let right = new THREE.Vector3(1, 0, 0);

    if (this.camera) {
      this.camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
    }

    if (this.input.forward) moveDir.add(forward);
    if (this.input.backward) moveDir.sub(forward);
    if (this.input.right) moveDir.add(right);
    if (this.input.left) moveDir.sub(right);

    const hasHorizontalMovement = moveDir.lengthSq() > 0.001;
    if (hasHorizontalMovement) {
      moveDir.normalize();

      // Smoothly rotate the character mesh towards movement direction
      const targetRotationY = Math.atan2(moveDir.x, moveDir.z);
      const currentRotationY = obj.rotation.y;

      // Spherical/angular lerp approximation
      let diff = targetRotationY - currentRotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      obj.rotation.y += diff * Math.min(1.0, dt * 14);
    }

    // Kinematic translation vector (horizontal)
    const horizontalVelocity = moveDir.clone().multiplyScalar(moveSpeed);

    // Gravity and Jumping
    const gravity = -18.0; // m/s^2
    if (controller.isGrounded) {
      if (this.input.jump) {
        controller.verticalVelocity = controller.jumpForce;
        controller.isGrounded = false;
      } else {
        // Slight downward velocity to stay glued to slopes/floors
        controller.verticalVelocity = -1.5;
      }
    } else {
      controller.verticalVelocity += gravity * dt;
      // Clamp terminal velocity
      if (controller.verticalVelocity < -25) {
        controller.verticalVelocity = -25;
      }
    }

    // Calculate total movement vector for this step
    const displacement = new THREE.Vector3(
      horizontalVelocity.x * dt,
      controller.verticalVelocity * dt,
      horizontalVelocity.z * dt
    );

    // If Rapier character controller is bound, let Rapier compute actual collision movement
    if (controller.rawController && controller.rawBody) {
      // Rapier movement will be driven in PhysicsSystem step
    } else {
      // Fallback simple ground collision with floor plane (Y = 0)
      obj.position.add(displacement);
      const minFloorY = 1.0; // Half capsule height
      if (obj.position.y <= minFloorY) {
        obj.position.y = minFloorY;
        controller.verticalVelocity = 0;
        controller.isGrounded = true;
      }
    }

    // Update Transform component
    transform.position.copy(obj.position);
    transform.rotation.copy(obj.rotation);
    transform.quaternion.copy(obj.quaternion);

    // Follow camera update
    if (this.camera) {
      if (controller.mode === 'thirdPerson') {
        // Handled exclusively by SceneManager to prevent frame conflicts and high-frequency shaking
      } else {
        // First-person eye level
        this.camera.position.copy(obj.position).add(new THREE.Vector3(0, 1.6, 0));
        const targetLook = new THREE.Vector3(0, 0, -1).applyQuaternion(obj.quaternion);
        this.camera.lookAt(this.camera.position.clone().add(targetLook));
      }
    }
  }

  public dispose(): void {
    this.input.unbind();
  }
}
