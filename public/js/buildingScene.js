import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js";
import { cameraTransparencyVertexShader } from '../shaders/cameraTransparency/vertex.js';
import { cameraTransparencyFragmentShader } from '../shaders/cameraTransparency/fragment.js';
import { wavesVertexShader } from '../shaders/waves/vertex.js';
import { wavesFragmentShader } from '../shaders/waves/fragment.js';

//Loaders
const textureLoader = new THREE.TextureLoader();
const objLoader = new OBJLoader();

//Debug GUI
const gui = new GUI({
    width: 340,
    title: 'Debug Menu',
    closeFolders: false
})

const debugObject = {}
debugObject.color = '#c3c8ca'
debugObject.positionY = -4.49;

window.addEventListener('keydown', (event) => {
    if(event.key === 'h') {
        gui.show(gui._hidden)
    }
})

// Canvas
const canvas = document.querySelector('canvas.webgl')

const app = document.getElementById("app");

const width = app.clientWidth || window.innerWidth;
const height = app.clientHeight || window.innerHeight;

//scene
const scene = new THREE.Scene();

//sizes
const sizes = {
    width:width,
    height:height
}
//camera
const camera = new THREE.PerspectiveCamera(30, sizes.width/sizes.height)
camera.position.set(-4, 1.5, 4)
scene.add(camera)

//renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    transparent: true
})

renderer.setSize(sizes.width, sizes.height)
renderer.setClearColor(0xffffff, 0);

/**
 * Materials
 */

//-----------------
// White MatCap
//-----------------
const matCapTexture = textureLoader.load('../textures/Matcap.png')

const matCapMaterial = new THREE.MeshMatcapMaterial()
matCapMaterial.matcap = matCapTexture;

//-----------------
// Blue Matcap
//-----------------
const blueMatCapTexture = textureLoader.load('../textures/matCapDarkBlue.png')

const blueMatCapMaterial = new THREE.MeshMatcapMaterial()
blueMatCapMaterial.matcap = blueMatCapTexture;

//-----------------
// Transparency White Matcap
//-----------------
const perlinTexture = textureLoader.load('../textures/perlin.png')
perlinTexture.wrapS = THREE.RepeatWrapping
perlinTexture.wrapT = THREE.RepeatWrapping

const atlasMatCapMaterial = new THREE.MeshMatcapMaterial({
    transparent: true,
})

const customUniforms = {
    uTime:          { value: 0 },
    uColor:         { value: new THREE.Color('#ffffff') },
    uResolution:    { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uPerlinTexture: { value: perlinTexture },
    uCutDepth: { value: 4.73},
    uCutFade: {value: 0},
    uCutPos: new THREE.Uniform(new THREE.Vector2(0, 0)),
    uCutRadius: new THREE.Uniform(1.02)
};

const buildingAlphaGui = gui.addFolder('Building Alpha').close()
buildingAlphaGui.add(customUniforms.uCutDepth, 'value').min(0).max(20).step(0.01).name('Alpha Depth')
buildingAlphaGui.add(customUniforms.uCutRadius, 'value').min(0).max(20).step(0.01).name('Alpha Radius')

atlasMatCapMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, customUniforms);

    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
            #include <common>
            
            uniform float uTime;
    
            varying vec2 vUv;
            varying vec4 vClipPos;
            varying vec3 vViewPos;
        `
    )

    shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>

        vUv = uv;
        vClipPos = gl_Position;
        vViewPos = mvPosition.xyz;
    `
    );

    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <clipping_planes_pars_fragment>',
        `
            #include <clipping_planes_pars_fragment>
            
            uniform float uTime;
            uniform vec3 uColor;
            uniform vec2 uResolution;
            uniform sampler2D uPerlinTexture;
            uniform float uCutDepth;
            uniform float uCutFade; 
            uniform vec2 uCutPos;
            uniform float uCutRadius;
    
            varying vec2 vUv;
            varying vec4 vClipPos;
            varying vec3 vViewPos;
        `
    )

    shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        `
            // Distance From Center
            vec2 normalizedPosition = vClipPos.xy / vClipPos.w;
            float aspectRatio = uResolution.x / uResolution.y;
            vec2 circleDelta = (normalizedPosition - uCutPos) * vec2(aspectRatio, 1.0);
            float centerDist = length(circleDelta);
        
            //Wavey
            float wavesY = texture(uPerlinTexture, vec2(0.5, vUv.y * 0.2 - uTime * 0.1)).r;
            float wavesX = texture(uPerlinTexture, vec2(0.5, vUv.x * 0.2 - uTime * 0.1)).r;
            float waves = wavesY * wavesX;
            
            float wavePos = centerDist + waves * 0.6;
            float waveCircleMask = smoothstep(uCutRadius, uCutRadius + 0.1, wavePos);
            
            //Depth
            float depth = -vViewPos.z;
            float depthMask = smoothstep(uCutDepth, uCutDepth + waves, depth);
        
            float alpha = max(waveCircleMask, depthMask);
            
            if (alpha < 0.01) discard;
        
            //Final Color
            gl_FragColor = vec4(outgoingLight, diffuseColor.a * alpha);
        `
    )
}

//-----------------
// Waves Blue Matcap
//-----------------
const cyanMatCapTexture = textureLoader.load('../textures/matCapBlue.png')

const wavesMatCapMaterial = new THREE.MeshMatcapMaterial()
wavesMatCapMaterial.matcap = cyanMatCapTexture;

const waveCustomUniforms = {
    uTime: new THREE.Uniform(0),
    uBigWavesElevation: new THREE.Uniform(0.12),
    uBigWavesFrequency: new THREE.Uniform(10),
    uBigWaveSpeed: new THREE.Uniform(1.38),
    uWaveCenter: new THREE.Uniform(new THREE.Vector2(0, 0)),
    uPlaneRadius: new THREE.Uniform(.5),
};

wavesMatCapMaterial.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waveCustomUniforms);

    shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
            #include <common>
            
            uniform float uTime;
            uniform float uBigWavesElevation;
            uniform float uBigWavesFrequency;
            uniform float uBigWaveSpeed;
            uniform vec2 uWaveCenter;
            uniform float uPlaneRadius;
        `
    )

    shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>

        // Local-space distance from plane center
        float dist = length(position.xy);
        float normalizedDist = dist / uPlaneRadius;

        float edgeFalloff = 1.0 - smoothstep(0.5, 1.0, normalizedDist);

        // Use the SAME local dist for wave propagation
        float waveElevation = sin(dist * uBigWavesFrequency - uTime * uBigWaveSpeed)
                            * uBigWavesElevation
                            * edgeFalloff;

        transformed.z += waveElevation;
    `
    );
}

const WavesGui = gui.addFolder('Waves').close()

WavesGui.add(waveCustomUniforms.uBigWavesElevation, 'value').min(0).max(1).step(0.01).name('Wave Elevation')
WavesGui.add(waveCustomUniforms.uBigWavesFrequency, 'value').min(0).max(10).step(0.01).name('Wave Frequency')
WavesGui.add(waveCustomUniforms.uBigWaveSpeed, 'value').min(0).max(4).step(0.01).name('Wave Speed')

//-----------------
// Benches Matcap
//-----------------
const benchMatCapTexture = textureLoader.load('../textures/benchMatCap.png')

const benchMatCapMaterial = new THREE.MeshMatcapMaterial()
wavesMatCapMaterial.matcap = benchMatCapTexture;

// ----------------
// Height Fade
// ----------------

const heightFadeMaterial = new THREE.ShaderMaterial({
    transparent: true,
    side: THREE.DoubleSide,
    uniforms: {
        uColor:     { value: new THREE.Color('#D6D6D6') },
        uFadeStart: { value: 0.1 },
        uFadeEnd:   { value: -0.08 },
    },
    vertexShader: `
        varying vec3 vWorldPos;

        void main() {
            // Apply instance transform first, then model transform
            vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
            vec4 worldPosition = modelMatrix * instancePosition;
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform vec3  uColor;
        uniform float uFadeStart;
        uniform float uFadeEnd;

        varying vec3 vWorldPos;

        void main() {
            float alpha = smoothstep(uFadeEnd, uFadeStart, vWorldPos.y);
            if (alpha < 0.01) discard;
            gl_FragColor = vec4(uColor, alpha);
        }
    `
})


/**
 * OBJ LOADER
 */

// ---------
// Atlas Building
// ----------
let AtlasModel = null;

objLoader.load(
    'models/AtlasWithCutouts.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = atlasMatCapMaterial;
            }
        });
        object.position.y = -4.49;
        object.scale.set(.077, .077, .077);
        object.position.z = -.1;
        object.rotation.y = Math.PI;

        AtlasModel = object;
        scene.add(object);
    }
);

//--------------------
// Atlas Foundation
//-------------------

let AtlasFoundation = null;

objLoader.load(
    'models/AtlasFoundation.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = blueMatCapMaterial;
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

//Benches
objLoader.load(
    'models/BENCHES.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = benchMatCapMaterial;
            }
        });
        object.position.y = -.1
        object.scale.set(0.02, 0.02, 0.02);
        object.position.z = 0;
        object.rotation.y = Math.PI;

        scene.add(object);
    }
);

// ---------------------
// People Instancing
// ---------------------
const MAX_PEOPLE = 80;
let peopleMesh = null;

function getPeopleCount(hour) {
    const mid = 12;
    const spread = 1;
    const t = Math.exp(-0.5 * Math.pow((hour - mid) / spread, 2));
    return Math.round(t * MAX_PEOPLE);
}

function initPeople(geometry, material) {
    peopleMesh = new THREE.InstancedMesh(geometry, material, MAX_PEOPLE);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < MAX_PEOPLE; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.1 + Math.random() * 1.8;
        dummy.position.set(
            Math.cos(angle) * radius,
            0,
            Math.sin(angle) * radius
        );
        dummy.scale.set(0.03, 0.03, 0.03);
        dummy.updateMatrix();
        peopleMesh.setMatrixAt(i, dummy.matrix);
    }

    peopleMesh.instanceMatrix.needsUpdate = true;

    peopleMesh.count = getPeopleCount(6);

    scene.add(peopleMesh);
}

function updatePeopleCount(hour) {
    if (!peopleMesh) return;
    peopleMesh.count = getPeopleCount(hour);
}

objLoader.load(
    'models/avatar.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);

        let avatarGeometry = null;
        object.traverse((child) => {
            if (child.isMesh && !avatarGeometry) {
                avatarGeometry = child.geometry;
            }
        });

        if (avatarGeometry) {
            initPeople(avatarGeometry, heightFadeMaterial);
        }
    }
);

/**
 * Meshes
 */

//People

//Wave Plane
const wavePlaneGeo = new THREE.PlaneGeometry(1,1,254,254)
const wavePlaneMesh = new THREE.Mesh(wavePlaneGeo, wavesMatCapMaterial)
wavePlaneMesh.rotation.x = -1.60159265358979
wavePlaneMesh.position.y = -0.12
wavePlaneMesh.position.z = -0.799999999999999
wavePlaneMesh.position.x = 0.100000000000001

scene.add(wavePlaneMesh)

WavesGui.add(wavePlaneMesh.position, 'x').min(-10).max(10).step(0.01).name('Position X');
WavesGui.add(wavePlaneMesh.position, 'z').min(-10).max(10).step(0.01).name('Position Z');

// Rotation — X only
WavesGui.add(wavePlaneMesh.rotation, 'x').min(-Math.PI).max(Math.PI).step(0.01).name('Rotation X');

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

//-----------------
// Controls
//-----------------
const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;

// ---------------------
// Vapor Bubble — ShaderMaterial
// ---------------------
function createTextTexture(text, width = 512, height = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);

    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Word wrap
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    const maxWidth = width * 0.65;

    words.forEach(word => {
        const test = currentLine + word + ' ';
        if (ctx.measureText(test).width > maxWidth && currentLine) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
        } else {
            currentLine = test;
        }
    });
    lines.push(currentLine.trim());

    const lineHeight = 28;
    const startY = height / 2 - (lines.length - 1) * lineHeight / 2;

    lines.forEach((line, i) => {
        ctx.fillText(line, width / 2, startY + i * lineHeight);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

const bubbleTextTexture = createTextTexture(
    'ATLAS'
);

const vaporBubbleMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
        uTime: { value: 0 },
        uTextMap: { value: bubbleTextTexture },
        uPerlinTexture: { value: perlinTexture },
        uColor: { value: new THREE.Color('#EFEDF0') },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
            vUv = uv;
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        uniform float uTime;
        uniform sampler2D uTextMap;
        uniform sampler2D uPerlinTexture;
        uniform vec3 uColor;

        varying vec2 vUv;
        varying vec3 vWorldPos;

        void main() {
            vec2 centered = vUv - 0.5;

            // Animated vapor distortion
            float noiseA = texture2D(uPerlinTexture, vUv * 0.8 + uTime * 0.02).r;
            float noiseB = texture2D(uPerlinTexture, vUv * 1.2 - uTime * 0.015).r;
            float noise  = (noiseA + noiseB) * 0.5;

            // Organic blobby edge
            float dist = length(centered * vec2(1.8, 2.2));
            float wobble = noise * 0.12;
            float edge = smoothstep(0.5 + wobble, 0.35 + wobble, dist);

            // Inner glow layers
            float innerGlow = smoothstep(0.5, 0.0, dist) * 0.3;
            float coreGlow  = smoothstep(0.25, 0.0, dist) * 0.2;

            // Base vapor color with luminous center
            vec3 color = uColor + coreGlow;

            // Text layer (only in the center region)
            float textMask = smoothstep(0.4, 0.25, dist);
            vec4 textSample = texture2D(uTextMap, vUv);
            color = mix(color, textSample.rgb, textSample.a * textMask);

            // Breathing alpha
            float breath = 0.9 + 0.1 * sin(uTime * 0.8);
            float alpha = edge;

            gl_FragColor = vec4(color, alpha);
        }
    `
});

const vaporBubbleGeo = new THREE.PlaneGeometry(1.6, 0.9, 1, 1);
const vaporBubbleMesh = new THREE.Mesh(vaporBubbleGeo, vaporBubbleMaterial);
vaporBubbleMesh.position.set(0, 2.2, 0);

scene.add(vaporBubbleMesh);

// ---------------------
// Camera Intro — GSAP
// ---------------------
const introStart = { x: -12, y: 5, z: 12 };
const introEnd   = { x: -4, y: 1.5, z: 4 };

const lookTarget = new THREE.Vector3(0, 3, 0);

camera.position.set(introStart.x, introStart.y, introStart.z);
camera.lookAt(lookTarget);
controls.enabled = false;

const tl = gsap.timeline({
    onUpdate: () => {
        camera.lookAt(lookTarget);
    },
    onComplete: () => {
        controls.enabled = true;
        controls.target.set(0, 0, 0);
        controls.update();
    }
});

// Camera swoops in
tl.to(camera.position, {
    x: introEnd.x,
    y: introEnd.y,
    z: introEnd.z,
    duration: 2.5,
    ease: 'power3.out',
}, 0);

// LookAt drifts down simultaneously
tl.to(lookTarget, {
    y: 0,
    duration: 2.5,
    ease: 'power2.out',
}, 0);

// ---------------------------------
// Animation loop
// ---------------------------------
const clock = new THREE.Clock();


function animate() {
    const elapsedTime = clock.getElapsedTime();

    customUniforms.uTime.value = elapsedTime
    waveCustomUniforms.uTime.value = elapsedTime
    vaporBubbleMaterial.uniforms.uTime.value = elapsedTime;

    requestAnimationFrame(animate);
    controls.update();

    vaporBubbleMesh.quaternion.copy(camera.quaternion);

    renderer.render( scene, camera );
} animate()


const GUITick = () => {
    if(AtlasModel){
        AtlasModel.position.y = debugObject.positionY
        AtlasModel.scale.set(debugObject.scale, debugObject.scale, debugObject.scale);
    }
}

window.addEventListener('time-change', (e) => {
    updatePeopleCount(e.detail.hour);
});

window.addEventListener("resize", () => {
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});
