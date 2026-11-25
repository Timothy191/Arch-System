import { CAMERA_DISTANCE_MULT, GLOBE_SPHERE_FILL_RATIO, type OrbitAngles } from './globe-math';

export interface WebGLGlobeRenderOptions {
  readonly widthPx: number;
  readonly heightPx: number;
  readonly dpr: number;
  readonly orbit: OrbitAngles;
}

export interface WebGLGlobeRenderer {
  readonly setTextureImage: (image: HTMLImageElement) => void;
  readonly setOverlayTextureImage: (image: HTMLImageElement) => void;
  readonly clearOverlayTexture: () => void;
  readonly render: (options: WebGLGlobeRenderOptions) => boolean;
  readonly dispose: () => void;
}

const MIN_SPHERE_RADIUS_PX = 40;
const FULLSCREEN_QUAD_VERTICES = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const GLOBE_FRAGMENT_SHADER_SOURCE = `
precision highp float;

uniform vec2 u_center;
uniform float u_radiusPx;
uniform float u_cameraDist;
uniform vec2 u_orbit;
uniform sampler2D u_texture;
uniform sampler2D u_overlayTexture;
uniform float u_hasTexture;
uniform float u_hasOverlay;

const float PI = 3.14159265359;
const float TWO_PI = 6.28318530718;

void main() {
  if (u_radiusPx <= 0.0) discard;

  vec2 ndc = vec2(gl_FragCoord.x - u_center.x, gl_FragCoord.y - u_center.y) / u_radiusPx;
  float rSq = dot(ndc, ndc);
  float r = sqrt(rSq);
  float pxAA = 2.2 / max(u_radiusPx, 1.0);
  if (r > 1.0 + pxAA) discard;

  float edgeAlpha = 1.0 - smoothstep(1.0 - pxAA, 1.0 + pxAA, r);
  float disc = max(0.0, 1.0 - rSq);
  float k = sqrt(u_cameraDist * u_cameraDist - 1.0);
  vec3 rayDir = vec3(ndc.x / k, ndc.y / k, -1.0);
  float rayLenSq = dot(rayDir, rayDir);
  float hitT = (u_cameraDist - sqrt(disc)) / rayLenSq;
  vec3 nCam = normalize(vec3(0.0, 0.0, u_cameraDist) + hitT * rayDir);

  float cosP = cos(u_orbit.y);
  float sinP = sin(u_orbit.y);
  float y1 = nCam.y * cosP + nCam.z * sinP;
  float z1 = -nCam.y * sinP + nCam.z * cosP;

  float cosY = cos(u_orbit.x);
  float sinY = sin(u_orbit.x);
  vec3 pWorld = vec3(
    nCam.x * cosY + z1 * sinY,
    y1,
    -nCam.x * sinY + z1 * cosY
  );

  float lon = atan(pWorld.x, pWorld.z);
  float lat = asin(clamp(pWorld.y, -1.0, 1.0));
  vec2 uv = vec2(clamp(0.5 + lon / TWO_PI, 0.001, 0.999), clamp(0.5 + lat / PI, 0.001, 0.999));

  vec3 lightDir = normalize(vec3(-0.42, 0.54, 0.73));
  vec3 fillDir = normalize(vec3(0.58, -0.22, 0.78));
  float wrapDiffuse = dot(nCam, lightDir) * 0.5 + 0.5;
  float fillDiffuse = max(dot(nCam, fillDir), 0.0);
  vec3 halfVec = normalize(lightDir + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(nCam, halfVec), 0.0), 28.0);
  float fresnel = pow(1.0 - max(nCam.z, 0.0), 2.8);

  vec3 oceanBase = vec3(0.11, 0.25, 0.43);
  vec3 reliefHint = oceanBase + vec3(0.08, 0.14, 0.2) * smoothstep(-0.2, 0.6, sin(lon * 4.0) * cos(lat * 3.0));
  vec3 baseColor = u_hasTexture > 0.5 ? texture2D(u_texture, uv).rgb : reliefHint;
  vec3 texColor = baseColor;
  if (u_hasOverlay > 0.5) {
    vec3 overlayColor = texture2D(u_overlayTexture, uv).rgb;
    float overlayPeak = max(overlayColor.r, max(overlayColor.g, overlayColor.b));
    float overlayMask = smoothstep(0.035, 0.095, overlayPeak);
    texColor = mix(baseColor, overlayColor, overlayMask);
  }

  // Wrap-around daylight lighting & lifted deep-ocean floor so neither hemisphere goes black
  vec3 liftedTex = max(texColor, vec3(0.06, 0.16, 0.32));
  vec3 vibrantColor = clamp((liftedTex - 0.48) * 1.08 + 0.52, 0.0, 1.0);
  vec3 litColor = vibrantColor * (0.76 + 0.24 * wrapDiffuse + 0.14 * fillDiffuse);
  litColor += vec3(0.96, 0.98, 1.0) * spec * 0.14;
  litColor = mix(litColor, vec3(0.72, 0.88, 0.99), fresnel * 0.42);
  litColor += vec3(0.83, 0.69, 0.22) * fresnel * 0.12;

  gl_FragColor = vec4(clamp(litColor, 0.0, 1.0), edgeAlpha);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Create an interactive perspective-correct WebGL satellite globe renderer, or null if unsupported. */
export function createWebGLGlobeRenderer(canvas: HTMLCanvasElement): WebGLGlobeRenderer | null {
  if (typeof WebGLRenderingContext === 'undefined') return null;

  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      powerPreference: 'default',
    }) ??
      canvas.getContext('experimental-webgl', {
        alpha: true,
        antialias: true,
      })) as WebGLRenderingContext | null;
  } catch {
    return null;
  }

  if (!gl || typeof gl.createProgram !== 'function') return null;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, GLOBE_FRAGMENT_SHADER_SOURCE);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) gl.deleteShader(vertexShader);
    if (fragmentShader) gl.deleteShader(fragmentShader);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const quadBuffer = gl.createBuffer();
  const texture = gl.createTexture();
  const overlayTexture = gl.createTexture();
  if (!quadBuffer || !texture || !overlayTexture) {
    if (quadBuffer) gl.deleteBuffer(quadBuffer);
    if (texture) gl.deleteTexture(texture);
    if (overlayTexture) gl.deleteTexture(overlayTexture);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_QUAD_VERTICES, gl.STATIC_DRAW);

  const posAttr = gl.getAttribLocation(program, 'a_pos');
  const centerLoc = gl.getUniformLocation(program, 'u_center');
  const radiusLoc = gl.getUniformLocation(program, 'u_radiusPx');
  const cameraDistLoc = gl.getUniformLocation(program, 'u_cameraDist');
  const orbitLoc = gl.getUniformLocation(program, 'u_orbit');
  const textureLoc = gl.getUniformLocation(program, 'u_texture');
  const overlayTextureLoc = gl.getUniformLocation(program, 'u_overlayTexture');
  const hasTextureLoc = gl.getUniformLocation(program, 'u_hasTexture');
  const hasOverlayLoc = gl.getUniformLocation(program, 'u_hasOverlay');

  for (const tex of [texture, overlayTexture]) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  const glContext = gl;
  const activateProgram = glContext.useProgram.bind(glContext);
  let hasTextureUploaded = false;
  let hasOverlayUploaded = false;

  const uploadImageToTexture = (targetTexture: WebGLTexture, image: HTMLImageElement): boolean => {
    if (image.naturalWidth === 0 || image.naturalHeight === 0) return false;
    try {
      glContext.bindTexture(glContext.TEXTURE_2D, targetTexture);
      glContext.pixelStorei(glContext.UNPACK_FLIP_Y_WEBGL, 1);
      glContext.texImage2D(
        glContext.TEXTURE_2D,
        0,
        glContext.RGBA,
        glContext.RGBA,
        glContext.UNSIGNED_BYTE,
        image
      );
      return true;
    } catch {
      return false;
    }
  };

  return {
    setTextureImage: (image: HTMLImageElement) => {
      if (uploadImageToTexture(texture, image)) {
        hasTextureUploaded = true;
      }
    },
    setOverlayTextureImage: (image: HTMLImageElement) => {
      if (uploadImageToTexture(overlayTexture, image)) {
        hasOverlayUploaded = true;
      }
    },
    clearOverlayTexture: () => {
      hasOverlayUploaded = false;
    },
    render: ({ widthPx, heightPx, dpr, orbit }: WebGLGlobeRenderOptions) => {
      const physWidth = Math.max(1, Math.round(widthPx * dpr));
      const physHeight = Math.max(1, Math.round(heightPx * dpr));
      const minDim = Math.min(widthPx, heightPx);
      const radiusPx = Math.max(MIN_SPHERE_RADIUS_PX, minDim * GLOBE_SPHERE_FILL_RATIO) * dpr;

      glContext.viewport(0, 0, physWidth, physHeight);
      glContext.clearColor(0, 0, 0, 0);
      glContext.clear(glContext.COLOR_BUFFER_BIT);
      glContext.enable(glContext.BLEND);
      glContext.blendFunc(glContext.SRC_ALPHA, glContext.ONE_MINUS_SRC_ALPHA);

      activateProgram(program);
      glContext.bindBuffer(glContext.ARRAY_BUFFER, quadBuffer);
      glContext.enableVertexAttribArray(posAttr);
      glContext.vertexAttribPointer(posAttr, 2, glContext.FLOAT, false, 0, 0);

      glContext.uniform2f(centerLoc, physWidth * 0.5, physHeight * 0.5);
      glContext.uniform1f(radiusLoc, radiusPx);
      glContext.uniform1f(cameraDistLoc, CAMERA_DISTANCE_MULT);
      glContext.uniform2f(orbitLoc, orbit.yawRad, orbit.pitchRad);
      glContext.activeTexture(glContext.TEXTURE0);
      glContext.bindTexture(glContext.TEXTURE_2D, texture);
      glContext.uniform1i(textureLoc, 0);
      glContext.activeTexture(glContext.TEXTURE1);
      glContext.bindTexture(glContext.TEXTURE_2D, overlayTexture);
      glContext.uniform1i(overlayTextureLoc, 1);
      glContext.uniform1f(hasTextureLoc, hasTextureUploaded ? 1 : 0);
      glContext.uniform1f(hasOverlayLoc, hasOverlayUploaded ? 1 : 0);

      glContext.drawArrays(glContext.TRIANGLE_STRIP, 0, 4);
      return hasTextureUploaded;
    },
    dispose: () => {
      try {
        glContext.deleteTexture(texture);
        glContext.deleteTexture(overlayTexture);
        glContext.deleteBuffer(quadBuffer);
        glContext.deleteProgram(program);
        glContext.deleteShader(vertexShader);
        glContext.deleteShader(fragmentShader);
      } catch {
        // Ignore context loss teardown errors
      }
    },
  };
}
