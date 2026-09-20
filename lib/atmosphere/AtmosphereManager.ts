import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { CelShaderPass } from '../vfx/CelShaderPass';
import {
  AtmosphereData,
  PostProcessingData,
  DEFAULT_ATMOSPHERE,
  DEFAULT_POST_PROCESSING,
  SkyPreset,
  DayNightCycleConfig,
} from '../../types/atmosphere';

// =========================================================================
// CONTACT SHADOW / SSAO SHADER
// =========================================================================

const ContactSSAOShader = {
  name: 'ContactSSAOShader',
  uniforms: {
    tDiffuse: { value: null },
    radius: { value: 0.8 },
    intensity: { value: 1.2 },
    bias: { value: 0.02 },
    enableSSAO: { value: 0.0 },
    resolution: { value: new THREE.Vector2(1920, 1080) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float radius;
    uniform float intensity;
    uniform float bias;
    uniform float enableSSAO;
    uniform vec2 resolution;
    varying vec2 vUv;

    void main() {
      vec4 centerColor = texture2D(tDiffuse, vUv);
      if (enableSSAO < 0.5) {
        gl_FragColor = centerColor;
        return;
      }

      // Screen-space contact occlusion kernel (Poisson disc sampling)
      vec2 texel = 1.0 / resolution;
      float occlusion = 0.0;
      float centerLum = dot(centerColor.rgb, vec3(0.299, 0.587, 0.114));

      vec2 samples[8];
      samples[0] = vec2( 0.0,  1.0);
      samples[1] = vec2( 0.7,  0.7);
      samples[2] = vec2( 1.0,  0.0);
      samples[3] = vec2( 0.7, -0.7);
      samples[4] = vec2( 0.0, -1.0);
      samples[5] = vec2(-0.7, -0.7);
      samples[6] = vec2(-1.0,  0.0);
      samples[7] = vec2(-0.7,  0.7);

      float r = radius * 4.0;
      for (int i = 0; i < 8; i++) {
        vec2 sampleUv = vUv + samples[i] * texel * r;
        vec4 sampleColor = texture2D(tDiffuse, sampleUv);
        float sampleLum = dot(sampleColor.rgb, vec3(0.299, 0.587, 0.114));

        // Detect dark crevices and depth differences
        float diff = centerLum - sampleLum;
        if (diff > bias && diff < 0.6) {
          occlusion += (diff - bias) * intensity;
        }
      }

      occlusion = clamp(occlusion / 8.0, 0.0, 0.75);
      vec3 finalColor = centerColor.rgb * (1.0 - occlusion);

      gl_FragColor = vec4(finalColor, centerColor.a);
    }
  `,
};

// Custom Post-Processing Shader (Vignette, ToneMapping, Saturation, Contrast, Chromatic Aberration)
const ColorCorrectionShader = {
  name: 'ColorCorrectionShader',
  uniforms: {
    tDiffuse: { value: null },
    vignetteDarkness: { value: 0.9 },
    vignetteOffset: { value: 1.1 },
    exposure: { value: 1.1 },
    contrast: { value: 1.05 },
    saturation: { value: 1.1 },
    chromaticAberration: { value: 0.0 },
    enableVignette: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteDarkness;
    uniform float vignetteOffset;
    uniform float exposure;
    uniform float contrast;
    uniform float saturation;
    uniform float chromaticAberration;
    uniform float enableVignette;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec4 color;

      if (chromaticAberration > 0.0001) {
        vec2 dist = (uv - 0.5) * chromaticAberration;
        float r = texture2D(tDiffuse, uv + dist).r;
        float g = texture2D(tDiffuse, uv).g;
        float b = texture2D(tDiffuse, uv - dist).b;
        color = vec4(r, g, b, 1.0);
      } else {
        color = texture2D(tDiffuse, uv);
      }

      // Exposure
      vec3 rgb = color.rgb * exposure;

      // Contrast
      rgb = (rgb - 0.5) * contrast + 0.5;

      // Saturation
      float gray = dot(rgb, vec3(0.299, 0.587, 0.114));
      rgb = mix(vec3(gray), rgb, saturation);

      // Vignette
      if (enableVignette > 0.5) {
        vec2 center = uv - vec2(0.5);
        float dist = length(center);
        float vig = smoothstep(0.8, vignetteOffset * 0.799, dist * (vignetteDarkness + 0.5));
        rgb *= clamp(vig, 0.0, 1.0);
      }

      gl_FragColor = vec4(rgb, color.a);
    }
  `,
};

// Dynamic Sky Dome with Celestial Sun & Moon & Twinkling Stars
const SkyDomeShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform vec3 sunColor;
    uniform vec3 sunDirection;
    uniform float sunIntensity;
    uniform vec3 moonColor;
    uniform vec3 moonDirection;
    uniform float moonIntensity;
    uniform float starsIntensity;
    uniform float time;
    varying vec3 vWorldPosition;

    // Pseudo-random hash for stars
    float hash(vec3 p) {
      p = fract(p * 0.3183099 + 0.1);
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = max(0.0, dir.y);
      vec3 sky = mix(bottomColor, topColor, pow(h, 0.6));

      // 1. Sun disc & atmospheric glow
      float sunDot = max(0.0, dot(dir, normalize(sunDirection)));
      if (sunDirection.y > -0.2) {
        float sunGlow = pow(sunDot, 64.0) * 1.5;
        float sunDisc = smoothstep(0.998, 0.9995, sunDot) * 4.0;
        sky += (sunColor * (sunGlow + sunDisc)) * max(0.0, sunIntensity);
      }

      // 2. Moon disc & cool halo
      if (moonIntensity > 0.01) {
        float moonDot = max(0.0, dot(dir, normalize(moonDirection)));
        float moonGlow = pow(moonDot, 48.0) * 0.8;
        float moonDisc = smoothstep(0.9975, 0.9992, moonDot) * 3.5;
        sky += (moonColor * (moonGlow + moonDisc)) * moonIntensity * 0.8;
      }

      // 3. Procedural Twinkling Stars Dome at Night
      if (starsIntensity > 0.01 && h > 0.05) {
        vec3 starCoord = floor(dir * 180.0);
        float starRand = hash(starCoord);
        if (starRand > 0.985) {
          float twinkle = sin(time * 3.0 + starRand * 6.28) * 0.3 + 0.7;
          float starBrightness = pow((starRand - 0.985) / 0.015, 3.0) * twinkle * starsIntensity * h;
          sky += vec3(0.85, 0.92, 1.0) * starBrightness;
        }
      }

      gl_FragColor = vec4(sky, 1.0);
    }
  `,
};

export class AtmosphereManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private dirLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;

  private skyMesh!: THREE.Mesh;
  private skyMaterial!: THREE.ShaderMaterial;

  public atmosphere: AtmosphereData;
  public postProcessing: PostProcessingData;

  // Post-processing Composer
  public composer: EffectComposer | null = null;
  public bloomPass: UnrealBloomPass | null = null;
  public ssaoPass: ShaderPass | null = null;
  public colorPass: ShaderPass | null = null;
  public celShaderPass: CelShaderPass | null = null;
  public renderPass: RenderPass | null = null;

  // Internal time tracking
  private internalTime: number = 0;
  public onTimeChange?: (timeOfDay: number) => void;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    renderer: THREE.WebGLRenderer,
    dirLight: THREE.DirectionalLight,
    ambientLight: THREE.AmbientLight,
    initialAtmosphere?: AtmosphereData,
    initialPostProcessing?: PostProcessingData
  ) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.dirLight = dirLight;
    this.ambientLight = ambientLight;

    this.atmosphere = initialAtmosphere ? { ...initialAtmosphere } : { ...DEFAULT_ATMOSPHERE };
    this.postProcessing = initialPostProcessing
      ? { ...initialPostProcessing }
      : { ...DEFAULT_POST_PROCESSING };

    this.initSky();
    this.initPostProcessing();
    this.applyAtmosphere(this.atmosphere);
    this.applyPostProcessing(this.postProcessing);
  }

  private initSky(): void {
    const skyGeo = new THREE.SphereGeometry(450, 32, 24);
    this.skyMaterial = new THREE.ShaderMaterial({
      vertexShader: SkyDomeShader.vertexShader,
      fragmentShader: SkyDomeShader.fragmentShader,
      uniforms: {
        topColor: { value: new THREE.Color(this.atmosphere.skyTopColor) },
        bottomColor: { value: new THREE.Color(this.atmosphere.skyBottomColor) },
        sunColor: { value: new THREE.Color(this.atmosphere.sunColor) },
        sunDirection: { value: new THREE.Vector3(0, 1, 0) },
        sunIntensity: { value: this.atmosphere.sunIntensity },
        moonColor: { value: new THREE.Color('#dbeafe') },
        moonDirection: { value: new THREE.Vector3(0, -1, 0) },
        moonIntensity: { value: 0.0 },
        starsIntensity: { value: 0.0 },
        time: { value: 0.0 },
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMaterial);
    this.skyMesh.name = '__AETHER_SKY_DOME__';
    this.scene.add(this.skyMesh);
  }

  public initPostProcessing(): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    const pixelRatio = this.renderer.getPixelRatio();

    this.composer = new EffectComposer(this.renderer);
    this.composer.setSize(size.x, size.y);
    this.composer.setPixelRatio(pixelRatio);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    // 1. Unreal Bloom Pass
    const bloom = this.postProcessing.bloom;
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x, size.y),
      bloom.strength,
      bloom.radius,
      bloom.threshold
    );
    this.bloomPass.enabled = bloom.enabled;
    this.composer.addPass(this.bloomPass);

    // 2. SSAO / Contact Shadows Pass
    this.ssaoPass = new ShaderPass(ContactSSAOShader);
    this.updateSSAOPassUniforms();
    this.composer.addPass(this.ssaoPass);

    // 3. Color Correction & Vignette Pass
    this.colorPass = new ShaderPass(ColorCorrectionShader);
    this.updateColorPassUniforms();
    this.composer.addPass(this.colorPass);
    
    this.celShaderPass = new CelShaderPass();
    this.celShaderPass.setEnabled(false);
    this.celShaderPass.setResolution(size.x, size.y);
    this.composer.addPass(this.celShaderPass);

    // 4. Final Output Pass
    const outputPass = new OutputPass();
    this.composer.addPass(outputPass);
  }

  public set2DModeEnabled(enabled: boolean): void {
    if (this.celShaderPass) {
      this.celShaderPass.setEnabled(enabled);
    }
  }

  private updateSSAOPassUniforms(): void {
    if (!this.ssaoPass) return;
    const ssao = this.postProcessing.ssao;
    const size = this.renderer.getSize(new THREE.Vector2());
    const u = this.ssaoPass.uniforms;

    if (ssao) {
      u.enableSSAO.value = this.postProcessing.enabled && ssao.enabled ? 1.0 : 0.0;
      u.radius.value = ssao.radius;
      u.intensity.value = ssao.intensity;
      u.bias.value = ssao.bias;
    } else {
      u.enableSSAO.value = 0.0;
    }
    u.resolution.value.set(Math.max(size.x, 1), Math.max(size.y, 1));
  }

  private updateColorPassUniforms(): void {
    if (!this.colorPass) return;
    const pp = this.postProcessing;
    const u = this.colorPass.uniforms;

    u.vignetteDarkness.value = pp.vignette.darkness;
    u.vignetteOffset.value = pp.vignette.offset;
    u.exposure.value = pp.colorGrading.exposure;
    u.contrast.value = pp.colorGrading.contrast;
    u.saturation.value = pp.colorGrading.saturation;
    u.chromaticAberration.value = pp.chromaticAberration.enabled
      ? pp.chromaticAberration.intensity
      : 0;
    u.enableVignette.value = pp.vignette.enabled ? 1.0 : 0.0;
  }

  public setSize(width: number, height: number): void {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(width, height);
    }
    if (this.ssaoPass) {
      this.ssaoPass.uniforms.resolution.value.set(width, height);
    }
    if (this.celShaderPass) {
      this.celShaderPass.setResolution(width, height);
    }
  }

  public applyAtmosphere(data: Partial<AtmosphereData>): void {
    this.atmosphere = { ...this.atmosphere, ...data };
    const atm = this.atmosphere;

    // Check if Day/Night cycle is active and calculates celestial angles
    if (atm.dayNightCycle && atm.dayNightCycle.enabled) {
      this.updateDayNightColors(atm.dayNightCycle.timeOfDay);
      return;
    }

    // Standard static sun position calculation
    const azimuthRad = THREE.MathUtils.degToRad(atm.sunPosition.azimuth);
    const elevationRad = THREE.MathUtils.degToRad(atm.sunPosition.elevation);
    const radius = 35;

    const sunX = radius * Math.cos(elevationRad) * Math.sin(azimuthRad);
    const sunY = radius * Math.sin(elevationRad);
    const sunZ = radius * Math.cos(elevationRad) * Math.cos(azimuthRad);

    this.dirLight.position.set(sunX, sunY, sunZ);
    this.dirLight.color.set(atm.sunColor);
    this.dirLight.intensity = atm.sunIntensity;

    // Ambient light
    this.ambientLight.color.set(atm.ambientColor);
    this.ambientLight.intensity = atm.ambientIntensity;

    // Sky Dome Uniforms
    if (this.skyMaterial) {
      this.skyMaterial.uniforms.topColor.value.set(atm.skyTopColor);
      this.skyMaterial.uniforms.bottomColor.value.set(atm.skyBottomColor);
      this.skyMaterial.uniforms.sunColor.value.set(atm.sunColor);
      this.skyMaterial.uniforms.sunDirection.value.set(sunX, sunY, sunZ).normalize();
      this.skyMaterial.uniforms.sunIntensity.value = atm.sunIntensity;
      this.skyMaterial.uniforms.moonIntensity.value = 0.0;
      this.skyMaterial.uniforms.starsIntensity.value = 0.0;
    }

    // Fog
    if (atm.fog.enabled) {
      if (atm.fog.type === 'exponential') {
        this.scene.fog = new THREE.FogExp2(atm.fog.color, Math.min(atm.fog.density, 0.008));
      } else if (atm.fog.type === 'linear') {
        this.scene.fog = new THREE.Fog(atm.fog.color, Math.max(atm.fog.near, 15), Math.max(atm.fog.far, 120));
      } else {
        this.scene.fog = null;
      }
    } else {
      this.scene.fog = null;
    }

    if (this.skyMesh && this.skyMesh.visible) {
      this.scene.background = null;
    } else {
      this.scene.background = new THREE.Color(atm.fog.color);
    }
  }

  /**
   * Evaluates continuous Day/Night cycle colors, celestial sun/moon positions, and sky dome
   */
  public updateDayNightColors(hour: number): void {
    const cycle = this.atmosphere.dayNightCycle;
    if (!cycle) return;

    // Normalize hour 0..24
    const h = ((hour % 24) + 24) % 24;

    // Sun angle: 6h = Dawn (elevation 0), 12h = Noon (elevation 90), 18h = Sunset (elevation 0), 0h = Midnight (elevation -90)
    const sunAngleRad = ((h - 6.0) / 24.0) * Math.PI * 2.0;
    const azimuthRad = THREE.MathUtils.degToRad(cycle.sunAzimuth ?? 45);
    const radius = 35;

    // Sun Position
    const sunElevation = Math.sin(sunAngleRad);
    const sunDistance = Math.cos(sunAngleRad);
    const sunX = radius * sunDistance * Math.sin(azimuthRad);
    const sunY = radius * sunElevation;
    const sunZ = radius * sunDistance * Math.cos(azimuthRad);

    // Moon Position (opposite to sun)
    const moonX = -sunX;
    const moonY = -sunY;
    const moonZ = -sunZ;

    // Interpolate Day, Sunset, Night colors based on time
    let sunCol = new THREE.Color('#ffffff');
    let sunInt = 2.0;
    let ambCol = new THREE.Color('#ffffff');
    let ambInt = 1.0;
    let topCol = new THREE.Color('#0284c7');
    let botCol = new THREE.Color('#38bdf8');
    let starsInt = 0.0;
    let moonInt = 0.0;
    let fogCol = '#0f172a';

    if (h >= 5.0 && h < 7.5) {
      // DAWN / SUNRISE (5h to 7.5h)
      const t = (h - 5.0) / 2.5;
      sunCol = new THREE.Color('#ff7849').lerp(new THREE.Color('#fff4e0'), t);
      sunInt = 0.5 + t * 1.7;
      ambCol = new THREE.Color('#fbbf24').lerp(new THREE.Color('#e0f2fe'), t);
      ambInt = 0.3 + t * 0.7;
      topCol = new THREE.Color('#1e1b4b').lerp(new THREE.Color('#0284c7'), t);
      botCol = new THREE.Color('#f97316').lerp(new THREE.Color('#7dd3fc'), t);
      starsInt = Math.max(0.0, 1.0 - t * 1.5) * (cycle.starsIntensity ?? 1.0);
      fogCol = '#382039';
    } else if (h >= 7.5 && h < 16.5) {
      // DAYLIGHT (7.5h to 16.5h)
      sunCol = new THREE.Color('#fffdf5');
      sunInt = 2.2;
      ambCol = new THREE.Color('#ffffff');
      ambInt = 1.1;
      topCol = new THREE.Color('#0284c7');
      botCol = new THREE.Color('#7dd3fc');
      starsInt = 0.0;
      fogCol = '#0f172a';
    } else if (h >= 16.5 && h < 19.5) {
      // SUNSET / GOLDEN HOUR (16.5h to 19.5h)
      const t = (h - 16.5) / 3.0;
      sunCol = new THREE.Color('#fbbf24').lerp(new THREE.Color('#ea580c'), t);
      sunInt = 2.2 - t * 1.2;
      ambCol = new THREE.Color('#fed7aa').lerp(new THREE.Color('#311042'), t);
      ambInt = 1.0 - t * 0.6;
      topCol = new THREE.Color('#0284c7').lerp(new THREE.Color('#1e1b4b'), t);
      botCol = new THREE.Color('#7dd3fc').lerp(new THREE.Color('#f97316'), t);
      starsInt = Math.max(0.0, t - 0.5) * 2.0 * (cycle.starsIntensity ?? 1.0);
      fogCol = '#25112e';
    } else {
      // NIGHT (19.5h to 5.0h)
      sunCol = new THREE.Color('#0f172a');
      sunInt = 0.0;
      ambCol = new THREE.Color('#1e1b4b');
      ambInt = 0.25;
      topCol = new THREE.Color('#020617');
      botCol = new THREE.Color('#0f172a');
      starsInt = 1.0 * (cycle.starsIntensity ?? 1.0);
      moonInt = (cycle.moonIntensity ?? 1.2);
      fogCol = '#020617';
    }

    // Apply lighting
    if (sunElevation > 0.05) {
      this.dirLight.position.set(sunX, sunY, sunZ);
      this.dirLight.color.copy(sunCol);
      this.dirLight.intensity = sunInt;
    } else {
      // Moonlight takes over directional shadows
      this.dirLight.position.set(moonX, moonY, moonZ);
      this.dirLight.color.set('#c7d2fe');
      this.dirLight.intensity = Math.max(0.2, moonInt * 0.6);
    }

    this.ambientLight.color.copy(ambCol);
    this.ambientLight.intensity = ambInt;

    // Sky Dome update
    if (this.skyMaterial) {
      const u = this.skyMaterial.uniforms;
      u.topColor.value.copy(topCol);
      u.bottomColor.value.copy(botCol);
      u.sunColor.value.copy(sunCol);
      u.sunDirection.value.set(sunX, sunY, sunZ).normalize();
      u.sunIntensity.value = sunInt;
      u.moonColor.value.set('#dbeafe');
      u.moonDirection.value.set(moonX, moonY, moonZ).normalize();
      u.moonIntensity.value = moonInt;
      u.starsIntensity.value = starsInt;
      u.time.value = this.internalTime;
    }

    // Dynamic Fog at Night/Day
    if (this.atmosphere.fog.enabled) {
      if (this.atmosphere.fog.type === 'exponential') {
        this.scene.fog = new THREE.FogExp2(fogCol, Math.min(this.atmosphere.fog.density, 0.008));
      } else if (this.atmosphere.fog.type === 'linear') {
        this.scene.fog = new THREE.Fog(fogCol, Math.max(this.atmosphere.fog.near, 15), Math.max(this.atmosphere.fog.far, 120));
      }
    }
  }

  public update(dt: number): void {
    this.internalTime += dt;

    if (this.skyMaterial) {
      this.skyMaterial.uniforms.time.value = this.internalTime;
    }

    // Step automated Day/Night cycle
    const cycle = this.atmosphere.dayNightCycle;
    if (cycle && cycle.enabled && !cycle.isPaused) {
      const cycleDuration = Math.max(0.5, cycle.durationMinutes) * 60; // seconds for 24h
      const hoursPerSec = 24.0 / cycleDuration;
      cycle.timeOfDay = (cycle.timeOfDay + dt * hoursPerSec) % 24.0;

      this.updateDayNightColors(cycle.timeOfDay);

      if (this.onTimeChange) {
        this.onTimeChange(cycle.timeOfDay);
      }
    }
  }

  public updateAtmosphere(data: Partial<AtmosphereData>): void {
    this.applyAtmosphere(data);
  }

  public updatePostProcessing(data: Partial<PostProcessingData>): void {
    this.applyPostProcessing(data);
  }

  public applyPreset(preset: SkyPreset): void {
    let update: Partial<AtmosphereData> = { skyPreset: preset };

    switch (preset) {
      case 'daylight':
        update = {
          skyPreset: 'daylight',
          sunPosition: { azimuth: 45, elevation: 55 },
          sunColor: '#fff8eb',
          sunIntensity: 2.2,
          ambientColor: '#ffffff',
          ambientIntensity: 0.75,
          skyTopColor: '#0284c7',
          skyBottomColor: '#7dd3fc',
          groundColor: '#0f172a',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#0c0e14',
            density: 0.012,
            near: 10,
            far: 100,
          },
        };
        break;

      case 'sunset':
        update = {
          skyPreset: 'sunset',
          sunPosition: { azimuth: 260, elevation: 12 },
          sunColor: '#ff6b35',
          sunIntensity: 3.2,
          ambientColor: '#818cf8',
          ambientIntensity: 0.6,
          skyTopColor: '#311042',
          skyBottomColor: '#f97316',
          groundColor: '#180e29',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#240b36',
            density: 0.02,
            near: 10,
            far: 75,
          },
        };
        break;

      case 'golden_hour':
        update = {
          skyPreset: 'golden_hour',
          sunPosition: { azimuth: 235, elevation: 22 },
          sunColor: '#fbbf24',
          sunIntensity: 2.8,
          ambientColor: '#fed7aa',
          ambientIntensity: 0.7,
          skyTopColor: '#0369a1',
          skyBottomColor: '#fde047',
          groundColor: '#1c1917',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#1e1b18',
            density: 0.015,
            near: 15,
            far: 90,
          },
        };
        break;

      case 'cyberpunk':
        update = {
          skyPreset: 'cyberpunk',
          sunPosition: { azimuth: 180, elevation: 18 },
          sunColor: '#ec4899',
          sunIntensity: 2.5,
          ambientColor: '#06b6d4',
          ambientIntensity: 0.8,
          skyTopColor: '#090514',
          skyBottomColor: '#701a75',
          groundColor: '#020617',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#090214',
            density: 0.022,
            near: 5,
            far: 60,
          },
        };
        break;

      case 'scifi_night':
        update = {
          skyPreset: 'scifi_night',
          sunPosition: { azimuth: 0, elevation: 8 },
          sunColor: '#38bdf8',
          sunIntensity: 1.2,
          ambientColor: '#1e1b4b',
          ambientIntensity: 0.5,
          skyTopColor: '#020617',
          skyBottomColor: '#0f172a',
          groundColor: '#020617',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#020617',
            density: 0.028,
            near: 5,
            far: 50,
          },
        };
        break;

      case 'overcast':
        update = {
          skyPreset: 'overcast',
          sunPosition: { azimuth: 90, elevation: 60 },
          sunColor: '#cbd5e1',
          sunIntensity: 1.4,
          ambientColor: '#94a3b8',
          ambientIntensity: 0.9,
          skyTopColor: '#475569',
          skyBottomColor: '#94a3b8',
          groundColor: '#1e293b',
          fog: {
            enabled: true,
            type: 'exponential',
            color: '#334155',
            density: 0.035,
            near: 5,
            far: 45,
          },
        };
        break;
    }

    this.applyAtmosphere(update);
  }

  public applyPostProcessing(data: Partial<PostProcessingData>): void {
    this.postProcessing = { ...this.postProcessing, ...data };
    const pp = this.postProcessing;

    if (this.bloomPass) {
      this.bloomPass.enabled = pp.enabled && pp.bloom.enabled;
      this.bloomPass.strength = pp.bloom.strength;
      this.bloomPass.radius = pp.bloom.radius;
      this.bloomPass.threshold = pp.bloom.threshold;
    }

    this.updateSSAOPassUniforms();
    this.updateColorPassUniforms();
  }

  public render(deltaTime: number): void {
    if (this.postProcessing.enabled && this.composer) {
      this.composer.render(deltaTime);
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public dispose(): void {
    if (this.skyMesh) {
      this.scene.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      this.skyMaterial.dispose();
    }
    if (this.composer) {
      this.composer.dispose();
    }
  }
}
