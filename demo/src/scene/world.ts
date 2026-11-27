import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SLOTS, type Layer, type Mode } from './model';

/**
 * Monde 3D du site public : parcelle d'oignon des Niayes, ciel de fin
 * d'après-midi, horizon de baobabs, boîtier scellé, trois sondes et coupe
 * du sol.
 *
 * Deux caméras pour un seul monde :
 *  - « orbite » : survol à la souris / au doigt (OrbitControls) ;
 *  - « marche »   : première personne façon jeu, ZQSD + souris capturée,
 *                   saut, course, relief suivi au sol.
 *
 * Une unité = un mètre. La scène ne calcule aucun chiffre métier : elle
 * expose des commandes et signale ce qui se trouve à portée du visiteur.
 */

export interface Nearby {
  id: string;
  kind: 'slot' | 'box' | 'valve' | 'probe';
  index?: number;
  label: string;
}

export type WorldEvent =
  | { type: 'sensor'; index: number }
  | { type: 'kit' }
  | { type: 'irrigate' }
  | { type: 'inspect'; index: number };

export interface Snapshot {
  x: number;
  z: number;
  yaw: number;
  mode: Mode;
  locked: boolean;
  /** Prochain point utile, pour le cap affiché dans l'interface. */
  waypoint: { x: number; z: number; label: string; distance: number } | null;
}

/** Points remarquables de la parcelle (mini-carte). */
export const LANDMARKS = {
  box: { x: -56, z: -46 },
  valve: { x: -50, z: -41 },
} as const;

export interface Interactions {
  slots: boolean;
  box: boolean;
  valve: boolean;
  probes: boolean;
}

interface Handlers {
  onNearby: (nearby: Nearby | null) => void;
  onEvent: (event: WorldEvent) => void;
  onSnapshot: (snapshot: Snapshot) => void;
}

const FIELD = { width: 130, depth: 115, bedCount: 26, bedLength: 124, bedSpacing: 4.2 } as const;
const BOX_POS = { x: -56, z: -46 };
const VALVE_POS = { x: -50, z: -41 };
const GATEWAY_POS = { x: 96, z: -104 };
const START = { x: -46, z: 46 };

const PALETTE = {
  bed: 0x6f5636,
  dryLoam: 0xa99063,
  wetLoam: 0x4a3f2f,
  leafDry: 0xb8a33a,
  tech: 0x6fd3ff,
};

const ZONE_COLORS: Record<Layer, number[]> = {
  zones: [0xd97706, 0x2f9e58, 0xe0b73a],
  ndvi: [0xc2712a, 0x5ad48a, 0x9fe7b8],
  radar: [0x0e7490, 0x38bdf8, 0x9adcf7],
};

export function groundHeight(x: number, z: number): number {
  return 0.012 * x + 0.1 * Math.sin(x * 0.08) + 0.08 * Math.cos(z * 0.09);
}

/* -------------------------------------------------------------------- */
/* Textures procédurales                                                 */
/* -------------------------------------------------------------------- */

function soilTexture(): THREE.Texture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#a8946a';
  ctx.fillRect(0, 0, size, size);
  // Grain : taches de terre, cailloux, paille.
  for (let i = 0; i < 9000; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.4 + 0.4;
    const tone = Math.random();
    ctx.fillStyle =
      tone > 0.72
        ? `rgba(226,205,160,${0.1 + Math.random() * 0.28})`
        : tone > 0.36
          ? `rgba(122,98,64,${0.08 + Math.random() * 0.22})`
          : `rgba(70,56,38,${0.06 + Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 340; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = `rgba(214,190,140,${0.05 + Math.random() * 0.12})`;
    ctx.lineWidth = 0.8 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 14, y + (Math.random() - 0.5) * 14);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function cloudTexture(): THREE.Texture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < 26; i += 1) {
    const x = size / 2 + (Math.random() - 0.5) * size * 0.62;
    const y = size / 2 + (Math.random() - 0.5) * size * 0.4;
    const r = 22 + Math.random() * 46;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.22)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function circleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function flowTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 8;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(56,189,248,0.06)';
  ctx.fillRect(0, 0, 128, 8);
  const gradient = ctx.createLinearGradient(0, 0, 48, 0);
  gradient.addColorStop(0, 'rgba(125,211,252,0)');
  gradient.addColorStop(0.55, 'rgba(186,230,253,0.95)');
  gradient.addColorStop(1, 'rgba(125,211,252,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(28, 0, 48, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(22, 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function panelTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0b2a52';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = 'rgba(148,197,255,0.6)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  for (let y = 0; y <= 160; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function labelSprite(text: string, tone: 'dark' | 'alert' | 'tech' = 'dark'): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const fill = tone === 'alert' ? 'rgba(127,29,29,0.94)' : tone === 'tech' ? 'rgba(8,47,73,0.92)' : 'rgba(8,20,15,0.86)';
  const radius = 26;
  ctx.beginPath();
  ctx.moveTo(radius, 8);
  ctx.lineTo(512 - radius, 8);
  ctx.quadraticCurveTo(504, 8, 504, 8 + radius);
  ctx.lineTo(504, 120 - radius);
  ctx.quadraticCurveTo(504, 120, 512 - radius, 120);
  ctx.lineTo(radius, 120);
  ctx.quadraticCurveTo(8, 120, 8, 120 - radius);
  ctx.lineTo(8, 8 + radius);
  ctx.quadraticCurveTo(8, 8, radius, 8);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#f6f2e8';
  ctx.font = '600 40px "Public Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.renderOrder = 12;
  sprite.scale.set(8, 2, 1);
  return sprite;
}

/* -------------------------------------------------------------------- */

export default class World {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private canvas: HTMLCanvasElement;
  private handlers: Handlers;
  private clock = new THREE.Clock();
  private time = 0;
  private raf = 0;
  private disposed = false;
  private observer: ResizeObserver | null = null;
  private tickTimer = 0;

  private mode: Mode = 'orbit';
  private locked = false;
  private layer: Layer = 'zones';

  /* joueur */
  private player = new THREE.Vector3(START.x, 0, START.z);
  private yaw = Math.atan2(-(0 - START.x), -(0 - START.z));
  private pitch = -0.06;
  private velocityY = 0;
  private onGround = true;
  private keys = new Set<string>();
  private bob = 0;
  private dragLook: { x: number; y: number } | null = null;
  private pointerStart = { x: 0, y: 0 };

  /* objets */
  private terrain!: THREE.Mesh;
  private bedMaterial!: THREE.MeshStandardMaterial;
  private plants!: THREE.InstancedMesh;
  private plantBase: THREE.Color[] = [];
  private plantMix = 0;
  private zoneMeshes: { mesh: THREE.Mesh; edge: THREE.LineSegments; label: THREE.Sprite }[] = [];
  private flowMaterial!: THREE.MeshStandardMaterial;
  private flowTexture!: THREE.Texture;
  private droplets!: THREE.Points;
  private dropletVelocity: number[] = [];
  private moistureVolume!: THREE.Mesh;
  private boxGroup!: THREE.Group;
  private panel!: THREE.Group;
  private rainGauge!: THREE.Group;
  private sealTag!: THREE.Mesh;
  private kitLeds: THREE.Mesh[] = [];
  private valveWheel!: THREE.Group;
  private gateway!: THREE.Group;
  private beam!: THREE.Mesh;
  private beamPulse!: THREE.Mesh;
  private beamCurve!: THREE.QuadraticBezierCurve3;
  private probes: { group: THREE.Group; led: THREE.Mesh; cap: THREE.Mesh; label: THREE.Sprite }[] = [];
  private planted: boolean[] = [false, false, false];
  private tamperedIndex = -1;
  private slotRings: THREE.Mesh[] = [];
  private slotBeacons: THREE.Mesh[] = [];
  private slotLabels: THREE.Sprite[] = [];
  private cutaway!: THREE.Group;
  private clouds: THREE.Sprite[] = [];
  private scanRing: THREE.Mesh;
  private scanProgress = 1;
  private dust!: THREE.Points;
  private guide!: THREE.Group;
  private guideCore!: THREE.Mesh;
  private guideHalo!: THREE.Mesh;
  private guideRing!: THREE.Mesh;
  private guideLabel!: THREE.Sprite;
  private guideKey = '';
  private inspected: boolean[] = [false, false, false];

  private interactions: Interactions = { slots: false, box: false, valve: false, probes: false };
  private nearby: Nearby | null = null;

  private heat = false;
  private irrigation = false;
  private alarm = false;
  private autoRotate = true;
  private walked = false;
  private heatMix = 0;
  private transition: { position: THREE.Vector3; target: THREE.Vector3 } | null = null;
  private contextLost = false;

  constructor(canvas: HTMLCanvasElement, handlers: Handlers) {
    this.canvas = canvas;
    this.handlers = handlers;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.24;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xf0ddbd, 380, 1600);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.12, 2600);
    this.camera.position.set(62, 24, 108);
    this.camera.rotation.order = 'YXZ';

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.target.set(0, 2, -4);
    this.controls.minDistance = 12;
    this.controls.maxDistance = 320;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.autoRotateSpeed = 0.34;
    this.controls.addEventListener('start', () => {
      this.transition = null;
    });
    this.controls.update();

    this.buildSky();
    this.buildGround();
    this.buildBeds();
    this.buildHedge();
    this.buildPipes();
    this.buildZones();
    this.buildSlots();
    this.buildBox();
    this.buildGateway();
    this.buildProbes();
    this.buildGuide();
    this.buildCutaway();
    this.buildHorizon();
    this.buildNeighbours();
    this.buildDust();

    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 2.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x9be8c0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.position.y = groundHeight(0, 0) + 0.6;
    this.scene.add(this.scanRing);

    this.attachEvents();

    const parent = canvas.parentElement;
    if (parent) {
      this.observer = new ResizeObserver(() => this.resize());
      this.observer.observe(parent);
    }
    this.resize();
    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);

    // Accès de contrôle qualité, jamais présent dans le build public.
    if (import.meta.env.DEV) {
      (window as unknown as Record<string, unknown>).__field = this;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Décor                                                               */
  /* ------------------------------------------------------------------ */

  private buildSky() {
    const sunDirection = new THREE.Vector3(0.42, 0.5, 0.76).normalize();
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        zenith: { value: new THREE.Color(0x2c6a9c) },
        horizon: { value: new THREE.Color(0xffd9a6) },
        ground: { value: new THREE.Color(0xcaa878) },
        sunDirection: { value: sunDirection },
        haze: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vWorld = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 zenith;
        uniform vec3 horizon;
        uniform vec3 ground;
        uniform vec3 sunDirection;
        uniform float haze;
        varying vec3 vWorld;
        void main() {
          vec3 dir = normalize(vWorld);
          float h = dir.y;
          vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.42));
          col = mix(ground, col, smoothstep(-0.14, 0.02, h));
          float sunAmount = max(dot(dir, normalize(sunDirection)), 0.0);
          col += vec3(1.0, 0.88, 0.66) * pow(sunAmount, 1400.0) * 4.6;
          col += vec3(1.0, 0.72, 0.42) * pow(sunAmount, 9.0) * 0.3;
          col = mix(col, vec3(0.95, 0.81, 0.63), haze * 0.4 * smoothstep(0.0, 0.5, h));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyMaterial = skyMaterial;
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(2000, 40, 24), skyMaterial));

    // Halo solaire : une tache chaude basse sur l'horizon, comme en fin de journée.
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: circleTexture(),
        color: 0xffe6bd,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    sunGlow.position.copy(sunDirection).multiplyScalar(1650);
    sunGlow.scale.set(540, 540, 1);
    this.scene.add(sunGlow);

    const hemi = new THREE.HemisphereLight(0xd6e8ff, 0x9a7a4e, 1.42);
    this.scene.add(hemi);

    this.sun = new THREE.DirectionalLight(0xffd9a4, 2.92);
    this.sun.position.set(180, 96, 92);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 30;
    this.sun.shadow.camera.far = 420;
    this.sun.shadow.camera.left = -120;
    this.sun.shadow.camera.right = 120;
    this.sun.shadow.camera.top = 120;
    this.sun.shadow.camera.bottom = -120;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Contre-jour froid : décolle les ombres du noir, sans écraser la lumière chaude.
    const fill = new THREE.DirectionalLight(0xbfd7ff, 0.42);
    fill.position.set(-160, 70, -120);
    this.scene.add(fill);

    // Nuages : nappes de sprites qui dérivent lentement.
    const texture = cloudTexture();
    for (let i = 0; i < 18; i += 1) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0.1 + Math.random() * 0.14,
        depthWrite: false,
        color: new THREE.Color(0xfff4e2),
      });
      const cloud = new THREE.Sprite(material);
      cloud.position.set((Math.random() - 0.5) * 1400, 230 + Math.random() * 190, (Math.random() - 0.5) * 1400);
      const scale = 220 + Math.random() * 240;
      cloud.scale.set(scale, scale * 0.42, 1);
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private skyMaterial!: THREE.ShaderMaterial;
  private sun!: THREE.DirectionalLight;

  private buildGround() {
    const texture = soilTexture();
    texture.repeat.set(150, 150);
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(4000, 4000),
      new THREE.MeshStandardMaterial({ map: texture, color: 0xd8c8a4, roughness: 1, metalness: 0 }),
    );
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.y = -0.4;
    outerGround.receiveShadow = true;
    this.scene.add(outerGround);

    const terrainTexture = soilTexture();
    terrainTexture.repeat.set(13, 11);
    const geometry = new THREE.PlaneGeometry(FIELD.width, FIELD.depth, 80, 72);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.attributes.position as THREE.BufferAttribute;
          const tint: number[] = [];
    const sandy = new THREE.Color(0xe6c99a);
    const loam = new THREE.Color(0xbd9a6a);
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, groundHeight(x, z));
      const blend = new THREE.Color().lerpColors(loam, sandy, 0.38 + 0.28 * Math.sin(x * 0.06 + z * 0.04));
      tint.push(blend.r, blend.g, blend.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(tint, 3));
    geometry.computeVertexNormals();

    this.terrain = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: terrainTexture,
        vertexColors: true,
        roughness: 0.99,
        metalness: 0,
      }),
    );
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);

    // Touffes d'herbe sèche autour de la parcelle : donne l'échelle au sol.
    const tuftGeometry = mergeGeometries([
      new THREE.ConeGeometry(0.05, 0.5, 3).translate(0, 0.25, 0),
      new THREE.ConeGeometry(0.045, 0.36, 3).translate(0.12, 0.18, 0.06).rotateZ(0.3),
      new THREE.ConeGeometry(0.045, 0.3, 3).translate(-0.1, 0.15, -0.05).rotateZ(-0.35),
    ]) as THREE.BufferGeometry;
    const tufts = new THREE.InstancedMesh(
      tuftGeometry,
      new THREE.MeshStandardMaterial({ color: 0xa79a5c, roughness: 1, flatShading: true }),
      1400,
    );
    const dummy = new THREE.Object3D();
    let placed = 0;
    while (placed < 1400) {
      const x = (Math.random() - 0.5) * 300;
      const z = (Math.random() - 0.5) * 300;
      if (Math.abs(x) < FIELD.width / 2 + 2 && Math.abs(z) < FIELD.depth / 2 + 2) continue;
      if (Math.hypot(x - BOX_POS.x, z - BOX_POS.z) < 8) continue;
      dummy.position.set(x, groundHeight(x, z), z);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.setScalar(0.7 + Math.random() * 0.9);
      dummy.updateMatrix();
      tufts.setMatrixAt(placed, dummy.matrix);
      placed += 1;
    }
    tufts.instanceMatrix.needsUpdate = true;
    this.scene.add(tufts);
  }

  private buildBeds() {
    const ridge = new THREE.Shape();
    ridge.moveTo(-0.95, 0);
    ridge.quadraticCurveTo(-0.55, 0.42, 0, 0.46);
    ridge.quadraticCurveTo(0.55, 0.42, 0.95, 0);
    ridge.lineTo(0.95, -0.02);
    ridge.lineTo(-0.95, -0.02);
    ridge.closePath();
    const geometry = new THREE.ExtrudeGeometry(ridge, { depth: FIELD.bedLength, bevelEnabled: false, steps: 1 });
    geometry.rotateY(Math.PI / 2);
    geometry.translate(-FIELD.bedLength / 2, 0, 0);
    geometry.computeVertexNormals();

    this.bedMaterial = new THREE.MeshStandardMaterial({ color: 0x85653f, roughness: 1, metalness: 0 });
    const beds = new THREE.InstancedMesh(geometry, this.bedMaterial, FIELD.bedCount);
    beds.castShadow = true;
    beds.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    const firstBedZ = -((FIELD.bedCount - 1) * FIELD.bedSpacing) / 2;
    for (let i = 0; i < FIELD.bedCount; i += 1) {
      matrix.makeTranslation(0, 0, firstBedZ + i * FIELD.bedSpacing);
      beds.setMatrixAt(i, matrix);
      const shade = new THREE.Color(PALETTE.bed).multiplyScalar(0.9 + ((i * 5) % 7) * 0.028);
      beds.setColorAt(i, shade);
    }
    beds.instanceMatrix.needsUpdate = true;
    this.scene.add(beds);

    const blades: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 8; i += 1) {
      // Feuilles tubulaires d'oignon : fines, hautes, légèrement retombantes.
      const blade = new THREE.CylinderGeometry(0.004, 0.03, 0.46 + (i % 3) * 0.1, 3, 1);
      blade.translate(0.05 * Math.cos(i * 1.7), 0.25, 0.05 * Math.sin(i * 1.7));
      blade.rotateZ(0.4 * Math.cos(i * 1.3));
      blade.rotateX(0.4 * Math.sin(i * 1.3));
      blades.push(blade);
    }
    const plantGeometry = mergeGeometries(blades) as THREE.BufferGeometry;
    const perBed = 3;
    const alongBed = 112;
    const count = FIELD.bedCount * perBed * alongBed;
    this.plants = new THREE.InstancedMesh(
      plantGeometry,
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0, flatShading: true }),
      count,
    );
    this.plants.castShadow = true;
    this.plants.receiveShadow = true;
    const greens = [0x2f6b3f, 0x3c7a46, 0x275c38, 0x4f8f52, 0x357046, 0x468048];
    let index = 0;
    for (let bed = 0; bed < FIELD.bedCount; bed += 1) {
      const bedZ = firstBedZ + bed * FIELD.bedSpacing;
      for (let row = 0; row < perBed; row += 1) {
        for (let k = 0; k < alongBed; k += 1) {
          const x = -FIELD.bedLength / 2 + 3.5 + (k * (FIELD.bedLength - 7)) / (alongBed - 1);
          const z = bedZ + (row - 1) * 0.52;
          const scale = 0.85 + ((bed * 7 + k * 3 + row) % 5) * 0.07;
          const dummy = new THREE.Object3D();
          dummy.position.set(x + Math.sin(k * 2.1) * 0.18, groundHeight(x, z) + 0.42, z);
          dummy.rotation.y = (bed + k) * 0.7;
          dummy.scale.setScalar(scale);
          dummy.updateMatrix();
          this.plants.setMatrixAt(index, dummy.matrix);
          const color = new THREE.Color(greens[(bed + k + row) % greens.length]);
          this.plants.setColorAt(index, color);
          this.plantBase.push(color.clone());
          index += 1;
        }
      }
    }
    this.plants.instanceMatrix.needsUpdate = true;
    if (this.plants.instanceColor) this.plants.instanceColor.needsUpdate = true;
    this.scene.add(this.plants);
  }

  private buildHedge() {
    const bushGeometry = mergeGeometries([
      new THREE.IcosahedronGeometry(1.55, 0).translate(0, 1.6, 0),
      new THREE.IcosahedronGeometry(1.15, 0).translate(1, 1.15, 0.35),
      new THREE.IcosahedronGeometry(1.05, 0).translate(-0.95, 1.05, -0.25),
      new THREE.IcosahedronGeometry(0.95, 0).translate(0.15, 2.4, 0.3),
    ]) as THREE.BufferGeometry;
    const hedge = new THREE.InstancedMesh(
      bushGeometry,
      new THREE.MeshStandardMaterial({ color: 0x2f5d34, roughness: 0.95, flatShading: true }),
      70,
    );
    hedge.castShadow = true;
    const bush = new THREE.Object3D();
    let index = 0;
    for (let i = 0; i < 38; i += 1) {
      const z = -FIELD.depth / 2 - 4 + (i * (FIELD.depth + 8)) / 37;
      const x = -FIELD.width / 2 - 5 + Math.sin(i * 1.1) * 1.6;
      bush.position.set(x, groundHeight(x, z), z);
      bush.rotation.y = i * 0.9;
      bush.scale.setScalar(0.9 + ((i * 7) % 5) * 0.13);
      bush.updateMatrix();
      hedge.setMatrixAt(index, bush.matrix);
      index += 1;
    }
    for (let i = 0; i < 30; i += 1) {
      const x = -FIELD.width / 2 - 4 + (i * (FIELD.width + 8)) / 29;
      const z = -FIELD.depth / 2 - 7 + Math.cos(i * 1.3) * 1.4;
      bush.position.set(x, groundHeight(x, z), z);
      bush.rotation.y = i * 0.7;
      bush.scale.setScalar(0.85 + ((i * 5) % 4) * 0.15);
      bush.updateMatrix();
      hedge.setMatrixAt(index, bush.matrix);
      index += 1;
    }
    hedge.count = index;
    hedge.instanceMatrix.needsUpdate = true;
    this.scene.add(hedge);
  }

  private buildPipes() {
    this.flowTexture = flowTexture();
    this.flowMaterial = new THREE.MeshStandardMaterial({
      color: 0x24454d,
      roughness: 0.78,
      metalness: 0.12,
      emissive: new THREE.Color(PALETTE.tech),
      emissiveIntensity: 0,
      emissiveMap: this.flowTexture,
      transparent: true,
      opacity: 0.96,
    });

    const header = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, FIELD.depth - 8, 8), this.flowMaterial);
    header.rotation.x = Math.PI / 2;
    header.position.set(-FIELD.bedLength / 2 + 2, 0.34, 0);
    header.castShadow = true;
    this.scene.add(header);

    const firstBedZ = -((FIELD.bedCount - 1) * FIELD.bedSpacing) / 2;
    for (let i = 0; i < FIELD.bedCount; i += 1) {
      const lateral = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, FIELD.bedLength - 6, 6), this.flowMaterial);
      lateral.rotation.z = Math.PI / 2;
      lateral.position.set(0, 0.5, firstBedZ + i * FIELD.bedSpacing);
      this.scene.add(lateral);
    }

    const count = 620;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * (FIELD.bedLength - 10);
      positions[i * 3 + 1] = 0.5 + Math.random() * 3.4;
      positions[i * 3 + 2] = (Math.random() - 0.5) * (FIELD.depth - 10);
      this.dropletVelocity.push(2.4 + Math.random() * 3.6);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.droplets = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xa5e6ff,
        size: 0.3,
        map: circleTexture(),
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.droplets.visible = false;
    this.scene.add(this.droplets);
  }

  private buildZones() {
    const bands = [
      { zMin: -57.5, zMax: -19.2 },
      { zMin: -19.2, zMax: 19.2 },
      { zMin: 19.2, zMax: 57.5 },
    ];
    bands.forEach((band, index) => {
      const depth = band.zMax - band.zMin;
      const centerZ = (band.zMin + band.zMax) / 2;
      const geometry = new THREE.PlaneGeometry(FIELD.width - 2, depth - 2, 26, 10);
      geometry.rotateX(-Math.PI / 2);
      const vertices = geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < vertices.count; i += 1) {
        vertices.setY(i, groundHeight(vertices.getX(i), centerZ + vertices.getZ(i)) + 0.05);
      }
      vertices.needsUpdate = true;
      geometry.computeVertexNormals();

      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({
          color: ZONE_COLORS.zones[index],
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
        }),
      );
      mesh.position.set(0, 0, centerZ);
      mesh.renderOrder = 2;
      this.scene.add(mesh);

      // Pas de liseré : le relief subdivisé créerait des arêtes parasites.
      const edge = new THREE.LineSegments(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ visible: false }),
      );
      edge.visible = false;

      const label = labelSprite(
        index === 0 ? 'Z1 Nord · sableuse' : index === 1 ? 'Z2 Centre · optimale' : 'Z3 Sud · saline',
      );
      label.position.set(0, 7, centerZ);
      this.scene.add(label);

      this.zoneMeshes.push({ mesh, edge, label });
    });
  }

  private buildSlots() {
    SLOTS.forEach((slot, index) => {
      const y = groundHeight(slot.x, slot.z);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2, 2.6, 64),
        new THREE.MeshBasicMaterial({ color: 0x9be8c0, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(slot.x, y + 0.13, slot.z);
      ring.renderOrder = 4;
      this.scene.add(ring);
      this.slotRings.push(ring);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 11, 10, 1, true),
        new THREE.MeshBasicMaterial({
          color: 0x9be8c0,
          transparent: true,
          opacity: 0.24,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beacon.position.set(slot.x, y + 5.4, slot.z);
      this.scene.add(beacon);
      this.slotBeacons.push(beacon);

      const label = labelSprite(`${index + 1} · ${slot.zone}`, 'tech');
      label.position.set(slot.x, y + 8.6, slot.z);
      label.scale.set(6.6, 1.65, 1);
      this.scene.add(label);
      this.slotLabels.push(label);
    });
  }

  private buildBox() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x9ca6b4, roughness: 0.42, metalness: 0.55 });

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), metal);
    mast.position.y = 1.7;
    mast.castShadow = true;
    group.add(mast);

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.05, 0.8, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x3f4b57, roughness: 0.6, metalness: 0.25 }),
    );
    cabinet.position.y = 1.15;
    cabinet.castShadow = true;
    group.add(cabinet);

    // Quatre voies de télémétrie : elles s'allument avec le montage du kit.
    for (let i = 0; i < 4; i += 1) {
      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x334155, emissive: 0x0f172a, emissiveIntensity: 0 }),
      );
      led.position.set(-0.3 + i * 0.2, 0.95, 0.31);
      group.add(led);
      this.kitLeds.push(led);
    }

    this.sealTag = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xf1b23c, emissive: 0x8a5a10, emissiveIntensity: 0.4 }),
    );
    this.sealTag.position.set(0.42, 1.34, 0.31);
    this.sealTag.visible = false;
    group.add(this.sealTag);

    this.panel = new THREE.Group();
    const panelMesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.07, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.3, metalness: 0.6 }),
    );
    panelMesh.castShadow = true;
    this.panel.add(panelMesh);
    const cells = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 1.4),
      new THREE.MeshStandardMaterial({ map: panelTexture(), roughness: 0.26, metalness: 0.5 }),
    );
    cells.rotation.x = -Math.PI / 2;
    cells.position.y = 0.04;
    this.panel.add(cells);
    this.panel.position.set(0, 3.3, 0.05);
    this.panel.rotation.x = -0.42;
    this.panel.visible = false;
    group.add(this.panel);

    this.rainGauge = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), metal);
    post.position.y = 0.5;
    this.rainGauge.add(post);
    const funnel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.12, 0.28, 12),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.4, metalness: 0.2 }),
    );
    funnel.position.y = 1.08;
    this.rainGauge.add(funnel);
    this.rainGauge.position.set(1.15, 0, -0.5);
    this.rainGauge.visible = false;
    group.add(this.rainGauge);

    const label = labelSprite('Boîtier scellé', 'dark');
    label.scale.set(7, 1.75, 1);
    label.position.set(0, 5.4, 0);
    group.add(label);

    group.position.set(BOX_POS.x, groundHeight(BOX_POS.x, BOX_POS.z), BOX_POS.z);
    this.boxGroup = group;
    this.scene.add(group);

    // Vanne d'irrigation : volant rouge et tuyau de refoulement.
    const valve = new THREE.Group();
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 0.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.6 }),
    );
    stem.position.y = 0.4;
    valve.add(stem);
    const wheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.07, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55, metalness: 0.2 }),
    );
    wheel.rotation.x = Math.PI / 2;
    wheel.position.y = 0.86;
    wheel.castShadow = true;
    valve.add(wheel);
    for (let i = 0; i < 3; i += 1) {
      const spoke = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.05, 0.05),
        new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 }),
      );
      spoke.position.y = 0.86;
      spoke.rotation.y = (i * Math.PI) / 3;
      valve.add(spoke);
    }
    valve.position.set(VALVE_POS.x, groundHeight(VALVE_POS.x, VALVE_POS.z), VALVE_POS.z);
    this.valveWheel = valve;
    this.scene.add(valve);

    const valveLabel = labelSprite('Vanne', 'alert');
    valveLabel.scale.set(5.2, 1.3, 1);
    valveLabel.position.set(VALVE_POS.x, groundHeight(VALVE_POS.x, VALVE_POS.z) + 2.9, VALVE_POS.z);
    this.scene.add(valveLabel);
  }

  private buildGateway() {
    const group = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.5, metalness: 0.5 });

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 15, 8), metal);
    mast.position.y = 7.5;
    mast.castShadow = true;
    group.add(mast);

    const cabinet = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 1.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.3 }),
    );
    cabinet.position.y = 13.6;
    group.add(cabinet);

    for (let i = 0; i < 3; i += 1) {
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.4, 6), metal);
      rod.position.set((i - 1) * 0.42, 15.7, 0.2);
      group.add(rod);
    }

    const led = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x6fd3ff, emissive: 0x0ea5e9, emissiveIntensity: 2.4 }),
    );
    led.name = 'gateway-led';
    led.position.set(0, 14.4, 0.58);
    group.add(led);

    const label = labelSprite('Passerelle coopérative', 'tech');
    label.scale.set(15, 3.75, 1);
    label.position.set(0, 19.2, 0);
    group.add(label);

    group.position.set(GATEWAY_POS.x, 0, GATEWAY_POS.z);
    this.gateway = group;
    this.scene.add(group);

    const start = new THREE.Vector3(BOX_POS.x, groundHeight(BOX_POS.x, BOX_POS.z) + 3.3, BOX_POS.z);
    const end = new THREE.Vector3(GATEWAY_POS.x, 15.6, GATEWAY_POS.z);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 26;
    this.beamCurve = new THREE.QuadraticBezierCurve3(start, mid, end);
    this.beam = new THREE.Mesh(
      new THREE.TubeGeometry(this.beamCurve, 72, 0.07, 6, false),
      new THREE.MeshBasicMaterial({ color: PALETTE.tech, transparent: true, opacity: 0.4 }),
    );
    this.beam.visible = false;
    this.scene.add(this.beam);

    this.beamPulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.95 }),
    );
    this.beamPulse.visible = false;
    this.scene.add(this.beamPulse);
  }

  private buildProbes() {
    SLOTS.forEach((slot) => {
      const group = new THREE.Group();
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 1.5, 10),
        new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.7 }),
      );
      shaft.position.y = 0.35;
      shaft.castShadow = true;
      group.add(shaft);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.26, 12),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5, metalness: 0.2 }),
      );
      cap.position.y = 1.14;
      cap.castShadow = true;
      group.add(cap);

      const led = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 2.2 }),
      );
      led.position.set(0, 1.3, 0);
      group.add(led);

      const label = labelSprite('Sonde', 'dark');
      label.scale.set(5.6, 1.4, 1);
      label.position.set(0, 2.7, 0);
      group.add(label);

      group.position.set(slot.x, groundHeight(slot.x, slot.z), slot.z);
      group.visible = false;
      this.scene.add(group);
      this.probes.push({ group, led, cap, label });
    });
  }

  /** Faisceau de guidage : désigne à distance le prochain point utile. */
  private buildGuide() {
    const group = new THREE.Group();

    this.guideHalo = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 1.8, 20, 20, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9be8c0,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.guideHalo.position.y = 10;
    group.add(this.guideHalo);

    this.guideCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.22, 20, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xe8fff2,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    this.guideCore.position.y = 10;
    group.add(this.guideCore);

    this.guideRing = new THREE.Mesh(
      new THREE.RingGeometry(2.4, 3.1, 64),
      new THREE.MeshBasicMaterial({
        color: 0x9be8c0,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.guideRing.rotation.x = -Math.PI / 2;
    this.guideRing.position.y = 0.16;
    group.add(this.guideRing);

    this.guideLabel = labelSprite('Prochain point', 'tech');
    this.guideLabel.scale.set(5, 1.25, 1);
    this.guideLabel.position.set(0, 4.6, 0);
    group.add(this.guideLabel);

    group.visible = false;
    this.guide = group;
    this.scene.add(group);
  }

  private buildCutaway() {
    const group = new THREE.Group();
    const size = 8.4;
    const depth = 3.4;

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(size, depth, size),
      new THREE.MeshBasicMaterial({
        color: 0xf0e2c0,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      }),
    );
    shell.position.y = -depth / 2;
    shell.renderOrder = 5;
    group.add(shell);

    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(size, depth),
      new THREE.MeshBasicMaterial({
        color: 0x6b5433,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        depthTest: false,
      }),
    );
    face.position.set(0, -depth / 2, -size / 2);
    face.renderOrder = 6;
    group.add(face);

    const grid = new THREE.GridHelper(size, 6, 0xf6ead0, 0xb49a6a);
    grid.position.y = -depth + 0.02;
    const gridMaterial = grid.material as THREE.Material;
    gridMaterial.transparent = true;
    gridMaterial.opacity = 0.32;
    gridMaterial.depthTest = false;
    grid.renderOrder = 6;
    group.add(grid);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(size / 2, 0.1, 8, 64),
      new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.8, depthTest: false }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.renderOrder = 9;
    group.add(rim);

    const rootMaterial = new THREE.MeshBasicMaterial({
      color: 0xf6e8c4,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
    });
    for (let i = 0; i < 6; i += 1) {
      const x = -3.4 + i * 1.35;
      const sx = Math.sin(i * 1.7) * 1;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(x, 0, 0),
        new THREE.Vector3(x + sx * 0.35, -0.8, sx * 0.3),
        new THREE.Vector3(x + sx * 0.9, -1.7, sx * 0.55),
        new THREE.Vector3(x + sx * 1.5, -2.7, sx * 0.75),
      ]);
      const root = new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.05, 4), rootMaterial);
      root.renderOrder = 7;
      group.add(root);
    }

    this.moistureVolume = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 20, 16),
      new THREE.MeshBasicMaterial({
        color: PALETTE.tech,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.moistureVolume.renderOrder = 8;
    this.moistureVolume.position.set(0, -1.5, 0);
    this.moistureVolume.scale.set(1.5, 0.5, 1.5);
    group.add(this.moistureVolume);

    group.visible = false;
    this.cutaway = group;
    this.scene.add(group);
  }

  private buildHorizon() {
    // Baobabs et acacias en silhouette sur l'horizon : profondeur du paysage.
    const baobab = mergeGeometries([
      new THREE.CylinderGeometry(0.55, 0.9, 7, 8).translate(0, 3.5, 0),
      new THREE.CylinderGeometry(0.25, 0.45, 3.2, 6).translate(1.1, 6.4, 0.4).rotateZ(-0.35),
      new THREE.SphereGeometry(3.1, 8, 6).translate(0, 9.2, 0),
      new THREE.SphereGeometry(2.2, 8, 6).translate(-2.4, 8.4, 1.2),
      new THREE.SphereGeometry(2.1, 8, 6).translate(2.2, 8.1, -1.4),
    ]) as THREE.BufferGeometry;
    const trees = new THREE.InstancedMesh(
      baobab,
      new THREE.MeshStandardMaterial({ color: 0x2c3f2c, roughness: 1, flatShading: true }),
      90,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 90; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 210 + Math.random() * 330;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      dummy.position.set(x, -0.3, z);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.setScalar(0.8 + Math.random() * 1.5);
      dummy.updateMatrix();
      trees.setMatrixAt(i, dummy.matrix);
    }
    trees.instanceMatrix.needsUpdate = true;
    this.scene.add(trees);
  }

  /** Parcelles voisines : le paysage continue au-delà du champ. */
  private buildNeighbours() {
    const plots = [
      { x: -330, z: -190, w: 230, d: 150, color: 0x8d9a52 },
      { x: -40, z: -350, w: 270, d: 170, color: 0xb3a26d },
      { x: 350, z: -230, w: 210, d: 165, color: 0x7f8c46 },
      { x: 430, z: 140, w: 250, d: 180, color: 0xc4ae7a },
      { x: -370, z: 190, w: 235, d: 175, color: 0xa99858 },
      { x: 130, z: 430, w: 290, d: 185, color: 0x9aa25c },
      { x: -160, z: 470, w: 200, d: 160, color: 0x878f4e },
      { x: 600, z: -420, w: 300, d: 200, color: 0xb0a06a },
    ];
    for (const plot of plots) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(plot.w, plot.d, 6, 4),
        new THREE.MeshStandardMaterial({ color: plot.color, roughness: 1, metalness: 0 }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = (plot.x + plot.z) * 0.0004;
      mesh.position.set(plot.x, -0.34, plot.z);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  private buildDust() {
    const count = 420;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (Math.random() - 0.5) * 160;
      positions[i * 3 + 1] = 0.4 + Math.random() * 9;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.dust = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: 0xfff1d0,
        size: 0.16,
        map: circleTexture(),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.scene.add(this.dust);
  }

  /* ------------------------------------------------------------------ */
  /* Entrées                                                             */
  /* ------------------------------------------------------------------ */

  private attachEvents() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  private onContextMenu = (event: Event) => {
    if (this.mode === 'walk') event.preventDefault();
  };

  /**
   * Carte graphique réinitialisée (mémoire, veille, pilote) : on gèle la boucle
   * au lieu de dessiner sur un contexte mort, puis on repart au rétablissement.
   */
  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
    cancelAnimationFrame(this.raf);
  };

  private onContextRestored = () => {
    this.contextLost = false;
    this.clock.getDelta();
    this.resize();
    if (!this.disposed) this.raf = requestAnimationFrame(this.animate);
  };

  /** Onglet revenu au premier plan : on jette le temps écoulé hors écran. */
  private onVisibilityChange = () => {
    if (document.hidden) return;
    this.clock.getDelta();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    if (this.mode !== 'walk') return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
    this.keys.add(event.code);
    if (event.code === 'KeyE' || event.code === 'Enter') {
      this.interact();
    }
    if (event.code === 'Space' && this.onGround) {
      this.velocityY = 4.4;
      this.onGround = false;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.keys.delete(event.code);
  };

  private onPointerDown = (event: PointerEvent) => {
    this.pointerStart = { x: event.clientX, y: event.clientY };
    if (this.mode === 'walk') {
      // Capture de la souris : refusée dans une iframe ou sans permission, le
      // glissement fait alors tourner la tête (voir onPointerMove).
      if (!this.locked && event.pointerType === 'mouse') this.lock();
      this.dragLook = { x: event.clientX, y: event.clientY };
    }
  };

  private onPointerMove = (event: PointerEvent) => {
    if (this.mode !== 'walk') return;
    if (this.locked) {
      this.yaw -= event.movementX * 0.0022;
      this.pitch -= event.movementY * 0.0022;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
      return;
    }
    if (this.dragLook) {
      const dx = event.clientX - this.dragLook.x;
      const dy = event.clientY - this.dragLook.y;
      this.yaw -= dx * 0.005;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - dy * 0.005));
      this.dragLook = { x: event.clientX, y: event.clientY };
    }
  };

  private onPointerUp = (event: PointerEvent) => {
    this.dragLook = null;
    // Un clic sur un panneau de l'interface ne doit jamais agir sur le champ.
    if (event.target !== this.canvas) return;
    const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
    if (moved > 7) return;
    if (this.mode === 'orbit') {
      const picked = this.pickInteractable(event.clientX, event.clientY);
      if (picked) this.act(picked);
    } else {
      if (!this.locked) this.lock();
      this.interact();
    }
  };

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.canvas;
    this.emitSnapshot();
  };

  setMode(mode: Mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'walk') {
      this.controls.enabled = false;
      // À hauteur d'homme, les étiquettes de zones masquent le champ : le
      // faisceau de guidage et les invites suffisent.
      this.zoneMeshes.forEach((zone) => (zone.label.visible = false));
      this.slotLabels.forEach((label) => (label.visible = false));
      this.camera.fov = 66;
      this.camera.updateProjectionMatrix();
      if (!this.walked) {
        this.walked = true;
        this.player.set(START.x, 0, START.z);
        this.yaw = Math.atan2(-(0 - START.x), -(0 - START.z));
        this.pitch = -0.02;
      }
      this.velocityY = 0;
      this.keys.clear();
    } else {
      if (this.locked) document.exitPointerLock();
      if (this.guide) this.guide.visible = false;
      this.zoneMeshes.forEach((zone) => (zone.label.visible = true));
      this.slotLabels.forEach((label, index) => (label.visible = !this.planted[index]));
      this.controls.enabled = true;
      this.camera.fov = 44;
      this.camera.updateProjectionMatrix();
      this.transition = {
        position: new THREE.Vector3(this.player.x + 4, 46, this.player.z + 52),
        target: new THREE.Vector3(0, 0, 4),
      };
    }
    this.emitSnapshot();
  }

  /** Demande la capture de la souris (appelé par l'interface au clic). */
  lock() {
    if (this.mode !== 'walk' || this.locked) return;
    const element = this.canvas as HTMLCanvasElement & { requestPointerLock?: () => unknown };
    try {
      const request = element.requestPointerLock?.();
      // Chrome renvoie une promesse : dans une iframe sans permission, elle rejette.
      if (request && typeof (request as Promise<void>).catch === 'function') {
        (request as Promise<void>).catch(() => undefined);
      }
    } catch {
      // Capture refusée (iframe, permission) : le glissement fait tourner la tête.
    }
  }

  /** Touches virtuelles pour la manette tactile de l'interface. */
  pressVirtual(code: string, down: boolean) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  setInteractions(interactions: Interactions) {
    this.interactions = interactions;
  }

  /** Rotation lente du survol (utilisée sur l'écran d'accueil). */
  setAutoRotate(on: boolean) {
    this.autoRotate = on;
    this.controls.autoRotate = on && this.mode === 'orbit';
  }

  setLayer(layer: Layer) {
    this.layer = layer;
    this.zoneMeshes.forEach((entry, index) => {
      const material = entry.mesh.material as THREE.MeshBasicMaterial;
      material.color.setHex(ZONE_COLORS[layer][index]);
      material.opacity = layer === 'zones' ? 0.24 : 0.34;
      entry.edge.visible = layer === 'zones';
    });
    this.scanProgress = 0;
  }

  setHeat(on: boolean) {
    this.heat = on;
  }

  setIrrigation(on: boolean) {
    this.irrigation = on;
    this.droplets.visible = on;
  }

  /** Le kit monte par étapes : 1 panneau, 2 pluviomètre, 3 passerelle, 4 scellé. */
  setKitStage(stage: number) {
    this.panel.visible = stage >= 1;
    this.rainGauge.visible = stage >= 2;
    this.beam.visible = stage >= 3;
    this.beamPulse.visible = stage >= 3;
    this.sealTag.visible = stage >= 4;
    this.kitLeds.forEach((led, index) => {
      const material = led.material as THREE.MeshStandardMaterial;
      const lit = index < stage;
      material.color.setHex(lit ? 0x9be8c0 : 0x334155);
      material.emissive.setHex(lit ? 0x22c55e : 0x0f172a);
      material.emissiveIntensity = lit ? 1.8 : 0;
    });
  }

  plantSensor(index: number) {
    const probe = this.probes[index];
    if (!probe) return;
    this.planted[index] = true;
    probe.group.visible = true;
    probe.group.position.y = groundHeight(SLOTS[index].x, SLOTS[index].z) + 1.6;
    probe.group.rotation.set(0, 0, 0);
    const ring = this.slotRings[index];
    if (ring) ring.visible = false;
    const beacon = this.slotBeacons[index];
    if (beacon) beacon.visible = false;
    const label = this.slotLabels[index];
    if (label) label.visible = false;
    this.cutaway.position.set(SLOTS[index].x, groundHeight(SLOTS[index].x, SLOTS[index].z), SLOTS[index].z);
    this.cutaway.visible = true;
  }

  setTampered(index: number) {
    this.tamperedIndex = index;
    const probe = this.probes[index];
    if (!probe) return;
    const material = probe.led.material as THREE.MeshStandardMaterial;
    material.color.setHex(0xf87171);
    material.emissive.setHex(0xdc2626);
    const label = labelSprite('Scellé rompu', 'alert');
    probe.label.material.map?.dispose();
    probe.label.material.map = label.material.map;
    probe.label.material.needsUpdate = true;
  }

  setAlarm(on: boolean) {
    this.alarm = on;
  }

  /** Fait clignoter une sonde inspectée (retour visuel). */
  flashProbe(index: number, tone: 'ok' | 'bad') {
    const probe = this.probes[index];
    if (!probe) return;
    const material = probe.led.material as THREE.MeshStandardMaterial;
    material.emissiveIntensity = 6;
    if (tone === 'ok') {
      material.color.setHex(0x4ade80);
      material.emissive.setHex(0x22c55e);
    } else {
      material.color.setHex(0xf87171);
      material.emissive.setHex(0xdc2626);
    }
  }

  reset() {
          this.walked = false;
    this.planted = [false, false, false];
    this.inspected = [false, false, false];
    this.guideKey = '';
    this.guide.visible = false;
    this.probes.forEach((probe) => {
      probe.group.visible = false;
      probe.group.rotation.set(0, 0, 0);
      probe.group.position.y = 0;
      const material = probe.led.material as THREE.MeshStandardMaterial;
      material.color.setHex(0x4ade80);
      material.emissive.setHex(0x22c55e);
      material.emissiveIntensity = 2.2;
    });
    this.slotRings.forEach((ring) => (ring.visible = true));
    this.slotBeacons.forEach((beacon) => (beacon.visible = true));
    this.slotLabels.forEach((label) => (label.visible = true));
    this.cutaway.visible = false;
    this.heat = false;
    this.irrigation = false;
    this.alarm = false;
    this.tamperedIndex = -1;
    this.droplets.visible = false;
    this.setKitStage(0);
    this.setLayer('zones');
    this.setMode('orbit');
  }

  /** Position d'un emplacement, pour la mini-carte. */
  slotPosition(index: number) {
    return { x: SLOTS[index].x, z: SLOTS[index].z };
  }

  /* ------------------------------------------------------------------ */
  /* Interactions                                                        */
  /* ------------------------------------------------------------------ */

  private buildTargets(): { target: Nearby; x: number; z: number }[] {
    const list: { target: Nearby; x: number; z: number }[] = [];
    if (this.interactions.slots) {
      SLOTS.forEach((slot, index) => {
        if (this.planted[index]) return;
        list.push({ target: { id: `slot-${index}`, kind: 'slot', index, label: `Planter la sonde · zone ${slot.zone}` }, x: slot.x, z: slot.z });
      });
    }
    if (this.interactions.box) {
      list.push({ target: { id: 'box', kind: 'box', label: 'Raccorder un élément du kit' }, x: BOX_POS.x, z: BOX_POS.z });
    }
    if (this.interactions.valve) {
      list.push({ target: { id: 'valve', kind: 'valve', label: 'Ouvrir l’irrigation' }, x: VALVE_POS.x, z: VALVE_POS.z });
    }
    if (this.interactions.probes) {
      SLOTS.forEach((slot, index) => {
        if (!this.planted[index] || this.inspected[index]) return;
        list.push({ target: { id: `probe-${index}`, kind: 'probe', index, label: `Lire le scellé · zone ${slot.zone}` }, x: slot.x, z: slot.z });
      });
    }
    return list;
  }

  private act(target: Nearby) {
    switch (target.kind) {
      case 'slot':
        if (target.index === undefined) return;
        this.plantSensor(target.index);
        this.handlers.onEvent({ type: 'sensor', index: target.index });
        break;
      case 'box':
        this.handlers.onEvent({ type: 'kit' });
        break;
      case 'valve':
        this.setIrrigation(true);
        this.handlers.onEvent({ type: 'irrigate' });
        break;
      case 'probe':
        if (target.index === undefined) return;
        this.flashProbe(target.index, target.index === this.tamperedIndex ? 'bad' : 'ok');
        this.handlers.onEvent({ type: 'inspect', index: target.index });
        break;
    }
  }

  /** Déclenche l'action de l'élément le plus proche (touche E). */
  interact() {
    if (this.mode !== 'walk') return;
    const nearest = this.nearestTarget();
    if (nearest) this.act(nearest);
  }

  private pickInteractable(clientX: number, clientY: number): Nearby | null {
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);
    const hits = raycaster.intersectObject(this.terrain, false);
    if (hits.length === 0) return null;
    const point = hits[0].point;
    let best: { target: Nearby; distance: number } | null = null;
    for (const entry of this.buildTargets()) {
      const distance = Math.hypot(entry.x - point.x, entry.z - point.z);
      if (distance < 7 && (!best || distance < best.distance)) best = { target: entry.target, distance };
    }
    return best ? best.target : null;
  }

  /** Point utile le plus proche, dans un rayon donné (infini = guidage à distance). */
  private nearestEntry(radius = Infinity): { target: Nearby; x: number; z: number; distance: number } | null {
    let best: { target: Nearby; x: number; z: number; distance: number } | null = null;
    for (const entry of this.buildTargets()) {
      const distance = Math.hypot(entry.x - this.player.x, entry.z - this.player.z);
      if (distance < radius && (!best || distance < best.distance)) best = { ...entry, distance };
    }
    return best;
  }

  private nearestTarget(): Nearby | null {
    return this.nearestEntry(5)?.target ?? null;
  }

  private targetTitle(target: Nearby): string {
    if (target.index !== undefined) {
      const zone = SLOTS[target.index].zone;
      return target.kind === 'slot' ? `Balise ${zone}` : `Sonde ${zone}`;
    }
    return target.kind === 'box' ? 'Mât & boîtier' : 'Vanne d’irrigation';
  }

  /** Le faisceau se pose sur la cible la plus proche et bat doucement. */
  private updateGuide(delta: number) {
    if (this.mode !== 'walk') {
      this.guide.visible = false;
      return;
    }
    const entry = this.nearestEntry();
    if (!entry) {
      this.guide.visible = false;
      return;
    }
    const key = `${entry.target.kind}-${entry.target.index ?? 'x'}`;
    if (key !== this.guideKey) {
      this.guideKey = key;
      this.guide.remove(this.guideLabel);
      this.guideLabel.material.map?.dispose();
      this.guideLabel.material.dispose();
      const label = labelSprite(this.targetTitle(entry.target), 'tech');
      label.scale.set(5, 1.25, 1);
      label.position.set(0, 4.6, 0);
      this.guide.add(label);
      this.guideLabel = label;
      const tone = entry.target.kind === 'valve' ? 0xffc46b : 0x9be8c0;
      (this.guideCore.material as THREE.MeshBasicMaterial).color.setHex(tone);
      (this.guideHalo.material as THREE.MeshBasicMaterial).color.setHex(tone);
      (this.guideRing.material as THREE.MeshBasicMaterial).color.setHex(tone);
      this.guide.position.set(entry.x, groundHeight(entry.x, entry.z), entry.z);
    }
    this.guide.visible = !this.nearby;
    // De tout près, l'étiquette envahirait l'écran : le faisceau et l'invite suffisent.
    this.guideLabel.visible = entry.distance > 10;
    const y = groundHeight(entry.x, entry.z);
    this.guide.position.x += (entry.x - this.guide.position.x) * Math.min(1, delta * 6);
    this.guide.position.z += (entry.z - this.guide.position.z) * Math.min(1, delta * 6);
    this.guide.position.y = y;
    const pulse = 0.5 + Math.sin(this.time * 2.4) * 0.5;
    (this.guideHalo.material as THREE.MeshBasicMaterial).opacity = 0.05 + pulse * 0.08;
    (this.guideCore.material as THREE.MeshBasicMaterial).opacity = 0.2 + pulse * 0.16;
    (this.guideRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + pulse * 0.4;
  }

  private emitSnapshot() {
    const focus = this.mode === 'walk' ? this.nearestEntry() : null;
    this.handlers.onSnapshot({
      x: this.player.x,
      z: this.player.z,
      yaw: this.yaw,
      mode: this.mode,
      locked: this.locked,
      waypoint: focus
        ? { x: focus.x, z: focus.z, label: this.targetTitle(focus.target), distance: focus.distance }
        : null,
    });
  }

  /** Une sonde lue cesse d'être proposée au guidage. */
  markInspected(index: number) {
    this.inspected[index] = true;
  }

  /* ------------------------------------------------------------------ */
  /* Boucle                                                              */
  /* ------------------------------------------------------------------ */

  private updatePlayer(delta: number) {
    const sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = sprint ? 11.6 : 6.2;
    let forward = 0;
    let strafe = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) forward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) forward -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) strafe += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) strafe -= 1;

    const length = Math.hypot(forward, strafe);
    if (length > 0) {
      forward /= length;
      strafe /= length;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      this.player.x += (-sin * forward + cos * strafe) * speed * delta;
      this.player.z += (-cos * forward - sin * strafe) * speed * delta;
      this.bob += delta * (sprint ? 12 : 8);
    } else {
      this.bob += delta * 1.6;
    }

    // Débord de la parcelle : on reste dans le champ et ses abords.
    this.player.x = Math.max(-74, Math.min(74, this.player.x));
    this.player.z = Math.max(-64, Math.min(64, this.player.z));

    // Le mât et la passerelle sont solides.
    const push = (cx: number, cz: number, radius: number) => {
      const dx = this.player.x - cx;
      const dz = this.player.z - cz;
      const distance = Math.hypot(dx, dz);
      if (distance < radius && distance > 0.0001) {
        this.player.x = cx + (dx / distance) * radius;
        this.player.z = cz + (dz / distance) * radius;
      }
    };
    push(BOX_POS.x, BOX_POS.z, 1.5);

    // Saut et gravité.
    this.velocityY -= 16 * delta;
    this.player.y += this.velocityY * delta;
    const floor = 0;
    if (this.player.y <= floor) {
      this.player.y = floor;
      this.velocityY = 0;
      this.onGround = true;
    }

    const eye = groundHeight(this.player.x, this.player.z) + 1.68 + this.player.y;
    const bobOffset = Math.abs(Math.sin(this.bob)) * 0.035 * (length > 0 ? 1 : 0.2);
    this.camera.position.set(this.player.x, eye + bobOffset, this.player.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }

  private animate() {
    if (this.disposed) return;
    if (this.disposed || this.contextLost) return;
    this.raf = requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, this.clock.getDelta());
    this.time += delta;

    if (this.mode === 'orbit') {
      this.controls.autoRotate = this.autoRotate;
      if (this.transition) {
        this.camera.position.lerp(this.transition.position, 0.05);
        this.controls.target.lerp(this.transition.target, 0.06);
        if (this.camera.position.distanceTo(this.transition.position) < 0.8) this.transition = null;
      }
      this.controls.update();
    } else {
      this.updatePlayer(delta);
      this.updateGuide(delta);
      // Rapport à l'interface : 8 fois par seconde suffit.
      this.tickTimer += delta;
      if (this.tickTimer > 0.12) {
        this.tickTimer = 0;
        const nearest = this.nearestTarget();
        if (nearest?.id !== this.nearby?.id) {
          this.nearby = nearest;
          this.handlers.onNearby(nearest);
        }
        this.emitSnapshot();
      }
    }

    /* Chaleur : sol clair, feuillage jauni, lumière basse. */
    this.heatMix += ((this.heat ? 1 : 0) - this.heatMix) * Math.min(1, delta * 2.2);
    if (Math.abs(this.plantMix - (this.heat ? 1 : 0)) > 0.004) {
      this.plantMix += ((this.heat ? 1 : 0) - this.plantMix) * Math.min(1, delta * 1.8);
      const dry = new THREE.Color(PALETTE.leafDry);
      for (let i = 0; i < this.plantBase.length; i += 1) {
        this.plants.setColorAt(i, this.plantBase[i].clone().lerp(dry, this.plantMix * 0.82));
      }
      if (this.plants.instanceColor) this.plants.instanceColor.needsUpdate = true;
    }

    const dry = this.heatMix;
    const wet = this.irrigation ? 1 : 0;
    const bedColor = new THREE.Color(PALETTE.bed)
      .lerp(new THREE.Color(PALETTE.dryLoam), dry * 0.5)
      .lerp(new THREE.Color(PALETTE.wetLoam), wet * 0.4);
    this.bedMaterial.color.lerp(bedColor, Math.min(1, delta * 2.2));

    this.sun.intensity = 2.35 + dry * 0.7;
    this.sun.color.lerpColors(new THREE.Color(0xffeccb), new THREE.Color(0xffcf96), dry);
    if (this.skyMaterial) (this.skyMaterial.uniforms.haze.value as number) = dry * 0.6;
    const fog = this.scene.fog as THREE.Fog;
    fog.color.lerpColors(new THREE.Color(0xd8d2bd), new THREE.Color(0xf0d5b2), dry);

    if (this.irrigation) {
      this.flowTexture.offset.x -= delta * 0.55;
      this.flowMaterial.emissiveIntensity = 0.7 + Math.sin(this.time * 3) * 0.18;
      const positions = this.droplets.geometry.attributes.position as THREE.BufferAttribute;
      const array = positions.array as Float32Array;
      for (let i = 0; i < this.dropletVelocity.length; i += 1) {
        const yIndex = i * 3 + 1;
        array[yIndex] -= this.dropletVelocity[i] * delta;
        if (array[yIndex] < 0.45) array[yIndex] = 3.4;
      }
      positions.needsUpdate = true;
    } else {
      this.flowMaterial.emissiveIntensity = 0.04;
    }

    const moistureMaterial = this.moistureVolume.material as THREE.MeshBasicMaterial;
    const targetScale = this.irrigation ? 2.1 : 1.4;
    const next = this.moistureVolume.scale.x + (targetScale - this.moistureVolume.scale.x) * Math.min(1, delta * 1.6);
    this.moistureVolume.scale.set(next, next * 0.36, next);
    moistureMaterial.opacity = 0.14 + (this.irrigation ? 0.16 + Math.sin(this.time * 2.4) * 0.04 : 0);

    /* Balises : respiration. */
    const pulse = 0.5 + Math.sin(this.time * 2.2) * 0.5;
          this.slotRings.forEach((ring, index) => {
      if (!ring.visible) return;
      (ring.material as THREE.MeshBasicMaterial).opacity = 0.45 + pulse * 0.5;
      ring.scale.setScalar(1 + pulse * 0.1);
      const beacon = this.slotBeacons[index];
      (beacon.material as THREE.MeshBasicMaterial).opacity = 0.1 + pulse * 0.26;
    });

    /* Onde de scan après changement de calque. */
    if (this.scanProgress < 1) {
      this.scanProgress = Math.min(1, this.scanProgress + delta * 0.5);
      const s = 6 + this.scanProgress * 90;
      this.scanRing.scale.setScalar(s / 1.5);
      (this.scanRing.material as THREE.MeshBasicMaterial).opacity = (1 - this.scanProgress) * 0.5;
    } else {
      (this.scanRing.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    /* Sondes : chute à la plantation, inclinaison si trafiquée. */
    this.probes.forEach((probe, index) => {
      if (!probe.group.visible) return;
      const ground = groundHeight(SLOTS[index].x, SLOTS[index].z);
      const tilt = index === this.tamperedIndex ? -0.5 : 0;
      probe.group.position.y += (ground - probe.group.position.y) * Math.min(1, delta * 4);
      probe.group.rotation.z += (tilt - probe.group.rotation.z) * Math.min(1, delta * 3);
      const ledMaterial = probe.led.material as THREE.MeshStandardMaterial;
      ledMaterial.emissiveIntensity += (2.2 - ledMaterial.emissiveIntensity) * Math.min(1, delta * 2);
    });

    /* Boîtier : inclinaison d'alarme + voies lumineuses. */
    const targetTilt = this.alarm ? 0.34 : 0;
    this.boxGroup.rotation.z += (targetTilt - this.boxGroup.rotation.z) * Math.min(1, delta * 3);

    /* Vanne : le volant tourne quand l'eau passe. */
    if (this.irrigation) this.valveWheel.rotation.y += delta * 1.4;

    /* Faisceau LoRa. */
    if (this.beam.visible) {
      const progress = (this.time * 0.22) % 1;
      this.beamPulse.position.copy(this.beamCurve.getPoint(progress));
      const gatewayLed = this.gateway.getObjectByName('gateway-led') as THREE.Mesh | undefined;
      if (gatewayLed) {
        (gatewayLed.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6 + Math.sin(this.time * 3) * 1.1;
      }
    }

    /* Nuages et poussière. */
    for (const cloud of this.clouds) {
      cloud.position.x += delta * 1.6;
      if (cloud.position.x > 700) cloud.position.x = -700;
    }
    this.dust.rotation.y = this.time * 0.012;

    /* Coupe du sol : on la pose près du visiteur si une sonde est proche. */
    if (this.cutaway.visible) {
      let best = -1;
      let bestDistance = Infinity;
      this.planted.forEach((isPlanted, index) => {
        if (!isPlanted) return;
        const distance = Math.hypot(SLOTS[index].x - this.camera.position.x, SLOTS[index].z - this.camera.position.z);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      if (best >= 0 && bestDistance < 16) {
        const slot = SLOTS[best];
        const y = groundHeight(slot.x, slot.z);
        this.cutaway.position.lerp(new THREE.Vector3(slot.x, y, slot.z), Math.min(1, delta * 3));
      }
    }

    this.renderer.render(this.scene, this.camera);
  }

  /* ------------------------------------------------------------------ */

  private resize() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.controls.dispose();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else if (material) {
        const map = (material as THREE.MeshStandardMaterial).map;
        map?.dispose();
        material.dispose();
      }
    });
    this.renderer.dispose();
  }
}
