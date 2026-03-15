/* ─── Neon Grid Shaders ──────────────────────────────────────────────────── */
/* Used by TradingGridBackground for the animated floor grid.               */
/* Colors match OKLCH design tokens converted to linear sRGB for WebGL.     */

/**
 * Vertex shader — passes UV + world position to fragment.
 * Applies a subtle wave displacement on the Y axis.
 */
export const gridVertexShader = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vUv = uv;
    vec3 pos = position;
    // Gentle wave displacement
    pos.y += sin(pos.x * 2.0 + uTime * 0.5) * 0.02;
    pos.y += cos(pos.z * 2.0 + uTime * 0.3) * 0.02;
    vPosition = pos;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

/**
 * Fragment shader — renders an infinite-style neon grid with animated glow.
 *
 * Color reference (OKLCH → linear sRGB approximations):
 *   Primary glow:  oklch(0.65 0.22 260) → ~rgb(0.30, 0.42, 0.95)
 *   Profit green:  oklch(0.65 0.2 145)  → ~rgb(0.18, 0.75, 0.35)
 *   Loss red:      oklch(0.577 0.245 27) → ~rgb(0.85, 0.22, 0.18)
 *   Obsidian bg:   oklch(0.12 0.01 260) → ~rgb(0.015, 0.015, 0.03)
 */
export const gridFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  varying vec3 vPosition;

  float gridLine(float coord, float thickness) {
    float halfThickness = thickness * 0.5;
    float d = abs(fract(coord - 0.5) - 0.5);
    return smoothstep(halfThickness + 0.002, halfThickness, d);
  }

  void main() {
    // Grid line intensities at two scales
    float gridScale1 = 8.0;
    float gridScale2 = 32.0;

    float line1 = gridLine(vPosition.x * gridScale1, 0.03)
                + gridLine(vPosition.z * gridScale1, 0.03);
    float line2 = gridLine(vPosition.x * gridScale2, 0.015)
                + gridLine(vPosition.z * gridScale2, 0.015);

    // Combine grids
    float grid = clamp(line1 * 0.6 + line2 * 0.25, 0.0, 1.0);

    // Animated pulse along the grid
    float pulse = sin(vPosition.x * 3.0 + uTime * 1.2) * 0.5 + 0.5;
    pulse *= sin(vPosition.z * 3.0 - uTime * 0.8) * 0.5 + 0.5;

    // Primary glow color (blue-purple matching oklch(0.65 0.22 260))
    vec3 glowColor = vec3(0.30, 0.42, 0.95);

    // Cyan accent for intersection highlights
    vec3 accentColor = vec3(0.15, 0.85, 0.95);

    // Blend glow with accent at intersections
    vec3 color = mix(glowColor, accentColor, pulse * 0.3);

    // Final alpha with animation
    float alpha = grid * (0.5 + pulse * 0.3) * uOpacity;

    // Fade edges for seamless blend
    float edgeFade = smoothstep(0.0, 0.15, vUv.x)
                   * smoothstep(0.0, 0.15, 1.0 - vUv.x)
                   * smoothstep(0.0, 0.2, vUv.y)
                   * smoothstep(0.0, 0.2, 1.0 - vUv.y);

    alpha *= edgeFade;

    gl_FragColor = vec4(color, alpha);
  }
`;

export const gridVertexShaderName = 'tradepro-grid-vertex';
export const gridFragmentShaderName = 'tradepro-grid-fragment';
