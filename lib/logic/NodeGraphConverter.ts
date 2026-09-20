import {
  BehaviorCard,
  CollectableConfig,
  DamageOnTouchConfig,
  GraphConnection,
  GraphNodeData,
  NodeGraphData,
  NodeType,
  PatrolConfig,
  Socket,
  TriggerZoneConfig,
} from '../../types/logic';

/**
 * Generates Socket definitions for each NodeType
 */
export function getSocketsForNodeType(type: NodeType): { inputs: Socket[]; outputs: Socket[] } {
  switch (type) {
    // Events
    case 'OnStart':
      return {
        inputs: [],
        outputs: [{ id: 'out_flow', name: 'Exec', type: 'flow' }],
      };
    case 'OnUpdate':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Exec', type: 'flow' },
          { id: 'out_dt', name: 'Delta (dt)', type: 'number' },
        ],
      };
    case 'OnCollision':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Exec', type: 'flow' },
          { id: 'out_other', name: 'Other', type: 'entity' },
        ],
      };
    case 'OnKeyPress':
      return {
        inputs: [],
        outputs: [{ id: 'out_flow', name: 'Pressed', type: 'flow' }],
      };
    case 'OnClick':
      return {
        inputs: [],
        outputs: [{ id: 'out_flow', name: 'Clicked', type: 'flow' }],
      };
    case 'OnTriggerEnter':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Enter', type: 'flow' },
          { id: 'out_target', name: 'Target', type: 'entity' },
        ],
      };
    case 'OnTriggerExit':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Exit', type: 'flow' },
          { id: 'out_target', name: 'Target', type: 'entity' },
        ],
      };
    case 'OnTimer':
      return {
        inputs: [],
        outputs: [{ id: 'out_flow', name: 'Tick', type: 'flow' }],
      };
    case 'OnCustomEvent':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Received', type: 'flow' },
          { id: 'out_data', name: 'Data', type: 'string' },
        ],
      };

    // Logic & Math
    case 'IfElse':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_cond', name: 'Condition', type: 'boolean' },
        ],
        outputs: [
          { id: 'out_true', name: 'Vrai (True)', type: 'flow' },
          { id: 'out_false', name: 'Faux (False)', type: 'flow' },
        ],
      };
    case 'Compare':
      return {
        inputs: [
          { id: 'in_a', name: 'A', type: 'number' },
          { id: 'in_b', name: 'B', type: 'number' },
        ],
        outputs: [{ id: 'out_result', name: 'Result', type: 'boolean' }],
      };
    case 'Gate':
      return {
        inputs: [
          { id: 'in_a', name: 'A', type: 'boolean' },
          { id: 'in_b', name: 'B', type: 'boolean' },
        ],
        outputs: [{ id: 'out_result', name: 'Result', type: 'boolean' }],
      };
    case 'Math':
      return {
        inputs: [
          { id: 'in_a', name: 'A', type: 'number' },
          { id: 'in_b', name: 'B', type: 'number' },
        ],
        outputs: [{ id: 'out_result', name: 'Result', type: 'number' }],
      };
    case 'Clamp':
      return {
        inputs: [
          { id: 'in_val', name: 'Val', type: 'number' },
          { id: 'in_min', name: 'Min', type: 'number' },
          { id: 'in_max', name: 'Max', type: 'number' },
        ],
        outputs: [{ id: 'out_val', name: 'Clamped', type: 'number' }],
      };
    case 'Lerp':
      return {
        inputs: [
          { id: 'in_a', name: 'A', type: 'number' },
          { id: 'in_b', name: 'B', type: 'number' },
          { id: 'in_t', name: 'Alpha (t)', type: 'number' },
        ],
        outputs: [{ id: 'out_val', name: 'Result', type: 'number' }],
      };
    case 'Random':
      return {
        inputs: [
          { id: 'in_min', name: 'Min', type: 'number' },
          { id: 'in_max', name: 'Max', type: 'number' },
        ],
        outputs: [{ id: 'out_val', name: 'Value', type: 'number' }],
      };
    case 'Toggle':
      return {
        inputs: [{ id: 'in_flow', name: 'Toggle', type: 'flow' }],
        outputs: [
          { id: 'out_on', name: 'On', type: 'flow' },
          { id: 'out_off', name: 'Off', type: 'flow' },
          { id: 'out_state', name: 'State', type: 'boolean' },
        ],
      };
    case 'Counter':
      return {
        inputs: [
          { id: 'in_inc', name: 'Increment', type: 'flow' },
          { id: 'in_reset', name: 'Reset', type: 'flow' },
        ],
        outputs: [
          { id: 'out_flow', name: 'Then', type: 'flow' },
          { id: 'out_count', name: 'Count', type: 'number' },
        ],
      };
    case 'Delay':
      return {
        inputs: [
          { id: 'in_flow', name: 'Start', type: 'flow' },
          { id: 'in_duration', name: 'Seconds', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Completed', type: 'flow' }],
      };

    // Actions & Transform & FX
    case 'ApplyImpulse':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
          { id: 'in_force', name: 'Force', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetPosition':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_x', name: 'X', type: 'number' },
          { id: 'in_y', name: 'Y', type: 'number' },
          { id: 'in_z', name: 'Z', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetRotation':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_x', name: 'Rot X', type: 'number' },
          { id: 'in_y', name: 'Rot Y', type: 'number' },
          { id: 'in_z', name: 'Rot Z', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetScale':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_scale', name: 'Scale', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetColor':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_color', name: 'Color', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'PlaySound':
      return {
        inputs: [{ id: 'in_flow', name: 'Exec', type: 'flow' }],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'DestroyEntity':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetVariable':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_val', name: 'Value', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'GetVariable':
      return {
        inputs: [],
        outputs: [{ id: 'out_val', name: 'Value', type: 'number' }],
      };
    case 'PlayAnimation':
      return {
        inputs: [
          { id: 'in_flow', name: 'Play', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ReverseAnimation':
      return {
        inputs: [
          { id: 'in_flow', name: 'Reverse', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'PauseAnimation':
      return {
        inputs: [
          { id: 'in_flow', name: 'Pause', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SpawnPrefab':
      return {
        inputs: [
          { id: 'in_flow', name: 'Spawn', type: 'flow' },
          { id: 'in_pos', name: 'Position', type: 'vector' },
        ],
        outputs: [
          { id: 'out_flow', name: 'Spawned', type: 'flow' },
          { id: 'out_entity', name: 'Entity', type: 'entity' },
        ],
      };
    case 'PrintLog':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_msg', name: 'Message', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'CameraShake':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_intensity', name: 'Intensity', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'EmitParticles':
      return {
        inputs: [
          { id: 'in_flow', name: 'Emit', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
          { id: 'in_rate', name: 'Rate', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ExplosionFX':
      return {
        inputs: [
          { id: 'in_flow', name: 'Explode', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
          { id: 'in_scale', name: 'Scale', type: 'number' },
          { id: 'in_force', name: 'Force', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'StopParticles':
      return {
        inputs: [
          { id: 'in_flow', name: 'Stop', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ShootProjectile':
      return {
        inputs: [
          { id: 'in_flow', name: 'Shoot', type: 'flow' },
          { id: 'in_speed', name: 'Vitesse (Speed)', type: 'number' },
          { id: 'in_damage', name: 'Dégâts (Damage)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };

    // AI & NPC Navigation Nodes
    case 'FollowTarget':
      return {
        inputs: [
          { id: 'in_flow', name: 'Follow', type: 'flow' },
          { id: 'in_target', name: 'Target', type: 'entity' },
          { id: 'in_speed', name: 'Vitesse', type: 'number' },
          { id: 'in_stop', name: 'Stop Dist', type: 'number' },
        ],
        outputs: [
          { id: 'out_flow', name: 'Then', type: 'flow' },
          { id: 'out_reached', name: 'Atteint', type: 'boolean' },
        ],
      };
    case 'PatrolWaypoints':
      return {
        inputs: [
          { id: 'in_flow', name: 'Patrouiller', type: 'flow' },
          { id: 'in_speed', name: 'Vitesse', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'CheckDistance':
      return {
        inputs: [
          { id: 'in_flow', name: 'Verifier', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
          { id: 'in_thresh', name: 'Seuil', type: 'number' },
        ],
        outputs: [
          { id: 'out_range', name: 'En Portée', type: 'boolean' },
          { id: 'out_dist', name: 'Distance', type: 'number' },
        ],
      };
    case 'LookAtPlayer':
      return {
        inputs: [
          { id: 'in_flow', name: 'Regarder', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };

    // Dynamic Lighting Nodes
    case 'SetLightColor':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_color', name: 'Couleur', type: 'string' },
          { id: 'in_intensity', name: 'Intensité', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'PulseLight':
      return {
        inputs: [
          { id: 'in_flow', name: 'Pulsar', type: 'flow' },
          { id: 'in_freq', name: 'Fréquence', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'FlickerLight':
      return {
        inputs: [
          { id: 'in_flow', name: 'Scintiller', type: 'flow' },
          { id: 'in_speed', name: 'Vitesse', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };

    // Cinematics & Dialogue
    case 'SwitchCamera':
      return {
        inputs: [
          { id: 'in_flow', name: 'Basculer', type: 'flow' },
          { id: 'in_cam', name: 'Caméra Cible', type: 'string' },
          { id: 'in_blend', name: 'Durée Fondu (s)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ShowDialogue':
      return {
        inputs: [
          { id: 'in_flow', name: 'Afficher', type: 'flow' },
          { id: 'in_speaker', name: 'Locuteur', type: 'string' },
          { id: 'in_text', name: 'Texte Dialogue', type: 'string' },
          { id: 'in_duration', name: 'Durée (s)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetDepthOfField':
      return {
        inputs: [
          { id: 'in_flow', name: 'Appliquer', type: 'flow' },
          { id: 'in_blur', name: 'Flou Dof (%)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };

    // Spatial Audio & BGM
    case 'PlaySound3D':
      return {
        inputs: [
          { id: 'in_flow', name: 'Jouer 3D', type: 'flow' },
          { id: 'in_sfx', name: 'Type Son (engine/torch/etc)', type: 'string' },
          { id: 'in_maxdist', name: 'Portée Max (m)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'PlaySFX':
      return {
        inputs: [
          { id: 'in_flow', name: 'Jouer SFX', type: 'flow' },
          { id: 'in_type', name: 'Type (jump/laser/coin/etc)', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'SetBGMState':
      return {
        inputs: [
          { id: 'in_flow', name: 'Définir BGM', type: 'flow' },
          { id: 'in_mode', name: 'Mode (exploration/combat/off)', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };

    // Enemy AI, Health & Inventory
    case 'CheckEnemyVision':
      return {
        inputs: [
          { id: 'in_flow', name: 'Vérifier', type: 'flow' },
          { id: 'in_fov', name: 'Angle Cône (Deg)', type: 'number' },
          { id: 'in_range', name: 'Portée Vue (m)', type: 'number' },
        ],
        outputs: [
          { id: 'out_seen', name: 'Si Vu', type: 'flow' },
          { id: 'out_hidden', name: 'Si Caché', type: 'flow' },
        ],
      };
    case 'DealDamage':
      return {
        inputs: [
          { id: 'in_flow', name: 'Infliger', type: 'flow' },
          { id: 'in_dmg', name: 'Montant Dégâts', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'CheckInventory':
      return {
        inputs: [
          { id: 'in_flow', name: 'Vérifier Clé', type: 'flow' },
          { id: 'in_item', name: 'Nom Item / Clé', type: 'string' },
        ],
        outputs: [
          { id: 'out_has', name: 'Possédé', type: 'flow' },
          { id: 'out_none', name: 'Non Possédé', type: 'flow' },
        ],
      };
    case 'AddItem':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_item', name: 'Nom Item', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'RemoveItem':
      return {
        inputs: [
          { id: 'in_flow', name: 'Exec', type: 'flow' },
          { id: 'in_item', name: 'Nom Item', type: 'string' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'OnProximity':
      return {
        inputs: [
          { id: 'in_dist', name: 'Distance (m)', type: 'number' },
        ],
        outputs: [
          { id: 'out_near', name: 'À Proximité', type: 'flow' },
          { id: 'out_far', name: 'Éloigné', type: 'flow' },
        ],
      };
    case 'UnlockDoor':
      return {
        inputs: [
          { id: 'in_flow', name: 'Déverrouiller', type: 'flow' },
        ],
        outputs: [{ id: 'out_flow', name: 'Ouvert', type: 'flow' }],
      };

    // Environmental Physics Nodes (Vent, Feu, Pluie)
    case 'OnWindGust':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Rafale', type: 'flow' },
          { id: 'out_speed', name: 'Vitesse (km/h)', type: 'number' },
        ],
      };
    case 'OnIgnite':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Enflammé', type: 'flow' },
          { id: 'out_target', name: 'Entité', type: 'entity' },
        ],
      };
    case 'OnExtinguish':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Éteint', type: 'flow' },
          { id: 'out_target', name: 'Entité', type: 'entity' },
        ],
      };
    case 'OnRainStart':
      return {
        inputs: [],
        outputs: [
          { id: 'out_flow', name: 'Début Pluie', type: 'flow' },
          { id: 'out_intensity', name: 'Intensité', type: 'number' },
        ],
      };
    case 'OnRainStop':
      return {
        inputs: [],
        outputs: [{ id: 'out_flow', name: 'Fin Pluie', type: 'flow' }],
      };
    case 'SetWind':
      return {
        inputs: [
          { id: 'in_flow', name: 'Définir', type: 'flow' },
          { id: 'in_speed', name: 'Vitesse (km/h)', type: 'number' },
          { id: 'in_gust', name: 'Rafales (0-1)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ApplyWindForce':
      return {
        inputs: [
          { id: 'in_flow', name: 'Pousser', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
          { id: 'in_force', name: 'Force (N)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'GetWind':
      return {
        inputs: [{ id: 'in_flow', name: 'Mesurer', type: 'flow' }],
        outputs: [
          { id: 'out_val', name: 'Vitesse (km/h)', type: 'number' },
          { id: 'out_dir', name: 'Direction', type: 'vector' },
        ],
      };
    case 'IgniteEntity':
      return {
        inputs: [
          { id: 'in_flow', name: 'Enflammer', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'ExtinguishEntity':
      return {
        inputs: [
          { id: 'in_flow', name: 'Éteindre', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'CheckIsBurning':
      return {
        inputs: [
          { id: 'in_flow', name: 'Vérifier', type: 'flow' },
          { id: 'in_target', name: 'Cible', type: 'entity' },
        ],
        outputs: [
          { id: 'out_true', name: 'En Feu', type: 'flow' },
          { id: 'out_false', name: 'Éteint', type: 'flow' },
        ],
      };
    case 'SetRain':
      return {
        inputs: [
          { id: 'in_flow', name: 'Contrôler', type: 'flow' },
          { id: 'in_intensity', name: 'Intensité (0-1)', type: 'number' },
          { id: 'in_size', name: 'Taille Gouttes (0.2-3)', type: 'number' },
        ],
        outputs: [{ id: 'out_flow', name: 'Then', type: 'flow' }],
      };
    case 'CheckIsRaining':
      return {
        inputs: [{ id: 'in_flow', name: 'Vérifier', type: 'flow' }],
        outputs: [
          { id: 'out_true', name: 'Pluie Active', type: 'flow' },
          { id: 'out_false', name: 'Temps Sec', type: 'flow' },
        ],
      };
  }
}

/**
 * Creates a default GraphNode with standard sockets and initial values
 */
export function createGraphNode(
  type: NodeType,
  x: number,
  y: number,
  initialValues: Record<string, any> = {}
): GraphNodeData {
  const { inputs, outputs } = getSocketsForNodeType(type);
  const id = `node_${type.toLowerCase()}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  let category: GraphNodeData['category'] = 'action';
  if (type.startsWith('On')) category = 'event';
  else if (['IfElse', 'Compare', 'Gate', 'Math', 'Clamp', 'Lerp', 'Random', 'Toggle', 'Counter', 'Delay'].includes(type)) category = 'logic';

  let title: string = type;
  // Events
  if (type === 'OnStart') title = 'Au Lancement (Start)';
  if (type === 'OnUpdate') title = 'À Chaque Frame (Update)';
  if (type === 'OnCollision') title = 'Sur Collision';
  if (type === 'OnClick') title = 'Sur Clic Objet';
  if (type === 'OnKeyPress') title = 'Touche Clavier';
  if (type === 'OnTriggerEnter') title = 'Sur Entrée Zone';
  if (type === 'OnTriggerExit') title = 'Sur Sortie Zone';
  if (type === 'OnTimer') title = 'Minuteur (Timer)';
  if (type === 'OnCustomEvent') title = 'Événement Reçu';

  // Logic
  if (type === 'IfElse') title = 'Si / Sinon (If/Else)';
  if (type === 'Compare') title = 'Comparer (A vs B)';
  if (type === 'Gate') title = 'Porte Logique (AND/OR)';
  if (type === 'Math') title = 'Opération Math';
  if (type === 'Clamp') title = 'Borner (Clamp)';
  if (type === 'Lerp') title = 'Interpolation (Lerp)';
  if (type === 'Random') title = 'Aléatoire (Random)';
  if (type === 'Toggle') title = 'Bascule (Flip-Flop)';
  if (type === 'Counter') title = 'Compteur (Counter)';
  if (type === 'Delay') title = 'Délai (Attendre)';

  // Actions
  if (type === 'ApplyImpulse') title = 'Appliquer Impulsion';
  if (type === 'SetPosition') title = 'Définir Position';
  if (type === 'SetRotation') title = 'Définir Rotation';
  if (type === 'SetScale') title = 'Définir Échelle';
  if (type === 'SetColor') title = 'Changer Couleur';
  if (type === 'PlaySound') title = 'Jouer Son';
  if (type === 'DestroyEntity') title = 'Détruire Entité';
  if (type === 'SetVariable') title = 'Modifier Variable';
  if (type === 'GetVariable') title = 'Lire Variable';
  if (type === 'PlayAnimation') title = 'Jouer Animation / Trajectoire';
  if (type === 'PauseAnimation') title = 'Pause Animation';
  if (type === 'ReverseAnimation') title = 'Inverser Animation (Reverse)';
  if (type === 'SpawnPrefab') title = 'Faire Apparaître';
  if (type === 'PrintLog') title = 'Afficher Message';
  if (type === 'CameraShake') title = 'Secousse Caméra';
  if (type === 'ShootProjectile') title = 'Tirer un Projectile (Feu/Laser)';

  // AI & NPC Navigation
  if (type === 'FollowTarget') title = 'Suivre Cible (AI Follow)';
  if (type === 'PatrolWaypoints') title = 'Patrouille Balises (Waypoints)';
  if (type === 'CheckDistance') title = 'Vérifier Distance';
  if (type === 'LookAtPlayer') title = 'Orienter vers Joueur';
  if (type === 'CheckEnemyVision') title = 'Détection Cône de Vision (AI FOV)';
  if (type === 'DealDamage') title = 'Infliger Dégâts (-HP & Popup)';
  if (type === 'CheckInventory') title = 'Vérifier Inventaire / Clé';
  if (type === 'UnlockDoor') title = 'Déverrouiller / Ouvrir Porte';

  // Dynamic Lighting
  if (type === 'SetLightColor') title = 'Définir Lumière (Couleur/Intensité)';
  if (type === 'PulseLight') title = 'Pulsation Lumineuse (Pulse)';
  if (type === 'FlickerLight') title = 'Scintillement (Flicker)';

  // Cinematics & Dialogue
  if (type === 'SwitchCamera') title = 'Changer Caméra / Plan (Cinématique)';
  if (type === 'ShowDialogue') title = 'Bannière de Dialogue & Sous-Titres';
  if (type === 'SetDepthOfField') title = 'Profondeur de Champ (DoF Blur)';

  // Spatial Audio & BGM
  if (type === 'PlaySound3D') title = 'Son Spatial 3D (Positional Audio)';
  if (type === 'PlaySFX') title = 'Effet Sonore (SFX Library)';
  if (type === 'SetBGMState') title = 'Musique Dynamique BGM (Explo/Combat)';

  const defaultValues: Record<string, any> = { ...initialValues };
  if (type === 'Compare' && !defaultValues.operator) defaultValues.operator = '==';
  if (type === 'Gate' && !defaultValues.gate) defaultValues.gate = 'AND';
  if (type === 'Math' && !defaultValues.operation) defaultValues.operation = '+';
  if (type === 'Clamp') {
    if (defaultValues.min === undefined) defaultValues.min = 0;
    if (defaultValues.max === undefined) defaultValues.max = 100;
  }
  if (type === 'Lerp') {
    if (defaultValues.t === undefined) defaultValues.t = 0.1;
  }
  if (type === 'Random') {
    if (defaultValues.min === undefined) defaultValues.min = 1;
    if (defaultValues.max === undefined) defaultValues.max = 10;
  }
  if (type === 'Counter') {
    if (defaultValues.step === undefined) defaultValues.step = 1;
    if (defaultValues.current === undefined) defaultValues.current = 0;
  }
  if (type === 'ShootProjectile') {
    if (defaultValues.speed === undefined) defaultValues.speed = 25;
    if (defaultValues.damage === undefined) defaultValues.damage = 10;
    if (defaultValues.prefabId === undefined) defaultValues.prefabId = 'Fireball';
  }
  if (type === 'Delay' && defaultValues.duration === undefined) defaultValues.duration = 1.0;
  if (type === 'OnTimer' && defaultValues.interval === undefined) defaultValues.interval = 1.0;
  if (type === 'OnCustomEvent' && !defaultValues.eventName) defaultValues.eventName = 'custom_msg';

  if (type === 'PlaySound' && !defaultValues.sound) defaultValues.sound = 'coin';
  if (type === 'ApplyImpulse') {
    if (defaultValues.force === undefined) defaultValues.force = 10;
    if (defaultValues.dirX === undefined) defaultValues.dirX = 0;
    if (defaultValues.dirY === undefined) defaultValues.dirY = 1;
    if (defaultValues.dirZ === undefined) defaultValues.dirZ = 0;
  }
  if (type === 'SetPosition') {
    if (defaultValues.posX === undefined) defaultValues.posX = 0;
    if (defaultValues.posY === undefined) defaultValues.posY = 0;
    if (defaultValues.posZ === undefined) defaultValues.posZ = 0;
  }
  if (type === 'SetRotation') {
    if (defaultValues.rotY === undefined) defaultValues.rotY = 90;
  }
  if (type === 'SetScale' && defaultValues.scale === undefined) defaultValues.scale = 1.5;
  if (type === 'SetColor' && !defaultValues.color) defaultValues.color = '#10b981';
  if (type === 'SetVariable') {
    if (!defaultValues.variable) defaultValues.variable = 'Score';
    if (defaultValues.operation === undefined) defaultValues.operation = 'add';
    if (defaultValues.amount === undefined) defaultValues.amount = 10;
  }
  if (type === 'GetVariable' && !defaultValues.variable) defaultValues.variable = 'Score';
  if (type === 'OnKeyPress' && !defaultValues.key) defaultValues.key = 'Space';
  if (type === 'PlayAnimation' && !defaultValues.anim) defaultValues.anim = 'bounce';
  if (type === 'SpawnPrefab') {
    if (!defaultValues.prefab) defaultValues.prefab = 'coin';
    if (defaultValues.offsetX === undefined) defaultValues.offsetX = 0;
    if (defaultValues.offsetY === undefined) defaultValues.offsetY = 1.5;
    if (defaultValues.offsetZ === undefined) defaultValues.offsetZ = 0;
  }
  if (type === 'PrintLog' && !defaultValues.message) defaultValues.message = 'Objectif atteint !';
  if (type === 'CameraShake' && defaultValues.intensity === undefined) defaultValues.intensity = 0.5;

  if (type === 'FollowTarget') {
    if (defaultValues.speed === undefined) defaultValues.speed = 3.5;
    if (defaultValues.stopDistance === undefined) defaultValues.stopDistance = 1.2;
  }
  if (type === 'PatrolWaypoints') {
    if (defaultValues.speed === undefined) defaultValues.speed = 2.5;
  }
  if (type === 'CheckDistance') {
    if (defaultValues.threshold === undefined) defaultValues.threshold = 8.0;
  }
  if (type === 'SetLightColor') {
    if (!defaultValues.color) defaultValues.color = '#38bdf8';
    if (defaultValues.intensity === undefined) defaultValues.intensity = 5.0;
  }
  if (type === 'PulseLight') {
    if (defaultValues.min === undefined) defaultValues.min = 1.0;
    if (defaultValues.max === undefined) defaultValues.max = 8.0;
    if (defaultValues.frequency === undefined) defaultValues.frequency = 3.0;
  }
  if (type === 'FlickerLight') {
    if (defaultValues.speed === undefined) defaultValues.speed = 10.0;
    if (defaultValues.randomness === undefined) defaultValues.randomness = 0.6;
  }

  return {
    id,
    type,
    title,
    category,
    position: { x, y },
    inputs,
    outputs,
    values: defaultValues,
  };
}

/**
 * convertBehaviorToNodes:
 * Seamlessly transforms any Level 1 Behavior Card into a fully connected, editable Level 2 Node Graph!
 */
export function convertBehaviorToNodes(card: BehaviorCard): NodeGraphData {
  const nodes: GraphNodeData[] = [];
  const connections: GraphConnection[] = [];

  switch (card.type) {
    case 'Collectable': {
      const cfg = card.config as CollectableConfig;
      // 1. OnCollision Event Node
      const onCollisionNode = createGraphNode('OnCollision', 80, 120);
      nodes.push(onCollisionNode);

      // 2. Play Sound Node
      const playSoundNode = createGraphNode('PlaySound', 360, 80, {
        sound: cfg.soundPreset || 'coin',
      });
      nodes.push(playSoundNode);

      // 3. SetVariable (Score) Node
      const setVarNode = createGraphNode('SetVariable', 620, 80, {
        variable: 'Score',
        operation: 'add',
        amount: cfg.scoreValue ?? 10,
      });
      nodes.push(setVarNode);

      // 4. DestroyEntity Node
      const destroyNode = createGraphNode('DestroyEntity', 880, 80, {
        target: 'self',
      });
      nodes.push(destroyNode);

      // 5. OnUpdate Animation (Spin & Hover)
      const onUpdateNode = createGraphNode('OnUpdate', 80, 360);
      nodes.push(onUpdateNode);

      const animNode = createGraphNode('PlayAnimation', 360, 360, {
        anim: 'spin',
        speed: cfg.rotateSpeed ?? 90,
      });
      nodes.push(animNode);

      // Connections
      connections.push(
        {
          id: `c_${Date.now()}_1`,
          fromNodeId: onCollisionNode.id,
          fromSocketId: 'out_flow',
          toNodeId: playSoundNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_2`,
          fromNodeId: playSoundNode.id,
          fromSocketId: 'out_flow',
          toNodeId: setVarNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_3`,
          fromNodeId: setVarNode.id,
          fromSocketId: 'out_flow',
          toNodeId: destroyNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_4`,
          fromNodeId: onUpdateNode.id,
          fromSocketId: 'out_flow',
          toNodeId: animNode.id,
          toSocketId: 'in_flow',
        }
      );
      break;
    }

    case 'Patrol': {
      const cfg = card.config as PatrolConfig;
      // 1. OnUpdate Event
      const onUpdateNode = createGraphNode('OnUpdate', 80, 150);
      nodes.push(onUpdateNode);

      // 2. PlayAnimation Patrol
      const animNode = createGraphNode('PlayAnimation', 360, 150, {
        anim: 'patrol',
        axis: cfg.axis || 'x',
        speed: cfg.speed || 3.0,
        distance: cfg.distance || 6.0,
      });
      nodes.push(animNode);

      connections.push({
        id: `c_${Date.now()}_1`,
        fromNodeId: onUpdateNode.id,
        fromSocketId: 'out_flow',
        toNodeId: animNode.id,
        toSocketId: 'in_flow',
      });
      break;
    }

    case 'TriggerZone': {
      const cfg = card.config as TriggerZoneConfig;
      // 1. OnTriggerEnter Event
      const triggerNode = createGraphNode('OnTriggerEnter', 80, 150, {
        radius: cfg.radius || 3.0,
        targetTag: cfg.triggerOn || 'Player',
      });
      nodes.push(triggerNode);

      // 2. PlaySound Node
      const playSoundNode = createGraphNode('PlaySound', 360, 120, {
        sound: cfg.soundPreset || 'chime',
      });
      nodes.push(playSoundNode);

      // 3. PlayAnimation Node (Pulse)
      const animNode = createGraphNode('PlayAnimation', 640, 120, {
        anim: 'pulse',
      });
      nodes.push(animNode);

      connections.push(
        {
          id: `c_${Date.now()}_1`,
          fromNodeId: triggerNode.id,
          fromSocketId: 'out_flow',
          toNodeId: playSoundNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_2`,
          fromNodeId: playSoundNode.id,
          fromSocketId: 'out_flow',
          toNodeId: animNode.id,
          toSocketId: 'in_flow',
        }
      );
      break;
    }

    case 'DamageOnTouch': {
      const cfg = card.config as DamageOnTouchConfig;
      // 1. OnCollision Event
      const onCollisionNode = createGraphNode('OnCollision', 80, 150);
      nodes.push(onCollisionNode);

      // 2. PlaySound (hit)
      const playSoundNode = createGraphNode('PlaySound', 360, 100, {
        sound: cfg.soundPreset || 'hit',
      });
      nodes.push(playSoundNode);

      // 3. ApplyImpulse (Knockback)
      const impulseNode = createGraphNode('ApplyImpulse', 620, 100, {
        force: cfg.knockbackForce || 8.0,
        dirX: 0,
        dirY: 0.8,
        dirZ: -1,
      });
      nodes.push(impulseNode);

      // 4. SetVariable (PlayerHealth)
      const healthNode = createGraphNode('SetVariable', 880, 100, {
        variable: 'Health',
        operation: 'subtract',
        amount: cfg.damage || 25,
      });
      nodes.push(healthNode);

      connections.push(
        {
          id: `c_${Date.now()}_1`,
          fromNodeId: onCollisionNode.id,
          fromSocketId: 'out_flow',
          toNodeId: playSoundNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_2`,
          fromNodeId: playSoundNode.id,
          fromSocketId: 'out_flow',
          toNodeId: impulseNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_3`,
          fromNodeId: impulseNode.id,
          fromSocketId: 'out_flow',
          toNodeId: healthNode.id,
          toSocketId: 'in_flow',
        }
      );
      break;
    }

    case 'WindZone': {
      const onStartNode = createGraphNode('OnStart', 80, 150);
      nodes.push(onStartNode);

      const applyWindNode = createGraphNode('ApplyWindForce', 360, 150, {
        force: (card.config as any)?.force || 25,
        dirX: 0,
        dirY: 1,
        dirZ: 0,
      });
      nodes.push(applyWindNode);

      connections.push({
        id: `c_${Date.now()}_1`,
        fromNodeId: onStartNode.id,
        fromSocketId: 'out_flow',
        toNodeId: applyWindNode.id,
        toSocketId: 'in_flow',
      });
      break;
    }

    case 'Flammable': {
      const onIgniteNode = createGraphNode('OnIgnite', 80, 150);
      nodes.push(onIgniteNode);

      const playSfxNode = createGraphNode('PlaySFX', 360, 100, {
        preset: 'explosion',
      });
      nodes.push(playSfxNode);

      const emitParticlesNode = createGraphNode('EmitParticles', 640, 100, {
        preset: 'fire',
        rate: 30,
      });
      nodes.push(emitParticlesNode);

      connections.push(
        {
          id: `c_${Date.now()}_1`,
          fromNodeId: onIgniteNode.id,
          fromSocketId: 'out_flow',
          toNodeId: playSfxNode.id,
          toSocketId: 'in_flow',
        },
        {
          id: `c_${Date.now()}_2`,
          fromNodeId: playSfxNode.id,
          fromSocketId: 'out_flow',
          toNodeId: emitParticlesNode.id,
          toSocketId: 'in_flow',
        }
      );
      break;
    }

    case 'WeatherListener': {
      const onRainNode = createGraphNode('OnRainStart', 80, 150);
      nodes.push(onRainNode);

      const extinguishNode = createGraphNode('ExtinguishEntity', 360, 150);
      nodes.push(extinguishNode);

      connections.push({
        id: `c_${Date.now()}_1`,
        fromNodeId: onRainNode.id,
        fromSocketId: 'out_flow',
        toNodeId: extinguishNode.id,
        toSocketId: 'in_flow',
      });
      break;
    }
  }

  return {
    enabled: true,
    nodes,
    connections,
    variables: { Score: 0, Health: 100 },
  };
}
