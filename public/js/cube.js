import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js";

const gui = new GUI({
    width: 340,
    title: 'Debug Menu',
    closeFolders: false
})

const objLoader = new OBJLoader();

//Debug GUI
const debugObject = {}
debugObject.color = '#c3c8ca'
debugObject.positionY = -0.09;

window.addEventListener('keydown', (event) => {
    if(event.key === 'h') {
        gui.show(gui._hidden)
    }
})

const app = document.getElementById("app");

const width = app.clientWidth || window.innerWidth;
const height = app.clientHeight || window.innerHeight;

// Canvas
const canvas = document.querySelector('canvas.webgl')

//scene
const scene = new THREE.Scene();

// Light
const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
scene.add(directionalLight);

debugObject.TransparentRadius = 0.3

// ------------------------------
// Atlas Alpha Params
// ------------------------------

const cut = {
    radius: debugObject.TransparentRadius,
    softness: 0.7,
    depth: 0.0
};

const cutUniforms = {
    uCutPos:      { value: new THREE.Vector3(0, 0, 0) },
    uCutRadius:   { value: cut.radius },
    uCutSoftness: { value: cut.softness },
    uCutMix:      { value: 0.4 },
    uSolidColor:  { value: new THREE.Color(debugObject.color) }
};

// ------------------------------
// Phong Shader
// ------------------------------
function buildAtlasPhongMaterial() {
    const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(debugObject.color),
        specular: new THREE.Color(0x222222),
        shininess: 40,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
        depthTest: true
    });

    cutUniforms.uSolidColor.value = mat.color;

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uCutPos      = cutUniforms.uCutPos;
        shader.uniforms.uCutRadius   = cutUniforms.uCutRadius;
        shader.uniforms.uCutSoftness = cutUniforms.uCutSoftness;
        shader.uniforms.uCutMix      = cutUniforms.uCutMix;
        shader.uniforms.uSolidColor  = cutUniforms.uSolidColor;

        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
         varying vec3 vWorldPos;`
            )
            .replace(
                "#include <project_vertex>",
                `
         // --- Atlas cut: world position varying ---
         vec4 atlasWorldPos = vec4( transformed, 1.0 );
         #ifdef USE_INSTANCING
           atlasWorldPos = instanceMatrix * atlasWorldPos;
         #endif
         atlasWorldPos = modelMatrix * atlasWorldPos;
         vWorldPos = atlasWorldPos.xyz;

         #include <project_vertex>
        `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
         uniform vec3  uCutPos;
         uniform float uCutRadius;
         uniform float uCutSoftness;
         uniform float uCutMix;
         uniform vec3  uSolidColor;
         varying vec3  vWorldPos;`
            )
            .replace(
                "vec4 diffuseColor = vec4( diffuse, opacity );",
                `vec4 diffuseColor = vec4( diffuse, opacity );
         diffuseColor.rgb = uSolidColor;`
            )
            .replace(
                "#include <clipping_planes_fragment>",
                `#include <clipping_planes_fragment>

         // --- Atlas cut: discard-only cutout in world space ---
         float d = distance(vWorldPos, uCutPos);
         float inside = 1.0 - smoothstep(uCutRadius, uCutRadius + uCutSoftness, d);

         // Fade in/out with uCutMix (keeps your existing smoothing behavior)
         if (uCutMix > 0.05 && inside * uCutMix > 0.5) discard;`
            );

        mat.userData.shader = shader;
    };

    mat.customProgramCacheKey = () => "AtlasPhongCut_v1";

    return mat;
}

const AtlasMaterial = buildAtlasPhongMaterial();

//-----------------
//Atlas Foundation Material
//-----------------
debugObject.FoundationColor = '#cfd0ce'

const AtlasFoundationMaterial = new THREE.MeshPhongMaterial({
    color: new THREE.Color(debugObject.FoundationColor),
    specular: new THREE.Color(0x222222),
    shininess: 40,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    depthTest: true
});

// ---------------------------------
// Hover-circle Params
// ---------------------------------
const hover = {
    radius: 0.18,
    softness: 0.10,
    intensity: 1.0,
};

debugObject.HoverColor = 'rgba(255,249,218,0.72)'

const hoverUniforms = {
    uHoverPos:       { value: new THREE.Vector3() },
    uHoverRadius:    { value: hover.radius },
    uHoverSoftness:  { value: hover.softness },
    uHoverMix:       { value: 0.0 },
    uHoverColor:     { value: new THREE.Color(debugObject.HoverColor) },
    uHoverIntensity: { value: hover.intensity },
};

function buildHoverCirclePhongMaterial(baseColor = "#d87676") {
    const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color(baseColor),
        specular: new THREE.Color(0x222222),
        shininess: 40,
        side: THREE.DoubleSide,
        transparent: false,
        depthWrite: true,
        depthTest: true,
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uHoverPos       = hoverUniforms.uHoverPos;
        shader.uniforms.uHoverRadius    = hoverUniforms.uHoverRadius;
        shader.uniforms.uHoverSoftness  = hoverUniforms.uHoverSoftness;
        shader.uniforms.uHoverMix       = hoverUniforms.uHoverMix;
        shader.uniforms.uHoverColor     = hoverUniforms.uHoverColor;
        shader.uniforms.uHoverIntensity = hoverUniforms.uHoverIntensity;

        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
         varying vec3 vWorldPos;`
            )
            .replace(
                "#include <project_vertex>",
                `
         vec4 atlasWorldPos = vec4( transformed, 1.0 );
         #ifdef USE_INSTANCING
           atlasWorldPos = instanceMatrix * atlasWorldPos;
         #endif
         atlasWorldPos = modelMatrix * atlasWorldPos;
         vWorldPos = atlasWorldPos.xyz;

         #include <project_vertex>
        `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
         uniform vec3  uHoverPos;
         uniform float uHoverRadius;
         uniform float uHoverSoftness;
         uniform float uHoverMix;
         uniform vec3  uHoverColor;
         uniform float uHoverIntensity;
         varying vec3  vWorldPos;`
            )
            .replace(
                "vec4 diffuseColor = vec4( diffuse, opacity );",
                `vec4 diffuseColor = vec4( diffuse, opacity );

         float d = distance(vWorldPos, uHoverPos);
         float mask = 1.0 - smoothstep(uHoverRadius, uHoverRadius + uHoverSoftness, d);
         mask *= uHoverMix * uHoverIntensity;

         diffuseColor.rgb = mix(diffuseColor.rgb, uHoverColor, clamp(mask, 0.0, 1.0));
        `
            );

        mat.userData.shader = shader;
    };

    mat.customProgramCacheKey = () => "HoverCirclePhong_v2";
    return mat;
}

const HoverCircleMaterial = buildHoverCirclePhongMaterial(debugObject.FoundationColor);

//-------------
// OBJ LOADER
//-------------
let AtlasModel = null;

objLoader.load(
    'models/AtlasSolidUV.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = AtlasMaterial;
            }
        });
        var scale = .019
        object.position.y = debugObject.positionY
        object.scale.set(scale, scale, scale);
        object.position.z = -.1;
        object.rotation.y = Math.PI;

        AtlasModel = object;
        scene.add(object);
    }
);

let AtlasFoundation = null;

objLoader.load(
    'models/AtlasFoundation.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = HoverCircleMaterial;
            }
        });
        object.position.y = -.35
        object.scale.set(0.02, 0.02, 0.02);
        object.position.z = -.1;
        object.rotation.y = Math.PI;

        AtlasFoundation = object;
        scene.add(object);
    }
);

objLoader.load(
    'models/BENCHES.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = new THREE.MeshPhongMaterial();
            }
        });
        object.position.y = -.1
        object.scale.set(0.02, 0.02, 0.02);
        object.position.z = 0;
        object.rotation.y = Math.PI;

        scene.add(object);
    }
);

// -----------------
// Y Phade Mat
// -----------------
function makeYFadePhong({
        color = "#c3c8ca",
        yZero = 0.0,
        fadeRange = 0.5,
        minAlpha = 0.05
    } = {}) {
    const mat = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uYZero = { value: yZero };
        shader.uniforms.uFadeRange = { value: fadeRange };
        shader.uniforms.uMinAlpha = { value: minAlpha };

        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
         varying vec3 vWorldPos;`
            )
            .replace(
                "#include <project_vertex>",
                `
         vec4 wp = modelMatrix * vec4( transformed, 1.0 );
         vWorldPos = wp.xyz;
         #include <project_vertex>
        `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
         uniform float uYZero;
         uniform float uFadeRange;
         uniform float uMinAlpha;
         varying vec3 vWorldPos;`
            )
            .replace(
                "vec4 diffuseColor = vec4( diffuse, opacity );",
                `vec4 diffuseColor = vec4( diffuse, opacity );

         float dy = abs(vWorldPos.y - uYZero);

         // 0 at yZero -> 1 when far away
         float t = smoothstep(0.0, uFadeRange, dy);

         // alpha is minAlpha at yZero, approaches 1 away from yZero
         diffuseColor.a *= mix(uMinAlpha, 1.0, t);
        `
            );

        mat.userData.shader = shader;
    };

    // handy: update fade params later
    mat.userData.setFade = (yZeroNew, fadeRangeNew, minAlphaNew) => {
        const s = mat.userData.shader;
        if (!s) return;
        s.uniforms.uYZero.value = yZeroNew;
        s.uniforms.uFadeRange.value = fadeRangeNew;
        s.uniforms.uMinAlpha.value = minAlphaNew;
    };

    mat.customProgramCacheKey = () => "YFadePhong_v1";
    return mat;
}

const yFadeMat = makeYFadePhong({
    color: "#d6d8e9",
    yZero: 0,
    fadeRange: 0.4,
    minAlpha: 0.0
});

const personGeo = new THREE.BoxGeometry(0.1, 0.2, 0.1);
const personMesh = new THREE.Mesh(personGeo, yFadeMat);
personMesh.position.set(-1.6, 0 , 1);
personMesh.scale.set(.8, 1.5, .8);

const personGeo1 = new THREE.BoxGeometry(0.1, 0.2, 0.1);
const personMesh1 = new THREE.Mesh(personGeo1, yFadeMat);
personMesh1.position.set(-1.5, 0 ,.8);
personMesh1.scale.set(.8, 1.5, .8);

const personGeo2 = new THREE.BoxGeometry(0.1, 0.2, 0.1);
const personMesh2 = new THREE.Mesh(personGeo2, yFadeMat);
personMesh2.position.set(-.4, 0 , 1.4);
personMesh2.scale.set(.8, 1.5, .8);

const personGeo3 = new THREE.BoxGeometry(0.1, 0.2, 0.1);
const personMesh3 = new THREE.Mesh(personGeo3, yFadeMat);
personMesh3.position.set(-.5, 0 , 1.2);
personMesh3.scale.set(.8, 1.5, .8);

scene.add(personMesh);
scene.add(personMesh1);
scene.add(personMesh2);
scene.add(personMesh3);


//Disc
debugObject.DiscColor= '#b6c9c4'

const circleGeometry = new THREE.CircleGeometry(1.2,64)
const circleMaterial = new THREE.MeshBasicMaterial({
    color: debugObject.DiscColor,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
});
const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial)

circleMesh.scale.set(3, 3, 3)
circleMesh.rotation.x = -Math.PI / 2;
circleMesh.position.y = -.35

scene.add(circleMesh)

// ---------------------------------
// Ripple Overlay
// ---------------------------------
const MAX_RIPPLES = 10;

const RIPPLE_INTERVAL = 0.55;
const RIPPLE_AMP = 1.0;

const rippleUniforms = {
    uTime:      { value: 0 },
    uSpeed:     { value: 1.25 },
    uWidth:     { value: 0.10 },
    uFeather:   { value: 0.18 },
    uDecay:     { value: 1.05 },
    uColor:     { value: new THREE.Color("#6de1ff") },
    uIntensity: { value: 1.35 },
    uCenters:   { value: Array.from({ length: MAX_RIPPLES }, () => new THREE.Vector3()) },
    uStarts:    { value: new Float32Array(MAX_RIPPLES) },
    uAmps:      { value: new Float32Array(MAX_RIPPLES) },
};

rippleUniforms.uStarts.value.fill(-1);
rippleUniforms.uAmps.value.fill(0);

const rippleMaterial = new THREE.ShaderMaterial({
    uniforms: rippleUniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
    varying vec3 vWorldPos;
    void main() {
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
    fragmentShader: /* glsl */ `
    #define MAX_RIPPLES ${MAX_RIPPLES}

    uniform float uTime;
    uniform float uSpeed;
    uniform float uWidth;
    uniform float uFeather;
    uniform float uDecay;
    uniform vec3  uColor;
    uniform float uIntensity;

    uniform vec3  uCenters[MAX_RIPPLES];
    uniform float uStarts[MAX_RIPPLES];
    uniform float uAmps[MAX_RIPPLES];

    varying vec3 vWorldPos;

    void main() {
      vec2 p = vWorldPos.xz;
      float sum = 0.0;

      for (int i = 0; i < MAX_RIPPLES; i++) {
        float t0 = uStarts[i];
        float a  = uAmps[i];
        if (t0 < 0.0 || a <= 0.0) continue;

        float t = uTime - t0;
        if (t < 0.0) continue;

        float r = t * uSpeed;
        float d = distance(p, uCenters[i].xz);

        float band = abs(d - r);
        float ring = 1.0 - smoothstep(uWidth, uWidth + uFeather, band);

        float fade = exp(-uDecay * t);
        sum += ring * fade * a;
      }

      float alpha = clamp(sum * uIntensity, 0.0, 1.0);
      if (alpha < 0.003) discard;

      gl_FragColor = vec4(uColor, alpha);
    }
  `,
});

const rippleMesh = new THREE.Mesh(new THREE.CircleGeometry(1.2, 128), rippleMaterial);
rippleMesh.scale.set(.6,.6,.6)
rippleMesh.rotation.copy(circleMesh.rotation);
rippleMesh.position.set(1,-.08,1)
rippleMesh.position.y += 0.002;
rippleMesh.renderOrder = 10;
scene.add(rippleMesh);

const ripples = Array.from({ length: MAX_RIPPLES }, () => ({
    center: new THREE.Vector3(),
    start: -1,
    amp: 0,
}));

let rippleWriteIndex = 0;
let lastSpawnTime = -Infinity;

const rippleOrigin = new THREE.Vector3();

function spawnRippleAtOrigin(now, amp = RIPPLE_AMP) {
    rippleMesh.updateMatrixWorld(true);
    rippleMesh.getWorldPosition(rippleOrigin);

    const r = ripples[rippleWriteIndex];
    r.center.copy(rippleOrigin);
    r.start = now;
    r.amp = amp;

    rippleWriteIndex = (rippleWriteIndex + 1) % MAX_RIPPLES;
}

function initContinuousRipples() {
    const now = clock.getElapsedTime();

    for (let i = 0; i < MAX_RIPPLES; i++) {
        const t0 = now - i * RIPPLE_INTERVAL;
        ripples[i].center.copy(rippleOrigin);
        ripples[i].start = t0;
        ripples[i].amp = RIPPLE_AMP;
    }

    rippleWriteIndex = 0;
    lastSpawnTime = now;
}

// --------------------
// Particle Cloud
// --------------------
const cloudParams = {
    count: 4960,
    size: 0.004,
    radius: 0.6,
    yStretch: 0.34,
    color: "#6a04dc"
};

let cloudGeo = null;
let cloudMat = null;
let cloudPoints = null;

function generateCloud() {
    if (cloudPoints) {
        cloudGeo.dispose();
        cloudMat.dispose();
        scene.remove(cloudPoints);
    }

    cloudGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(cloudParams.count * 3);

    for (let i = 0; i < cloudParams.count; i++) {
        const i3 = i * 3;

        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);

        const r = cloudParams.radius * Math.cbrt(Math.random());

        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.cos(phi) * cloudParams.yStretch;
        const z = r * Math.sin(phi) * Math.sin(theta);

        positions[i3]     = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = z;
    }

    cloudGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    cloudMat = new THREE.PointsMaterial({
        color: new THREE.Color(cloudParams.color),
        size: cloudParams.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: true,
        blending: THREE.NormalBlending
    });

    cloudPoints = new THREE.Points(cloudGeo, cloudMat);
    cloudPoints.position.set(1, 0.5, -.8); // x, y, z
    scene.add(cloudPoints);
}

const cloudFolder = gui.addFolder("Particle Cloud").close();
cloudFolder.add(cloudParams, "count", 100, 20000, 10).onFinishChange(generateCloud);
cloudFolder.add(cloudParams, "size", 0.0005, 0.02, 0.0005).onFinishChange(generateCloud);
cloudFolder.add(cloudParams, "radius", 0.05, 2.0, 0.01).onFinishChange(generateCloud);
cloudFolder.add(cloudParams, "yStretch", 0.1, 2.0, 0.01).onFinishChange(generateCloud);
cloudFolder.addColor(cloudParams, "color").onFinishChange(() => {
    if (cloudMat) cloudMat.color.set(cloudParams.color);
});

generateCloud();

function animateCloud(timeSeconds) {
    if (!cloudPoints) return;
    cloudPoints.rotation.y = timeSeconds * 0.06;
    cloudPoints.position.y = Math.sin(timeSeconds * 0.6) * 0.02;
}

//sizes
const sizes = {
    width:width,
    height:height
}
//camera
const camera = new THREE.PerspectiveCamera(75, sizes.width/sizes.height)
camera.position.z = 2
camera.position.y = .5
scene.add(camera)

//renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    transparent: true
})

renderer.setSize(sizes.width, sizes.height)
renderer.setClearColor(0xffffff, 0);

//-----------------
// Controls
//-----------------
const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;

//-----------------
//GUI
//-----------------

const AtlasTweaks = gui.addFolder('Atlas Material').close()

AtlasTweaks.addColor(debugObject, "color").onChange(() => {
    AtlasMaterial.color.set(debugObject.color);
});

AtlasTweaks.addColor(debugObject, "FoundationColor").onChange(() => {
    AtlasFoundationMaterial.color.set(debugObject.FoundationColor);
});

AtlasTweaks.addColor(debugObject, "DiscColor").onChange(() => {
    circleMaterial.color.set(debugObject.DiscColor);
});

AtlasTweaks
    .add(debugObject, 'positionY', -1, 1, 0.01)
    .name('Model Position Y')
    .onChange(()=>{
        GUITick()
    })

debugObject.scale = 0.019

AtlasTweaks.add(debugObject, 'scale', 0.01, .05, 0.001).name('Model Scale').onChange(()=>{
    GUITick()
})

gui.add(debugObject, "TransparentRadius", 0.01, 1, 0.01)
    .name("Cut Radius")
    .onChange(() => { cut.radius = debugObject.TransparentRadius; });

// ---------------------------------
// Raycasting
// ---------------------------------
const raycaster = new THREE.Raycaster();
const mouseNdc = new THREE.Vector2();

const targetCutPos = new THREE.Vector3(0, 0, 0);
const smoothedCutPos = new THREE.Vector3(0, 0, 0);

let cutEnabled = false;
let cutMix = 0;

const targetHoverPos = new THREE.Vector3();
const smoothedHoverPos = new THREE.Vector3();
let hoverEnabled = false;
let hoverMix = 0;

function updateMouse(event) {
    if(!AtlasModel)return;

    const rect = renderer.domElement.getBoundingClientRect();

    mouseNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    scene.updateMatrixWorld(true);
    raycaster.setFromCamera(mouseNdc, camera);

    const hits = raycaster.intersectObject(AtlasModel, true);
    const hit = hits[0];

    const foundationHits = raycaster.intersectObject(AtlasFoundation, true);
    const foundationHit = foundationHits[0];

    if (hit) {
        targetCutPos.copy(hit.point);
        if (hit.face) {
            const n = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
            targetCutPos.addScaledVector(n, -cut.depth);
        }

        cutEnabled = true;
    } else {
        cutEnabled = false;
    }

    if(foundationHit){
        targetHoverPos.copy(foundationHit.point);
        hoverEnabled = true;
    } else {
        hoverEnabled = false;
    }
}

renderer.domElement.addEventListener("pointermove", updateMouse);
renderer.domElement.addEventListener("pointerleave", () => {cutEnabled = false; hoverEnabled = false});

// ---------------------------------
// Animation loop
// ---------------------------------
const clock = new THREE.Clock();

rippleMesh.updateMatrixWorld(true);
rippleMesh.getWorldPosition(rippleOrigin);
initContinuousRipples();

function animate() {
    requestAnimationFrame(animate);
    controls.update();

    const t = clock.getElapsedTime();
    animateCloud(t);

    smoothedCutPos.lerp(targetCutPos, 0.18);
    cutUniforms.uCutPos.value.copy(smoothedCutPos);

    const targetMix = cutEnabled ? 1.0 : 0.0;
    cutMix += (targetMix - cutMix) * 0.15;
    cutUniforms.uCutMix.value = cutMix;

    cutUniforms.uCutRadius.value = cut.radius;
    cutUniforms.uCutSoftness.value = cut.softness;

    smoothedHoverPos.lerp(targetHoverPos, 0.18);
    hoverUniforms.uHoverPos.value.copy(smoothedHoverPos);

    const target = hoverEnabled ? 1.0 : 0.0;
    hoverMix += (target - hoverMix) * 0.15;
    hoverUniforms.uHoverMix.value = hoverMix;

    hoverUniforms.uHoverRadius.value = hover.radius;
    hoverUniforms.uHoverSoftness.value = hover.softness;

    const now = clock.getElapsedTime();
    rippleUniforms.uTime.value = now;


    if (now - lastSpawnTime >= RIPPLE_INTERVAL) {
        const steps = Math.floor((now - lastSpawnTime) / RIPPLE_INTERVAL);
        for (let s = 0; s < steps; s++) {
            lastSpawnTime += RIPPLE_INTERVAL;
            spawnRippleAtOrigin(lastSpawnTime, RIPPLE_AMP);
        }
    }


    for (let i = 0; i < MAX_RIPPLES; i++) {
        rippleUniforms.uCenters.value[i].copy(ripples[i].center);
        rippleUniforms.uStarts.value[i] = ripples[i].start;
        rippleUniforms.uAmps.value[i] = ripples[i].amp;
    }

    renderer.render( scene, camera );
} animate()


const GUITick = () => {
    if(AtlasModel){
        AtlasModel.position.y = debugObject.positionY
        AtlasModel.scale.set(debugObject.scale, debugObject.scale, debugObject.scale);
    }
}

window.addEventListener("resize", () => {
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});
