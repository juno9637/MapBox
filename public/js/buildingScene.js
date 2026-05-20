import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js";
import { cameraTransparencyVertexShader } from '../shaders/cameraTransparency/vertex.js';
import { cameraTransparencyFragmentShader } from '../shaders/cameraTransparency/fragment.js';
import { wavesVertexShader } from '../shaders/waves/vertex.js';
import { wavesFragmentShader } from '../shaders/waves/fragment.js';
import { smellVertexShader } from '../shaders/smell/vertex.js';
import { smellFragmentShader } from '../shaders/smell/fragment.js';
import {MathUtils as currentLookAt} from "three";

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

// Mouse
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / width) * 2 - 1;
    mouse.y = - (event.clientY / height) * 2 + 1;
});

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

//Audio
const listener = new THREE.AudioListener();
camera.add(listener);

const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

audioLoader.load('sound/woodshop.mp3', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
});

const caramellSound = new THREE.Audio(listener);

audioLoader.load('sound/Caramell.mp3', (buffer) => {
    caramellSound.setBuffer(buffer);
    caramellSound.setLoop(true);
    caramellSound.setVolume(0.5);
});

const soundParams = {caramellDanceMode: false}

gui.add(soundParams, 'caramellDanceMode').name('CaramellDansen Mode :3 !!! ')

/**
 * Materials
 */

//-----------------
// Smell Material
//-----------------
const swirlGeometry = new THREE.PlaneGeometry(1, 1, 256, 256)
swirlGeometry.rotateX(-Math.PI * 0.5)
swirlGeometry.rotateY(-Math.PI * 0.2)
swirlGeometry.scale(1, 1, 1)

const swirlTexture = textureLoader.load('../textures/swirl.png')

const perlinTexture = textureLoader.load('../textures/perlin.png')
perlinTexture.wrapS = THREE.RepeatWrapping
perlinTexture.wrapT = THREE.RepeatWrapping

//Material
const swirlMaterial = new THREE.ShaderMaterial({
    vertexShader: smellVertexShader,
    fragmentShader: smellFragmentShader,
    uniforms: {
        uTime: new THREE.Uniform(0),
        uSwirlTexture: new THREE.Uniform(swirlTexture),
        uPerlinTexture: new THREE.Uniform(perlinTexture),
        uDepthColor: {value: new THREE.Color('#C6BAE6')},
        uSurfaceColor: {value: new THREE.Color('#9F92C8')}, //D2ADFF AE94EB
    },
    side: THREE.DoubleSide,
    transparent: true,
})

const swirl = new THREE.Mesh(swirlGeometry, swirlMaterial)
swirl.position.y = -0.1
swirl.position.x = -1.2
swirl.position.z = -0.2
scene.add(swirl)

let smellFolder = gui.addFolder('Smell').close()

smellFolder.addColor({SwirlColor: '#C6BAE6'}, 'SwirlColor').name('Smell Depth Color').onChange((v) => {
    swirlMaterial.uniforms.uDepthColor.value.set(v);
})
smellFolder.addColor({SwirlColor: '#9F92C8'}, 'SwirlColor').name('Smell Surface Color').onChange((v) => {
    swirlMaterial.uniforms.uSurfaceColor.value.set(v);
})

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

let FoundationUI = gui.addFolder('Foundation').close()

let foundationHue = {
    hue: 0.5,
    saturation: 0.5,
    lightness: 0.5
}

FoundationUI.add(foundationHue, 'hue').min(0).max(1).step(0.01).name('Wave Hue').onChange(() => {
    blueMatCapMaterial.color.setHSL(foundationHue.hue, foundationHue.saturation, foundationHue.lightness);
})
FoundationUI.add(foundationHue, 'saturation').min(0).max(1).step(0.01).name('Wave Saturation').onChange(() => {
    blueMatCapMaterial.color.setHSL(foundationHue.hue, foundationHue.saturation, foundationHue.lightness);
})
FoundationUI.add(foundationHue, 'lightness').min(0).max(1).step(0.01).name('Wave Lightness').onChange(() => {
    blueMatCapMaterial.color.setHSL(foundationHue.hue, foundationHue.saturation, foundationHue.lightness);
})

//-----------------
// Transparency White Matcap
//-----------------

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
            float wavesY = texture(uPerlinTexture, vec2(0.5, vUv.y * 0.2 - uTime * 0.05)).r;
            float wavesX = texture(uPerlinTexture, vec2(0.5, vUv.x * 0.2 - uTime * 0.04)).r;
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

let wallsUI = gui.addFolder('Walls').close()

let wallsHue = {
    hue: 0.5,
    saturation: 0.5,
    lightness: 0.5
}

wallsUI.add(wallsHue, 'hue').min(0).max(1).step(0.01).name('Wave Hue').onChange(() => {
    atlasMatCapMaterial.color.setHSL(wallsHue.hue, wallsHue.saturation, wallsHue.lightness);
})
wallsUI.add(wallsHue, 'saturation').min(0).max(1).step(0.01).name('Wave Saturation').onChange(() => {
    atlasMatCapMaterial.color.setHSL(wallsHue.hue, wallsHue.saturation, wallsHue.lightness);
})
wallsUI.add(wallsHue, 'lightness').min(0).max(1).step(0.01).name('Wave Lightness').onChange(() => {
    atlasMatCapMaterial.color.setHSL(wallsHue.hue, wallsHue.saturation, wallsHue.lightness);
})

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
    uBigWaveSpeed: new THREE.Uniform(8),
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

let wavesHue = {
    hue: 0.5,
    saturation: 0.5,
    lightness: 0.5
}

WavesGui.add(wavesHue, 'hue').min(0).max(1).step(0.01).name('Wave Hue').onChange(() => {
    wavesMatCapMaterial.color.setHSL(wavesHue.hue, wavesHue.saturation, wavesHue.lightness);
})
WavesGui.add(wavesHue, 'saturation').min(0).max(1).step(0.01).name('Wave Saturation').onChange(() => {
    wavesMatCapMaterial.color.setHSL(wavesHue.hue, wavesHue.saturation, wavesHue.lightness);
})
WavesGui.add(wavesHue, 'lightness').min(0).max(1).step(0.01).name('Wave Lightness').onChange(() => {
    wavesMatCapMaterial.color.setHSL(wavesHue.hue, wavesHue.saturation, wavesHue.lightness);
})

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

let lectureOne = null;
debugObject.lectureOneScale = 0.076;
debugObject.lectureOneY = 2.15;
debugObject.lectureOneZ = -1.4733;
debugObject.lectureOneX = -0.34;

//Lecture Hall
objLoader.load(
    'models/LectureOne.obj',
    (object) => {
        console.log('Lecture loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = atlasMatCapMaterial;
            }
        });
        object.position.y = debugObject.lectureOneY
        object.scale.set(debugObject.lectureOneScale, debugObject.lectureOneScale, debugObject.lectureOneScale);
        object.position.z = debugObject.lectureOneZ
        object.position.x = debugObject.lectureOneX
        object.rotation.y = Math.PI;

        lectureOne = object;
        //scene.add(object);
    }
);

let lectureTwo = null;
debugObject.lectureTwoScale = 0.07701
debugObject.lectureTwoY = 2.1887
debugObject.lectureTwoZ = -1.4733
debugObject.lectureTwoX = -0.34

//Lecture Hall
objLoader.load(
    'models/LectureTwo.obj',
    (object) => {
        console.log('Lecture loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = atlasMatCapMaterial;
            }
        });
        object.position.y = debugObject.lectureTwoY
        object.scale.set(debugObject.lectureTwoScale, debugObject.lectureTwoScale, debugObject.lectureTwoScale);
        object.position.z = debugObject.lectureTwoZ
        object.position.x = debugObject.lectureTwoX
        object.rotation.y = Math.PI;

        lectureTwo = object;
        //scene.add(object);
    }
);

let lectureThree = null;
debugObject.lectureThreeScale = 0.07701
debugObject.lectureThreeY = 2.1887
debugObject.lectureThreeZ = -1.4733
debugObject.lectureThreeX = -0.34

//Lecture Hall
objLoader.load(
    'models/LectureThree.obj',
    (object) => {
        console.log('Lecture loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = atlasMatCapMaterial;
            }
        });
        object.position.y = debugObject.lectureThreeY
        object.scale.set(debugObject.lectureThreeScale, debugObject.lectureThreeScale, debugObject.lectureThreeScale);
        object.position.z = debugObject.lectureThreeZ
        object.position.x = debugObject.lectureThreeX
        object.rotation.y = Math.PI;

        lectureThree = object;
        //scene.add(object);
    }
);

let BTU = null;
debugObject.BTUScale = 0.07701
debugObject.BTUY = 2.1887
debugObject.BTUZ = -1.4733
debugObject.BTUX = -0.34

//BTU
objLoader.load(
    'models/BTU.obj',
    (object) => {
        console.log('Lecture loaded successfully', object);

        object.traverse((child) => {
            if (child.isMesh) {
                console.log(child.name, !!child.geometry.attributes.uv, child.geometry.attributes.uv);
                child.material = atlasMatCapMaterial;
            }
        });
        object.position.y = debugObject.BTUY
        object.scale.set(debugObject.BTUScale, debugObject.BTUScale, debugObject.BTUScale);
        object.position.z = debugObject.BTUZ
        object.position.x = debugObject.BTUX
        object.rotation.y = Math.PI;

        BTU = object;
        //scene.add(object);
    }
);

// gui.add(debugObject, 'lectureTwoY').min(0).max(5).step(0.0001).name('Lecture Y').onChange(() => {
//     if(lectureTwo) lectureTwo.position.y = debugObject.lectureTwoY;
// })
// gui.add(debugObject, 'lectureTwoScale').min(0.01).max(0.2).step(0.00001).name('Lecture Scale').onChange(() => {
//     if(lectureTwo) lectureTwo.scale.set(debugObject.lectureTwoScale, debugObject.lectureTwoScale, debugObject.lectureTwoScale);
// })
// gui.add(debugObject, 'lectureTwoZ').min(-5).max(5).step(0.0001).name('Lecture Z').onChange(() => {
//     if(lectureTwo) lectureTwo.position.z = debugObject.lectureTwoZ;
// })
// gui.add(debugObject, 'lectureTwoX').min(-5).max(5).step(0.0001).name('Lecture X').onChange(() => {
//     if(lectureTwo) lectureTwo.position.x = debugObject.lectureTwoX;
// })

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
wavePlaneMesh.position.z = 1.23
wavePlaneMesh.position.x = -0.629999999999999

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

//Lecture Hall Detect Plane
const lectureRayPlaneGeo = new THREE.PlaneGeometry(1.3,1.5,2,2)
const lectureRayPlane = new THREE.Mesh(lectureRayPlaneGeo)
lectureRayPlane.rotation.x = -1.60159265358979
lectureRayPlane.position.y = -0.00999999999999979
lectureRayPlane.position.z = -0.1
lectureRayPlane.position.x = -1.15
lectureRayPlane.material.visible = false

scene.add(lectureRayPlane)

//Lecture Hall Detect Plane
const lectureTwoRayPlaneGeo = new THREE.PlaneGeometry(1,1,2,2)
const lectureTwoRayPlane = new THREE.Mesh(lectureTwoRayPlaneGeo)
lectureTwoRayPlane.rotation.x = -1.60159265358979
lectureTwoRayPlane.position.y = -0.00999999999999979
lectureTwoRayPlane.position.z = 0.460000000000001
lectureTwoRayPlane.position.x = -0.00999999999999979
lectureTwoRayPlane.material.visible = false

scene.add(lectureTwoRayPlane)

//Lecture Hall Detect Plane
const lectureThreeRayPlaneGeo = new THREE.PlaneGeometry(1,1,2,2)
const lectureThreeRayPlane = new THREE.Mesh(lectureThreeRayPlaneGeo)
lectureThreeRayPlane.rotation.x = -1.60159265358979
lectureThreeRayPlane.position.y = -0.00999999999999979
lectureThreeRayPlane.position.z = -0.629999999999999
lectureThreeRayPlane.position.x = -0.00999999999999979
lectureThreeRayPlane.material.visible = false

scene.add(lectureThreeRayPlane)

//BTUPlane
const labRayPlaneGeo = new THREE.PlaneGeometry(.8,1.8,2,2)
const labRayPlane = new THREE.Mesh(labRayPlaneGeo)
labRayPlane.rotation.x = -1.60159265358979
labRayPlane.position.y = -0.00999999999999979
labRayPlane.position.z = -0.32
labRayPlane.position.x = 1.15
labRayPlane.material.visible = false

scene.add(labRayPlane)

// gui.add(labRayPlane.position, 'x').min(-10).max(10).step(0.01).name('Lecture RayPlane X');
// gui.add(labRayPlane.position, 'y').min(-10).max(10).step(0.01).name('Lecture RayPlane Y');
// gui.add(labRayPlane.position, 'z').min(-10).max(10).step(0.01).name('Lecture RayPlane Z');

//-----------------
// Controls
//-----------------
const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;

//---------------------
//AI Slop
//---------------------
const POOL_SIZE = 60;
const MATERIALS = ['♩','♪','♫','♬'].flatMap(char =>
    ['#7F77DD','#1D9E75','#D85A30','#D4537E'].map(color => {
        const cv = Object.assign(document.createElement('canvas'), { width: 128, height: 128 });
        const c = cv.getContext('2d');
        Object.assign(c, { font: 'bold 90px serif', textAlign: 'center', textBaseline: 'middle', fillStyle: color });
        c.fillText(char, 64, 64);
        return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false });
    })
);

const pool = Array.from({ length: POOL_SIZE }, () => {
    const s = new THREE.Sprite(MATERIALS[0]);
    s.visible = false;
    scene.add(s);
    return { s, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0, w: 0, ws: 0 };
});

function spawnNote(pos) {
    const p = pool.find(p => !p.s.visible);
    if (!p) return;
    p.s.material = MATERIALS[Math.floor(Math.random() * MATERIALS.length)];
    p.s.material.opacity = 1;
    p.s.scale.setScalar(0.08 + Math.random() * 0.1);
    p.s.position.set(pos.x + (Math.random() - .5) * .1, pos.y, pos.z + (Math.random() - .5) * .1);
    p.s.visible = true;
    Object.assign(p, { life: 0, maxLife: 30 + Math.random() * 40, vx: (Math.random() - .5) * .001, vy: .0003 + Math.random() * .0002, vz: (Math.random() - .5) * .001, w: Math.random() * Math.PI * 2, ws: .05 + Math.random() * .05 });
}

function updateNoteParticles() {
    for (const p of pool) {
        if (!p.s.visible) continue;
        p.life++; p.w += p.ws;
        p.s.position.x += p.vx + Math.sin(p.w) * .003;
        p.s.position.y += p.vy;
        p.s.position.z += p.vz;
        p.s.material.opacity = Math.max(0, 1 - (p.life / p.maxLife) ** 1.5);
        if (p.life >= p.maxLife) p.s.visible = false;
    }
}

// ---------------------------------
// Animation loop
// ---------------------------------
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

const objectsToTest = [lectureRayPlane, lectureTwoRayPlane, lectureThreeRayPlane];

let lecturePairs = null;
let cameraTarget = null;

var isLookingAtLecture = false;

//  click
// window.addEventListener('click', () => {
//     raycaster.setFromCamera(mouse, camera);
//
//     for (const {plane, model} of lecturePairs) {
//         if (raycaster.intersectObject(plane).length > 0) {
//             cameraTarget = {
//                 position: new THREE.Vector3(model.position.x, 7, model.position.z),  // overhead position
//                 lookAt: new THREE.Vector3(model.position.x, 0, model.position.z)      // point to look at
//             };
//             isLookingAtLecture = true;
//             customUniforms.uCutDepth.value = 0;
//             break;
//         }
//     }
//
//     console.log(isLookingAtLecture)
// });

let lastNoteTime = 0;

function animate() {
    const elapsedTime = clock.getElapsedTime();

    customUniforms.uTime.value = elapsedTime
    waveCustomUniforms.uTime.value = elapsedTime
    swirlMaterial.uniforms.uTime.value = elapsedTime;

    updateNoteParticles();

    // ---------------------------------
    // Raycast
    // ---------------------------------

    raycaster.setFromCamera(mouse, camera)

    if(lectureOne && lectureTwo && lectureThree) {
        if (lecturePairs == null){
            lecturePairs = [
                {plane: lectureRayPlane, model: lectureOne, restY: debugObject.lectureOneY},
                {plane: lectureTwoRayPlane, model: lectureTwo, restY: debugObject.lectureTwoY},
                {plane: lectureThreeRayPlane, model: lectureThree, restY: debugObject.lectureThreeY},
                {plane: labRayPlane, model: BTU, restY: debugObject.BTUY}
            ];
        }

        const hoverY = 2.7;

        for (const { plane, model, restY } of lecturePairs) {
            const intersections = raycaster.intersectObject(plane);
            const isHovered = intersections.length > 0;
            const targetY = isHovered ? hoverY : restY;

            model.position.y += (targetY - model.position.y) * 0.1;
        }
    }
    const intersection = raycaster.intersectObject(labRayPlane);
    const isHovered = intersection.length > 0;

    //Sound
    if(soundParams.caramellDanceMode) {
        if (isHovered && !caramellSound.isPlaying) caramellSound.play();
        if (!isHovered && caramellSound.isPlaying) caramellSound.stop();
    }else{
        if (isHovered && !sound.isPlaying) sound.play();
        if (!isHovered && sound.isPlaying) sound.stop();
    }

    const noteSpawnPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0
    const mouseWorld = new THREE.Vector3();

    if ((soundParams.caramellDanceMode) && elapsedTime - lastNoteTime > 0.2) {
        raycaster.setFromCamera(mouse, camera);
        raycaster.ray.intersectPlane(noteSpawnPlane, mouseWorld);
        lastNoteTime = elapsedTime;
        spawnNote(mouseWorld);
    }

    if (cameraTarget && isLookingAtLecture) {
        camera.position.lerp(cameraTarget.position, 0.05);
        currentLookAt.lerp(cameraTarget.lookAt, 0.05);
        camera.lookAt(currentLookAt);
    }


    requestAnimationFrame(animate);
    controls.update();

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

document.addEventListener('click', () => {
    if (listener.context.state === 'suspended') {
        listener.context.resume();
    }
}, { once: true });