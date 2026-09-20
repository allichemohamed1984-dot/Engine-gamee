import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

/**
 * Cel-Shading & Toon 2D Post-Processing Shader
 * Quantizes colors into discrete bands and applies edge outlines.
 */
export const CelShader = {
  uniforms: {
    'tDiffuse': { value: null },
    'resolution': { value: new THREE.Vector2(typeof window !== 'undefined' ? window.innerWidth : 1920, typeof window !== 'undefined' ? window.innerHeight : 1080) },
    'enabled': { value: false },
    'colorLevels': { value: 4.0 }, // Number of color steps for toon shading
    'outlineStrength': { value: 1.0 },
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
    uniform vec2 resolution;
    uniform bool enabled;
    uniform float colorLevels;
    uniform float outlineStrength;
    varying vec2 vUv;

    void main() {
      if (!enabled) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 texelSize = 1.0 / resolution;
      
      // Sample neighbor pixels for edge detection (outline)
      vec4 center = texture2D(tDiffuse, vUv);
      vec4 top = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y) * 1.5);
      vec4 bottom = texture2D(tDiffuse, vUv - vec2(0.0, texelSize.y) * 1.5);
      vec4 left = texture2D(tDiffuse, vUv - vec2(texelSize.x, 0.0) * 1.5);
      vec4 right = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0) * 1.5);

      // Edge detection via luminance gradient (Sobel-like approximation)
      float lCenter = dot(center.rgb, vec3(0.299, 0.587, 0.114));
      float lTop = dot(top.rgb, vec3(0.299, 0.587, 0.114));
      float lBottom = dot(bottom.rgb, vec3(0.299, 0.587, 0.114));
      float lLeft = dot(left.rgb, vec3(0.299, 0.587, 0.114));
      float lRight = dot(right.rgb, vec3(0.299, 0.587, 0.114));

      float diffX = lRight - lLeft;
      float diffY = lTop - lBottom;
      float edge = sqrt(diffX * diffX + diffY * diffY);

      if (edge > 0.08 * outlineStrength) {
        gl_FragColor = vec4(0.05, 0.05, 0.08, 1.0); // Clean 2D cartoon outline
        return;
      }

      // Toon Shading Color Quantization (Band reduction)
      vec3 col = center.rgb;
      col = floor(col * colorLevels + 0.5) / colorLevels;

      // Slight saturation boost for vibrant 2D comic book style
      float luminance = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 grayscale = vec3(luminance);
      col = mix(grayscale, col, 1.25);

      gl_FragColor = vec4(col, center.a);
    }
  `
};

export class CelShaderPass extends ShaderPass {
  constructor() {
    super(CelShader);
  }

  public setEnabled(enabled: boolean): void {
    this.uniforms['enabled'].value = enabled;
  }

  public setResolution(width: number, height: number): void {
    this.uniforms['resolution'].value.set(width, height);
  }
}
