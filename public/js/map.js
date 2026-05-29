//region === Imports ===
import { bus } from "/js/busSingleton.js";
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js';
import { smellVertexShader } from '../shaders/smell/vertex.js';
import { smellFragmentShader } from '../shaders/smell/fragment.js';

const textureLoader = new THREE.TextureLoader();

const perlinTexture = textureLoader.load('../textures/perlin.png')
perlinTexture.wrapS = THREE.RepeatWrapping
perlinTexture.wrapT = THREE.RepeatWrapping

//endregion

//region === Variables ===
export let map;
const MAPBOX_KEY = window.CONFIG.MAPBOX_KEY;

// Scene origin in geographic space. All three.js objects (particles, tree,
// building) are positioned in scene-local meters relative to this point. The
// custom layer's sceneMatrix handles the meters -> Mercator transform.
const SCENE_ORIGIN_LNG = -105.26922;
const SCENE_ORIGIN_LAT = 40.00696;

// Asset URLs and placement
const PARTICLE_GEOJSON_NORLIN_URL = '/geojson/EngineeringToNorlin.geojson';
const PARTICLE_GEOJSON_C4C_URL = '/geojson/EngineeringToC4C.geojson';
const PARTICLE_TEXTURE_URL = '/textures/3.png';
const BUILDING_GLB_URL     = '/models/TreePark.glb';

const SMELL_LNG = -105.2662792;
const SMELL_LAT = 40.005642;

const NEW_BUILDING_LNG = -105.2743234;
const NEW_BUILDING_LAT =  40.0099835;
const NEW_BUILDING_ROT = Math.PI;   // radians, around Y (vertical)
const NEW_BUILDING_Y = -10.0;    // meters, relative to the scene origin
const NEW_BUILDING_SCL = 70.0;

const WINDOW_LNG = -105.2669336;
const WINDOW_LAT =   40.0083357;
const WINDOW_SIZE = 200;   // meters

// Particle system config
const PARTICLE_COUNT   = 500;
const PATH_SAMPLES     = 1028;
const SPEED_SAMPLES    = 1028;
const GRADIENT_SAMPLES = 256;

const params = {
    curveSmoothness: 0.35,
    speed:           0.51,
    jitter:          2.65,
    variability:     0.1,
    particleSize:    3.5,        // pixels — was 2.0 meters
    segmentPosition: 0.84,
    segmentSpeedMul: 0.1,
    segmentWidth:    0.211,
};

const gradientStops = [
    { position: 0.0, color: '#4de8d7' },
    { position: 0.738, color: '#4de8d7' },
    { position: 0.921, color: '#4de8d7' },
    { position: 0.856, color: '#ffa2b8', name: 'Time Marker', locked: true },
];

// Module-level state (assigned by the custom layer's onAdd / buildParticles)
let particleMaterial = null;
let segmentPositionController = null;   // lil-gui controller for params.segmentPosition
let timeMarkerController      = null;   // lil-gui controller for the locked red stop's position
let treeMaterial     = null;
let pathPoints       = null;
let colorFolder      = null;
let stopFolders      = [];

let currentLightingStyle = null;
//endregion

//region === Helper Functions ===
function getBboxCenter(geometry) {
    let coords;
    if (geometry.type === "Polygon")           coords = geometry.coordinates[0];
    else if (geometry.type === "MultiPolygon") coords = geometry.coordinates[0][0];
    else if (geometry.type === "Point")        return geometry.coordinates;
    else throw new Error("Unsupported geometry type: " + geometry.type);

    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
    }
    return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

/**
 * Project a geographic point into scene-local meters, relative to
 * (SCENE_ORIGIN_LNG, SCENE_ORIGIN_LAT). Scene axes: X east, Y up, Z south.
 * (Z south matches the sceneMatrix's rotateX+scale conventions in render().)
 */
function lngLatToScene(lng, lat, altitude = 0) {
    const mLat = 111320;
    const mLng = 111320 * Math.cos(SCENE_ORIGIN_LAT * Math.PI / 180);
    return new THREE.Vector3(
        (lng - SCENE_ORIGIN_LNG) * mLng,
        altitude,
        -(lat - SCENE_ORIGIN_LAT) * mLat
    );
}

function projectCoords(coords) {
    return coords.map(([lng, lat]) => lngLatToScene(lng, lat, 0));
}
//endregion

//region === Three.js helpers: path / speed / gradient textures ===

function sampleLinearPath(points, sampleCount) {
    const cumDist = [0];
    for (let i = 1; i < points.length; i++) {
        cumDist.push(cumDist[i - 1] + points[i].distanceTo(points[i - 1]));
    }
    const total = cumDist[cumDist.length - 1];
    const result = new Array(sampleCount);
    for (let i = 0; i < sampleCount; i++) {
        const target = (i / (sampleCount - 1)) * total;
        let j = 0;
        while (j < points.length - 2 && cumDist[j + 1] < target) j++;
        const segLen = cumDist[j + 1] - cumDist[j];
        const local  = segLen > 0 ? (target - cumDist[j]) / segLen : 0;
        result[i] = new THREE.Vector3().lerpVectors(points[j], points[j + 1], local);
    }
    return result;
}

function buildPathTexture(points, sampleCount, curveSmoothness) {
    const linearSamples = sampleLinearPath(points, sampleCount);
    const curve         = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const curveSamples  = curve.getSpacedPoints(sampleCount - 1);

    const data = new Float32Array(sampleCount * 4);
    const v    = new THREE.Vector3();
    for (let i = 0; i < sampleCount; i++) {
        v.lerpVectors(linearSamples[i], curveSamples[i], curveSmoothness);
        data[i * 4 + 0] = v.x;
        data[i * 4 + 1] = v.y;
        data[i * 4 + 2] = v.z;
        data[i * 4 + 3] = 1.0;
    }
    const tex = new THREE.DataTexture(data, sampleCount, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS     = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

function buildSpeedMapTexture(segPos, segMul, segWidth, sampleCount) {
    const N = sampleCount;
    const invSpeed = new Float32Array(N);
    const safeW = Math.max(0.005, segWidth);

    for (let i = 0; i < N; i++) {
        const u = i / (N - 1);
        const d = (u - segPos) / safeW;
        const influence = Math.exp(-d * d);
        const speed = Math.max(0.05, 1.0 + (segMul - 1.0) * influence);
        invSpeed[i] = 1 / speed;
    }

    const T = new Float32Array(N);
    const du = 1 / (N - 1);
    T[0] = 0;
    for (let i = 1; i < N; i++) {
        T[i] = T[i - 1] + (invSpeed[i - 1] + invSpeed[i]) * 0.5 * du;
    }
    const total = T[N - 1];
    for (let i = 0; i < N; i++) T[i] /= total;

    const data = new Float32Array(N * 4);
    let j = 0;
    for (let i = 0; i < N; i++) {
        const tau = i / (N - 1);
        while (j < N - 2 && T[j + 1] < tau) j++;
        const span = T[j + 1] - T[j];
        const localT = span > 1e-9 ? (tau - T[j]) / span : 0;
        const u = (j + localT) / (N - 1);
        data[i * 4 + 0] = u;
        data[i * 4 + 3] = 1.0;
    }
    const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.wrapS     = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}

function buildGradientTexture(stops, width) {
    if (stops.length === 0) stops = [{ position: 0.5, color: '#ffffff' }];

    const sorted = [...stops].sort((a, b) => a.position - b.position);
    const data = new Uint8Array(width * 4);
    const cA = new THREE.Color(), cB = new THREE.Color(), out = new THREE.Color();

    let j = 0;
    for (let i = 0; i < width; i++) {
        const t = i / (width - 1);
        if (t <= sorted[0].position) {
            out.set(sorted[0].color);
        } else if (t >= sorted[sorted.length - 1].position) {
            out.set(sorted[sorted.length - 1].color);
        } else {
            while (j < sorted.length - 2 && sorted[j + 1].position < t) j++;
            const a = sorted[j], b = sorted[j + 1];
            const span = b.position - a.position;
            const localT = span > 1e-9 ? (t - a.position) / span : 0;
            cA.set(a.color); cB.set(b.color);
            out.copy(cA).lerp(cB, localT);
        }
        data[i * 4 + 0] = Math.round(out.r * 255);
        data[i * 4 + 1] = Math.round(out.g * 255);
        data[i * 4 + 2] = Math.round(out.b * 255);
        data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS     = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
}
//endregion

//region === Three.js Shaders ===

// ---------- Particle shaders -----------------------------------------------
const particleVertexShader = /* glsl */ `
  uniform float     uTime;
  uniform float     uSpeed;
  uniform float     uJitter;
  uniform float     uVariability;
  uniform float     uParticleSize;   // now in PIXELS, not meters
  uniform vec2      uViewport;       // canvas dimensions in pixels

  uniform sampler2D uPathTex;
  uniform float     uPathLength;
  uniform sampler2D uSpeedMap;
  uniform sampler2D uGradientTex;

  attribute float aOffset;
  attribute float aSpeedMul;
  attribute vec3  aJitterSeed;

  varying vec2 vUv;
  varying vec3 vColor;

  vec3 samplePath(float t) {
    float clamped = clamp(t, 0.0, 1.0);
    float u = (clamped * (uPathLength - 1.0) + 0.5) / uPathLength;
    return texture2D(uPathTex, vec2(u, 0.5)).rgb;
  }

  void main() {
    // Per-particle variability and time-warped position
    float speedFactor = mix(1.0, aSpeedMul, uVariability);
    float tau = mod(aOffset + uTime * uSpeed * speedFactor * 0.04, 1.0);
    float t   = texture2D(uSpeedMap, vec2(tau, 0.5)).r;

    // Path position + organic jitter
    vec3 center = samplePath(t);
    vec3 ahead  = samplePath(t + 0.003);
    vec3 fwd    = normalize(ahead - center + vec3(1e-5));
    vec3 side   = normalize(cross(fwd,  vec3(0.0, 1.0, 0.0)));
    vec3 upL    = normalize(cross(side, fwd));

    float j1 = sin(uTime * 2.1 + aJitterSeed.x * 6.2831);
    float j2 = cos(uTime * 1.7 + aJitterSeed.y * 6.2831);
    float j3 = sin(uTime * 1.3 + aJitterSeed.z * 6.2831);
    vec3 jitter = (side * j1 + upL * j2 + fwd * j3) * uJitter;

    // Project center to clip space FIRST
    vec4 clipCenter = projectionMatrix * modelViewMatrix * vec4(center + jitter, 1.0);

    // Add the quad offset in PIXEL-space. position.xy is in [-0.5, 0.5].
    // (2.0 / viewport) converts pixels to NDC units; multiplying by clipCenter.w
    // counteracts the perspective divide so size stays consistent.
    vec2 quadPixels = position.xy * uParticleSize;
    clipCenter.xy += quadPixels * (2.0 / uViewport) * clipCenter.w;

    vColor = texture2D(uGradientTex, vec2(t, 0.5)).rgb;
    vUv    = uv;

    gl_Position = clipCenter;
  }
`;

const particleFragmentShader = /* glsl */ `
  uniform sampler2D uParticleTex;
  varying vec2 vUv;
  varying vec3 vColor;

  void main() {
    vec4 tex = texture2D(uParticleTex, vUv);
    if (tex.a < 0.01) discard;
    gl_FragColor = vec4(vColor * tex.a, tex.a);
  }
`;

// ---------- Window (sound-wave passthrough) shaders ------------------------
const windowVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveAmp;
  uniform float uWaveFreq;
  uniform float uWaveSpeed;

  varying vec2  vUv;
  varying vec4  vScreenPos;
  varying float vWave;

  void main() {
    vUv = uv;

    // Concentric ripples emanating from the plane's UV center.
    vec2  centered = uv - 0.5;
    float dist     = length(centered);
    float wave     = sin(dist * uWaveFreq - uTime * uWaveSpeed);

    // Soft circular falloff so the plane lies flat at its rim
    // — no hard discontinuity where the disc meets its edges.
    float falloff  = 1.0 - smoothstep(0.0, 0.55, dist);

    // The mesh is rotated -PI/2 around X to lie flat, so local +Z is
    // the world vertical here — displace along local Z for the "lift".
    vec3 displaced = position + vec3(0.0, 0.0, wave * uWaveAmp * falloff);

    vec4 clip   = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    gl_Position = clip;
    vScreenPos  = clip;       // pass clip-space pos for screen-UV reconstruction
    vWave       = wave * falloff;
  }
`;

const windowFragmentShader = /* glsl */ `
  uniform sampler2D uScreen;
  uniform vec2      uResolution;
  uniform float     uTime;
  uniform float     uScale;       // fragment-side UV distortion magnitude
  uniform float     uWaveFreq;
  uniform float     uWaveSpeed;

  varying vec2  vUv;
  varying vec4  vScreenPos;
  varying float vWave;

  void main() {
    // Screen-space UV — what's directly behind this fragment on the canvas.
    // Perspective divide turns clip space into NDC, then 0.5+0.5 maps to [0,1].
    vec2 screenUv = (vScreenPos.xy / vScreenPos.w) * 0.5 + 0.5;

    // Recompute the ripple at fragment resolution; vertex interpolation
    // alone would alias visibly at the frequencies we want.
    vec2  centered = vUv - 0.5;
    float dist     = length(centered);
    vec2  dir      = dist > 1e-4 ? centered / dist : vec2(0.0);
    float falloff  = 1.0 - smoothstep(0.0, 0.55, dist);

    float wave  = sin(dist * uWaveFreq        - uTime * uWaveSpeed);
    float waveT = cos(dist * uWaveFreq * 1.3  - uTime * uWaveSpeed * 1.1);

    // Radial push + tangential shimmer — bends the sampled basemap
    // outward/inward on the crests, with a sideways jitter for richness.
    vec2 tangent = vec2(-dir.y, dir.x);
    vec2 offset  = (dir * wave + tangent * waveT * 0.4) * uScale * falloff;

    // Tiny chromatic separation along the ripple direction — reads as
    // dispersion through compressed air.
    float ca = 0.0035 * falloff;
    vec3  col;
    col.r = texture2D(uScreen, screenUv + offset + dir * ca).r;
    col.g = texture2D(uScreen, screenUv + offset            ).g;
    col.b = texture2D(uScreen, screenUv + offset - dir * ca).b;

    // Bright crests / soft troughs give the ripples 3D readability.
    float crest  = smoothstep(0.7, 1.0,  wave) * falloff;
    float trough = smoothstep(0.7, 1.0, -wave) * falloff;
    col += vec3(0.10) * crest;
    col -= vec3(0.05) * trough;

    gl_FragColor = vec4(col, falloff);
  }
`;
//endregion

//region === Mapbox setup ===
mapboxgl.accessToken = MAPBOX_KEY;

const bounds = [
    [-105.27707102527657, 40.0030404925513],
    [-105.25725037599734, 40.015062824363255]
];

map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/virginiwoolf/cmkag1i8q00e201svft695qx1',
    center: [-105.26696020273963, 40.00821825269933],
    zoom: 10,
    pitch: 45,
    bearing: -180,
    maxBounds: bounds
});

const popup = new mapboxgl.Popup({ offset: 25 }).setText("ENVD");

const tb = (window.tb = new Threebox(
    map,
    map.getCanvas().getContext('webgl'),
    { defaultLights: true }
));
//endregion

//region === Texture rebuild + GUI helpers ===
function rebuildPathTexture() {
    if (!particleMaterial || !pathPoints) return;
    particleMaterial.uniforms.uPathTex.value.dispose();
    particleMaterial.uniforms.uPathTex.value =
        buildPathTexture(pathPoints, PATH_SAMPLES, params.curveSmoothness);
}

function rebuildSpeedMap() {
    if (!particleMaterial) return;
    particleMaterial.uniforms.uSpeedMap.value.dispose();
    particleMaterial.uniforms.uSpeedMap.value = buildSpeedMapTexture(
        params.segmentPosition, params.segmentSpeedMul, params.segmentWidth, SPEED_SAMPLES
    );
}

function rebuildGradient() {
    if (!particleMaterial) return;
    particleMaterial.uniforms.uGradientTex.value.dispose();
    particleMaterial.uniforms.uGradientTex.value =
        buildGradientTexture(gradientStops, GRADIENT_SAMPLES);
}

function rebuildStopFolders() {
    stopFolders.forEach(f => f.destroy());
    stopFolders = [];
    timeMarkerController = null;   // re-captured below if the locked stop survived

    gradientStops.forEach((stop, idx) => {
        const folder = colorFolder.addFolder(stop.name || `Section ${idx + 1}`);

        const posCtrl = folder.add(stop, 'position', 0, 1, 0.001)
            .name('position').onChange(rebuildGradient);
        folder.addColor(stop, 'color').name('color').onChange(rebuildGradient);

        // Locked stops can't be removed from the GUI; their position is
        // driven externally (by the time bar) but still tweakable by hand.
        if (gradientStops.length > 1 && !stop.locked) {
            folder.add({
                remove: () => {
                    gradientStops.splice(idx, 1);
                    rebuildStopFolders();
                    rebuildGradient();
                }
            }, 'remove').name('× remove');
        }

        if (stop.locked) timeMarkerController = posCtrl;

        stopFolders.push(folder);
    });
}

function SetRain(isSet){
    if(isSet){
        map.setSnow({
            density: 0.85,
            intensity: 1,
            color: '#FFFFFF',
            opacity: 1,
            'center-thinning': 0.4,
            direction: [0, 50],
            'flake-size': 0.71,
            vignette: 0.3,
            vignetteColor: '#FFFFFF'
        })
    }
    else{
        map.setSnow({
            density: 0.00,
            intensity: 0,
            color: '#FFFFFF',
            opacity: 0,
            'center-thinning': 0.4,
            direction: [0, 50],
            'flake-size': 0.71,
            vignette: 0.3,
            vignetteColor: '#FFFFFF'
        })
    }
}



function addGradientStop() {
    const positions = gradientStops.map(s => s.position).sort((a, b) => a - b);
    const newPos = positions.length > 1
        ? (positions[0] + positions[positions.length - 1]) / 2
        : 0.5;
    gradientStops.push({ position: newPos, color: '#ffffff' });
    rebuildStopFolders();
    rebuildGradient();
}

let smellFolder = null;

function buildGui() {
    const gui = new GUI();


    colorFolder = gui.addFolder('Path Gradient');
    colorFolder.add({ addStop: addGradientStop }, 'addStop').name('+ add section');
    rebuildStopFolders();
    colorFolder.close()

    smellFolder = gui.addFolder('Smell');

    if (threeCustomLayer.smellMaterial) {
        smellFolder.addColor(threeCustomLayer.smellMaterial.uniforms.uDepthColor, 'value').name('Shadow Color');
        smellFolder.addColor(threeCustomLayer.smellMaterial.uniforms.uSurfaceColor, 'value').name('Highlight Color');
    }
}
//endregion

//region === Custom Mapbox layer: direct three.js (no Threebox) ===
/**
 * A Mapbox CustomLayerInterface that hosts a three.js scene containing:
 *   - the GeoJSON-driven particle flow
 *   - a swaying tree (BoxGeometry + custom vertex shader)
 *   - a GLB building loaded via GLTFLoader
 *
 * All objects live in a single scene whose origin is (SCENE_ORIGIN_LNG,
 * SCENE_ORIGIN_LAT) at altitude 0. The sceneMatrix below maps scene-local
 * meters into Mapbox's Mercator coordinate space; multiplying it by the
 * Mapbox-provided projection matrix each frame keeps the three.js camera
 * locked to the map's camera.
 */
const threeCustomLayer = {
    id: 'three-particle-flow',
    type: 'custom',
    renderingMode: '3d',
    slot: 'top',

    onAdd: function (map, gl) {
        this.map    = map;
        this.scene  = new THREE.Scene();
        this.camera = new THREE.Camera();
        this.clock  = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer({
            canvas: map.getCanvas(),
            context: gl,
            antialias: true
        });
        this.renderer.autoClear = false;

        // Scene -> Mercator transform.
        const originMC = mapboxgl.MercatorCoordinate.fromLngLat(
            [SCENE_ORIGIN_LNG, SCENE_ORIGIN_LAT], 0
        );
        const s = originMC.meterInMercatorCoordinateUnits();
        this.sceneMatrix = new THREE.Matrix4()
            .makeTranslation(originMC.x, originMC.y, originMC.z)
            .scale(new THREE.Vector3(s, -s, s))
            .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));

        // Lights — needed for the GLB building, harmless for the rest.
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.0));
        const sun = new THREE.DirectionalLight(0xffffff, 0.9);
        sun.position.set(50, 100, 30);
        this.scene.add(sun);

        // Preload the particle texture once. It survives across rebuilds
        // because the same Texture is reused in every particleMaterial.
        this.particleTexture = new THREE.TextureLoader().load(PARTICLE_TEXTURE_URL);

        // State that _buildParticles populates and may need to clean up
        // on a subsequent build (when the user searches a different target).
        this.particleMesh   = null;
        this.referenceLine  = null;
        this.guiBuilt       = false;

        // Static scene elements that don't depend on the search.
        this._loadBuilding();
        this._buildSmell();
        this._buildWindow()

        // Particles are NOT built until the user selects one of the
        // search targets. Map search IDs to their respective GeoJSON paths;
        // anything not in this table just no-ops.
        const SEARCH_TO_GEOJSON = {
            "C4C":    PARTICLE_GEOJSON_C4C_URL,
            "norlin": PARTICLE_GEOJSON_NORLIN_URL,
        };

        this._searchListener = (e) => {
            const url = SEARCH_TO_GEOJSON[e.detail.id];
            if (!url) return;   // unrelated search result, ignore

            this._buildParticles(url).catch(err =>
                console.error('Failed to build particles:', err));

            // Open the sidebar and time bar to accompany the activated path.
            document.dispatchEvent(new CustomEvent("sidebar:open"));
        };
        document.addEventListener("search:select", this._searchListener);
    },

    _loadBuilding: function () {
        const WATER_LEVEL  = -0.1;    // scene-local meters — match your lake altitude
        const EDGE_FEATHER = 1.5;    // feather width in meters at the waterline

        // Stored on the layer so render() can drive uTime each frame.
        // uTreeHeight should match the GLB's local-space height extent —
        // adjust it until the sway amplitude feels right at the crown.
        this.terrainWindUniforms = {
            uTime:          { value: 0 },
            uWindStrength:  { value: 0.0 },
            uWindFrequency: { value: 0.6 },
            uTreeHeight:    { value: 2.5 },
            uWindDirection: { value: new THREE.Vector2(1.0, 0.3) },
        };

        const loader = new GLTFLoader();
        loader.load(BUILDING_GLB_URL, (gltf) => {
            const model = gltf.scene;

            // Capture the reference before traversal so the closure holds it
            const sharedUniforms = this.terrainWindUniforms;

            model.traverse((child) => {
                if (!child.isMesh) return;

                child.material.transparent = true;
                child.material.depthWrite  = true;

                child.material.onBeforeCompile = (shader) => {

                    // Water clip uniforms
                    shader.uniforms.uWaterLevel  = { value: WATER_LEVEL };
                    shader.uniforms.uEdgeFeather = { value: EDGE_FEATHER };

                    // Wind sway uniforms — shared objects so .value writes
                    // from render() propagate into every compiled program
                    Object.assign(shader.uniforms, sharedUniforms);

                    // ── Vertex shader ─────────────────────────────────────────
                    shader.vertexShader = shader.vertexShader.replace(
                        '#include <common>',
                        `
                    #include <common>
                    uniform float uTime;
                    uniform float uWindStrength;
                    uniform float uWindFrequency;
                    uniform float uTreeHeight;
                    uniform vec2  uWindDirection;
                    varying float vWorldY;
                    `
                    ).replace(
                        '#include <begin_vertex>',
                        `
                    #include <begin_vertex>

                    // Height factor: 0 at base, 1 at crown.
                    // Clamped so buried vertices can't sway backward.
                    float h = clamp(transformed.y / uTreeHeight, 0.0, 1.0);
                    float swayFactor = h * h;

                    // Primary sway — slow whole-body lean along wind direction
                    vec2 windDir  = normalize(uWindDirection);
                    float primary = sin(uTime * uWindFrequency)
                                    * uWindStrength * swayFactor;

                    // Secondary flutter — faster, per-vertex phase offset for
                    // the loose organic look of canopy / upper terrain surface
                    vec2  windPerp  = vec2(-windDir.y, windDir.x);
                    float secondary = sin(uTime * uWindFrequency * 2.7
                                         + transformed.x * 0.8
                                         + transformed.z * 0.8)
                                      * uWindStrength * 0.25 * swayFactor;

                    transformed.x += windDir.x * primary + windPerp.x * secondary;
                    transformed.z += windDir.y * primary + windPerp.y * secondary;

                    // Arc-length correction: tip drops when leaning so the
                    // mesh doesn't appear to stretch taller during sway
                    float swayDrop = (primary * primary)
                                     / (2.0 * max(uTreeHeight, 0.001));
                    transformed.y -= swayFactor * swayDrop;

                    // World-space Y computed AFTER sway so the clip plane
                    // matches the visually displaced geometry, not the rest pose
                    vWorldY = (modelMatrix * vec4(transformed, 1.0)).y;
                    `
                    );

                    // ── Fragment shader ───────────────────────────────────────
                    shader.fragmentShader = shader.fragmentShader.replace(
                        '#include <common>',
                        `
                    #include <common>
                    uniform float uWaterLevel;
                    uniform float uEdgeFeather;
                    varying float vWorldY;
                    `
                    ).replace(
                        '#include <dithering_fragment>',
                        `
                    #include <dithering_fragment>

                    float distAboveWater = vWorldY - uWaterLevel;
                    if (distAboveWater < -uEdgeFeather) discard;
                    float waterEdge = smoothstep(-uEdgeFeather, uEdgeFeather, distAboveWater);
                    gl_FragColor.a *= waterEdge;
                    `
                    );
                };

                // A unique cache key forces three.js to compile a separate
                // program variant — prevents the patched shader from being
                // confused with any other material that uses the same base
                child.material.customProgramCacheKey = () => 'terrain_sway_waterclip';
            });

            model.position.copy(lngLatToScene(NEW_BUILDING_LNG, NEW_BUILDING_LAT, 0));
            model.rotation.y = NEW_BUILDING_ROT;
            model.scale.setScalar(NEW_BUILDING_SCL);
            this.scene.add(model);
        });
    },

    _buildParticles: async function (geojsonUrl) {
        // ── Teardown: dispose previous particle mesh and reference line ────
        // Reusing this.particleTexture and the shared uniform objects
        // (params, gradientStops) so the user's GUI tweaks persist.
        if (this.particleMesh) {
            this.scene.remove(this.particleMesh);
            this.particleMesh.geometry.dispose();
            const prev = this.particleMesh.material;
            if (prev) {
                if (prev.uniforms.uPathTex.value)     prev.uniforms.uPathTex.value.dispose();
                if (prev.uniforms.uSpeedMap.value)    prev.uniforms.uSpeedMap.value.dispose();
                if (prev.uniforms.uGradientTex.value) prev.uniforms.uGradientTex.value.dispose();
                prev.dispose();
            }
            this.particleMesh = null;
        }
        if (this.referenceLine) {
            this.scene.remove(this.referenceLine);
            this.referenceLine.geometry.dispose();
            this.referenceLine.material.dispose();
            this.referenceLine = null;
        }

        // ── Build: load the requested path and project to scene meters ─────
        const res    = await fetch(geojsonUrl);
        const gj     = await res.json();
        const coords = gj.features[0].geometry.coordinates;
        pathPoints = projectCoords(coords);

        // Reference line so the spine of the flow is visible while tuning.
        const lineGeom = new THREE.BufferGeometry().setFromPoints(pathPoints);
        this.referenceLine = new THREE.Line(
            lineGeom,
            new THREE.LineBasicMaterial({ color: 0x444466, transparent: true, opacity: 0.5 })
        );
        this.scene.add(this.referenceLine);

        // Driving textures
        const pathTex     = buildPathTexture(pathPoints, PATH_SAMPLES, params.curveSmoothness);
        const speedMap    = buildSpeedMapTexture(
            params.segmentPosition, params.segmentSpeedMul, params.segmentWidth, SPEED_SAMPLES
        );
        const gradientTex = buildGradientTexture(gradientStops, GRADIENT_SAMPLES);

        // Instanced geometry: one quad prefab, PARTICLE_COUNT instances.
        const prefab = new THREE.PlaneGeometry(1, 1);
        const geom   = new THREE.InstancedBufferGeometry();
        geom.index   = prefab.index;
        geom.setAttribute('position', prefab.getAttribute('position'));
        geom.setAttribute('uv',       prefab.getAttribute('uv'));
        geom.instanceCount = PARTICLE_COUNT;

        const aOffset     = new Float32Array(PARTICLE_COUNT);
        const aSpeedMul   = new Float32Array(PARTICLE_COUNT);
        const aJitterSeed = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            aOffset[i]             = Math.random();
            aSpeedMul[i]           = 0.5 + Math.random() * 1.5;
            aJitterSeed[i * 3 + 0] = Math.random();
            aJitterSeed[i * 3 + 1] = Math.random();
            aJitterSeed[i * 3 + 2] = Math.random();
        }
        geom.setAttribute('aOffset',     new THREE.InstancedBufferAttribute(aOffset,     1));
        geom.setAttribute('aSpeedMul',   new THREE.InstancedBufferAttribute(aSpeedMul,   1));
        geom.setAttribute('aJitterSeed', new THREE.InstancedBufferAttribute(aJitterSeed, 3));

        particleMaterial = new THREE.ShaderMaterial({
            vertexShader:   particleVertexShader,
            fragmentShader: particleFragmentShader,
            transparent: true,
            depthWrite:  false,
            uniforms: {
                uTime:         { value: 0 },
                uSpeed:        { value: params.speed },
                uJitter:       { value: params.jitter },
                uVariability:  { value: params.variability },
                uParticleSize: { value: params.particleSize },
                uViewport:     { value: new THREE.Vector2(
                        this.map.getCanvas().width,
                        this.map.getCanvas().height
                    )},
                uPathTex:      { value: pathTex },
                uPathLength:   { value: PATH_SAMPLES },
                uSpeedMap:     { value: speedMap },
                uGradientTex:  { value: gradientTex },
                uParticleTex:  { value: this.particleTexture },
            },
        });

        this.particleMesh = new THREE.Mesh(geom, particleMaterial);
        this.particleMesh.frustumCulled = false;
        this.scene.add(this.particleMesh);

        // Build the GUI only once; sliders stay valid across path swaps.
        if (!this.guiBuilt) {
            buildGui();
            this.guiBuilt = true;
        }
    },

    _buildSmell: function () {
        const swirlGeometry = new THREE.PlaneGeometry(2, 2, 256, 256);
        swirlGeometry.rotateX(-Math.PI * 0.5);

        const swirlTexture = textureLoader.load('/textures/swirl.png')

        const perlinTexture = textureLoader.load('/textures/perlin.png')
        perlinTexture.wrapS = THREE.RepeatWrapping
        perlinTexture.wrapT = THREE.RepeatWrapping

        this.smellMaterial = new THREE.ShaderMaterial({
            vertexShader: smellVertexShader,
            fragmentShader: smellFragmentShader,
            uniforms: {
                uTime: new THREE.Uniform(0),
                uSwirlTexture: new THREE.Uniform(swirlTexture),
                uPerlinTexture: new THREE.Uniform(perlinTexture),
                uDepthColor:   { value: new THREE.Color('#89d2d5') },
                uSurfaceColor: { value: new THREE.Color('#afece7') },
            },
            side: THREE.DoubleSide,
            transparent: true,
        });

        const swirl = new THREE.Mesh(swirlGeometry, this.smellMaterial);
        swirl.position.copy(lngLatToScene(SMELL_LNG, SMELL_LAT, 0));  // co-locate with the tree
        swirl.scale.set(30, 30, 30);
        swirl.position.y = 0.5;  // float just above ground to avoid z-fighting// animated/displaced verts may escape the bbox
        this.scene.add(swirl);
    },

    _buildWindow: function () {
        const canvas = this.map.getCanvas();
        const gl     = this.renderer.getContext();

        // ---- Create our own GL texture, sized to the canvas -------------------
        // We manage this manually because Three.js's copyFramebufferToTexture path
        // is unreliable here (see issue #15196 and the Mapbox/Threebox FBO state
        // mixing). Raw GL keeps the read source explicit and version-agnostic.
        const glTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, glTex);
        gl.texImage2D(
            gl.TEXTURE_2D, 0, gl.RGBA,
            canvas.width, canvas.height, 0,
            gl.RGBA, gl.UNSIGNED_BYTE, null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S,     gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T,     gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);

        this.windowGlTex = glTex;   // keep the raw handle for the copy in render()

        // ---- Wrap it in a Three.js Texture so the ShaderMaterial can sample it
        this.windowBgTexture = new THREE.Texture();
        this.windowBgTexture.image      = { width: canvas.width, height: canvas.height };
        this.windowBgTexture.format     = THREE.RGBAFormat;
        this.windowBgTexture.type       = THREE.UnsignedByteType;
        this.windowBgTexture.minFilter  = THREE.LinearFilter;
        this.windowBgTexture.magFilter  = THREE.LinearFilter;
        this.windowBgTexture.wrapS      = THREE.ClampToEdgeWrapping;
        this.windowBgTexture.wrapT      = THREE.ClampToEdgeWrapping;
        this.windowBgTexture.generateMipmaps = false;
        this.windowBgTexture.flipY      = false;  // copyTexSubImage2D already gives bottom-left origin
        if (THREE.SRGBColorSpace !== undefined) {
            this.windowBgTexture.colorSpace = THREE.SRGBColorSpace;
        } else if (THREE.sRGBEncoding !== undefined) {
            this.windowBgTexture.encoding = THREE.sRGBEncoding;
        }

        // Wire our raw GL texture into Three.js's renderer-side properties so
        // setTexture2D() won't allocate its own and instead binds ours.
        const props = this.renderer.properties.get(this.windowBgTexture);
        props.__webglTexture = glTex;
        props.__webglInit    = true;

        // ---- Material + mesh (unchanged from before) --------------------------
        this.windowMaterial = new THREE.ShaderMaterial({
            vertexShader:   windowVertexShader,
            fragmentShader: windowFragmentShader,
            uniforms: {
                uScreen:     { value: this.windowBgTexture },
                uResolution: { value: new THREE.Vector2(canvas.width, canvas.height) },
                uTime:       { value: 0 },
                uScale:      { value: 0.025 },
                uWaveAmp:    { value: 0.04 },
                uWaveFreq:   { value: 28.0 },
                uWaveSpeed:  { value: 3.5 },
            },
            side: THREE.DoubleSide,
            transparent: true,
            depthWrite: false,
        });

        const geom = new THREE.PlaneGeometry(1, 1, 128, 128);
        this.windowMesh = new THREE.Mesh(geom, this.windowMaterial);
        this.windowMesh.rotation.x = -Math.PI * 0.5;
        this.windowMesh.scale.setScalar(WINDOW_SIZE);
        this.windowMesh.position.copy(lngLatToScene(WINDOW_LNG, WINDOW_LAT, 0));
        this.windowMesh.position.y = 0.1;  // float just above ground to avoid z-fighting
        this.windowMesh.frustumCulled = false;
        this.scene.add(this.windowMesh);
    },

    render: function (gl, matrix) {
        gl.bindVertexArray(null);         // clear any VAO Threebox left bound
        this.renderer.resetState();

        const elapsed = this.clock.getElapsedTime();
        if (particleMaterial) {
            particleMaterial.uniforms.uTime.value = elapsed;
            // Refresh viewport size in case the canvas resized
            particleMaterial.uniforms.uViewport.value.set(
                this.map.getCanvas().width,
                this.map.getCanvas().height
            );}
        if (treeMaterial)     treeMaterial.uniforms.uTime.value     = elapsed;
        if (this.terrainWindUniforms)  this.terrainWindUniforms.uTime.value        = elapsed;
        if (this.smellMaterial) this.smellMaterial.uniforms.uTime.value = elapsed;
        // (alongside the other uTime updates near the top of render())
        if (this.windowMaterial) this.windowMaterial.uniforms.uTime.value = elapsed;

        if (this.windowGlTex && this.windowMesh) {
            const canvas = this.map.getCanvas();

            // Resize the GL texture if the canvas changed shape.
            if (this.windowBgTexture.image.width  !== canvas.width ||
                this.windowBgTexture.image.height !== canvas.height) {
                this.windowBgTexture.image.width  = canvas.width;
                this.windowBgTexture.image.height = canvas.height;
                gl.bindTexture(gl.TEXTURE_2D, this.windowGlTex);
                gl.texImage2D(
                    gl.TEXTURE_2D, 0, gl.RGBA,
                    canvas.width, canvas.height, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, null
                );
                this.windowMaterial.uniforms.uResolution.value.set(canvas.width, canvas.height);
            }

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);   // read source = the canvas
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.windowGlTex);
            gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, canvas.width, canvas.height);
            gl.bindTexture(gl.TEXTURE_2D, null);

            // We touched GL state behind three.js's back — tell it to forget what
            // it thinks is bound so the upcoming scene render rebinds cleanly.
            this.renderer.resetState();
        }

        // Compose Mapbox's per-frame projection with our static scene matrix.
        const m = new THREE.Matrix4().fromArray(matrix);
        this.camera.projectionMatrix = m.multiply(this.sceneMatrix);

        // Three.js dirties GL state Mapbox cares about; resetState clears
        // that. autoClear=false on the renderer keeps Mapbox's framebuffer
        // intact so we draw on top of the basemap.
        this.renderer.render(this.scene, this.camera);

        // Custom layers don't repaint automatically — request another frame
        // so animation keeps flowing.
        this.map.triggerRepaint();
    }
};
//endregion

map.on("load", () => {

    document.dispatchEvent(new CustomEvent("timebar:open"));

    //region === Interactions ===
    map.addInteraction('building-hover-on', {
        type: 'mouseenter',
        target: { featuresetId: 'buildings', importId: 'basemap' },
        handler: (e) => {
            map.setFeatureState(e.feature, { highlight: true });
            map.getCanvas().style.cursor = 'pointer';
        }
    });

    map.addInteraction('building-click-on', {
        type: 'click',
        target: { featuresetId: 'buildings', importId: 'basemap' },
        handler: (e) => {
            const feature = e.feature;
            if (!feature?.geometry) return;
            map.setFeatureState(feature, { select: true });
            const center = getBboxCenter(feature.geometry);
            bus.notify("BuildingClickedEvent", { feature, center });
            return true;
        }
    });

    map.addInteraction('building-hover-off', {
        type: 'mouseleave',
        target: { featuresetId: 'buildings', importId: 'basemap' },
        handler: (e) => {
            map.setFeatureState(e.feature, { highlight: false });
            map.getCanvas().style.cursor = '';
        }
    });
    //endregion

    //region === Data Sources ===
    map.addSource("focus",           { type: "geojson", data: "/geojson/campusPolygon.geojson" });
    map.addSource("eraser",          { type: "geojson", data: "/geojson/envdEraser.geojson" });
    map.addSource("mask",            { type: "geojson", data: "/geojson/universityMask.geojson" });
    map.addSource("circleGradient",  { type: "geojson", data: "/geojson/circleGradient.geojson" });
    map.addSource("polygonGradient", { type: "geojson", data: "/geojson/polygonGradient.geojson" });
    map.addSource("ENVD",            { type: "geojson", data: "/geojson/buildingWalls.geojson" });
    map.addSource("REC",             { type: "geojson", data: "/geojson/REC.geojson" });
    //endregion

    // ===== ENVD Area Erase =====
    function disableClip() {
        if (map.getLayer("ENVD-Erase")) map.removeLayer("ENVD-Erase");
    }

    function enableClip() {
        if (map.getLayer("ENVD-Erase")) return;

        map.addLayer({
            id: "ENVD-Erase",
            type: "clip",
            source: "eraser",
            layout: { "clip-layer-types": ["symbol", "model"] }
        });

        map.addLayer({
            id: 'custom-threebox-model',
            type: 'custom',
            renderingMode: '3d',
            slot: "top",
            onAdd: function () {
                // Creative Commons License attribution:  Metlife Building model by https://sketchfab.com/NanoRay
                // https://sketchfab.com/3d-models/metlife-building-32d3a4a1810a4d64abb9547bb661f7f3
                const options = {
                    obj: 'https://docs.mapbox.com/mapbox-gl-js/assets/metlife-building.gltf',
                    type: 'gltf',
                    scale: { x: .5, y: .5, z: .5 },
                    units: 'meters',
                    rotation: { x: 90, y: -90, z: 0 }
                };
                tb.loadObj(options, (model) => {
                    model.setCoords([-105.26924454341602, 40.00698528139921]);
                    model.setRotation({ x: 0, y: 0, z: 241 });
                    tb.add(model);
                });
            },
            render: function () { tb.update(); }
        });
    }

    // ===== Global White Map =====
    map.addLayer({
        id: "mask-feather",
        type: "line",
        source: "focus",
        slot: "top",
        paint: {
            "line-color":   "#F4F4F4",
            "line-width":   80,
            "line-blur":    40,
            "line-opacity": 1
        }
    });

    map.addLayer({
        id: "region-mask",
        type: "fill",
        source: "mask",
        slot: "top",
        paint: {
            "fill-color":   "#F4F4F4",
            "fill-opacity": 1,
            "fill-gradient": [
                "interpolate", ["linear"], ["distance-from-edge"],
                0,   "rgba(255,255,255,0)",
                200, "rgba(255,255,255,1)"
            ],
        }
    });

    // ===== NEW: direct three.js layer (particles + tree + GLB building) =====
    map.addLayer(threeCustomLayer);

    console.log('imports:', map.getStyle().imports);
});

function SetLightingStyle(style){
    if(style === currentLightingStyle) return;

    const duration = 500; // duration of the fade transition in milliseconds
    currentLightingStyle = style;

    const canvas = map.getCanvas()

    canvas.style.transition = `opacity ${duration / 2}ms ease`;
    canvas.style.opacity = '0';

    setTimeout(() => {
        map.setConfigProperty('basemap', 'lightPreset', style);
        requestAnimationFrame(() => {
            canvas.style.opacity = '1';
        });
    }, duration / 2);
}

// ── Time-bar sync ────────────────────────────────────────────────────────
// The time bar drives two things in lockstep:
//   1. The position of the locked red gradient stop (visible "marker" sliding
//      along the particle path's color band).
//   2. params.segmentPosition (where the speed-profile slowdown is centered).
// Updating both together makes the red marker visually coincide with the
// slow zone, so particles bunch up at the dragged location.
document.addEventListener("timebar:change", (e) => {

    const value = Math.max(0, Math.min(1, e.detail.value));
    console.log(`Timebar changed: ${value}`);

    if(particleMaterial) {
        // 1. Move the locked red stop and rebuild the gradient texture.
        const marker = gradientStops.find(s => s.locked);
        if (marker) {
            marker.position = value;
            rebuildGradient();
            if (timeMarkerController) timeMarkerController.updateDisplay();
        }

        // 2. Move the speed-profile segment and rebuild the remap texture.
        params.segmentPosition = value;
        rebuildSpeedMap();
        if (segmentPositionController) segmentPositionController.updateDisplay();
    }

    if(value >= 0.5 && value <= 0.9){
        SetRain(true)
    }
    else{
        SetRain(false)
    }

    if(value <= 0.25){
        SetLightingStyle('dawn');
    } else if (value >= 0.8){
        SetLightingStyle('dusk');
    }
    else{
        SetLightingStyle('day');
    }
});