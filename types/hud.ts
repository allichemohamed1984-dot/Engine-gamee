export type HUDElementType =
  | 'health_bar'
  | 'score_counter'
  | 'coin_counter'
  | 'crosshair'
  | 'timer'
  | 'message_toast'
  | 'pause_menu'
  | 'button_action';

export type HUDAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'
  | 'center';

export interface HUDElement {
  id: string;
  type: HUDElementType;
  name: string;
  visible: boolean;
  anchor: HUDAnchor;
  offsetX: number; // in pixels
  offsetY: number; // in pixels
  width?: number;
  height?: number;
  boundVariable?: string; // e.g. 'Health', 'Score', 'Coins', 'Timer'
  label?: string;
  icon?: string;
  colorScheme?: string; // hex or preset
  maxValue?: number;
  showPercent?: boolean;
  style?: {
    fontSize?: number;
    backgroundColor?: string;
    borderColor?: string;
    borderRadius?: number;
    opacity?: number;
  };
}

export interface HUDConfig {
  enabled: boolean;
  showInEditor: boolean;
  elements: HUDElement[];
  variables: Record<string, number | string | boolean>;
}

export const DEFAULT_HUD_CONFIG: HUDConfig = {
  enabled: false,
  showInEditor: false,
  variables: {
    Health: 100,
    MaxHealth: 100,
    Score: 0,
    Coins: 0,
    Timer: 0,
    Lives: 3,
  },
  elements: [],
};
