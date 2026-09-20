export type EasingFunctionType =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounce'
  | 'elastic';

export interface KeyframeData {
  id: string;
  time: number; // In seconds (e.g. 0, 1.5, 3)
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number }; // In degrees
  scale: { x: number; y: number; z: number };
  easing: EasingFunctionType;
}

export interface AnimationTrack {
  id: string;
  name: string;
  targetNodeId: string;
  duration: number; // In seconds
  loop: boolean;
  pingPong: boolean;
  autoplay: boolean;
  keyframes: KeyframeData[];
}

export interface AnimationPlaybackState {
  trackId: string;
  currentTime: number; // Current playhead in seconds
  isPlaying: boolean;
  playbackSpeed: number; // 1.0 = normal, 0.5 = slow-mo, 2.0 = fast
  direction: 1 | -1; // 1 = forward, -1 = reverse
}
