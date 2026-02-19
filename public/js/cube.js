import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import GUI from "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.js";

const gui = new GUI({
    width: 340,
    title: 'Debug Menu',
    closeFolders: false
})
//gui.close()
//gui.hide()

window.addEventListener('keydown', (event) => {
    if(event.key === 'h') {
        gui.show(gui._hidden)
    }
})

const debugObject = {}
debugObject.color = '#d6d8e9'

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

//atlas
const objLoader = new OBJLoader();
const AtlasMaterial = new THREE.MeshStandardMaterial({
    color: debugObject.color,
    metalness: 0.2,
    roughness: 0.7,
});

debugObject.positionY = -.3

gui
    .addColor(debugObject, 'color')
    .onChange( () => {
        AtlasMaterial.color.set(debugObject.color)
    })

gui
    .add(debugObject, 'positionY')
    .min(-3)
    .max(3)
    .step(0.01)
    .name('elevation')

objLoader.load(
    'models/OBJATLAS.obj',
    (object) => {
        console.log('OBJ loaded successfully', object);
        object.traverse((child) => {
            if (child.isMesh) {
                child.material = AtlasMaterial;
                child.position.y = debugObject.positionY
            }
        });
        object.position.z = -.1;
        object.rotation.y = Math.PI;

        scene.add(object);
    }
);

//object
const circleGeometry = new THREE.CircleGeometry(1.2,64)
const circleMaterial = new THREE.MeshBasicMaterial({
    color: 0xD6D6C5,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
});
const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial)

circleMesh.scale.set(1.2, 1.2, 1.2)
circleMesh.rotation.x = -Math.PI / 2;
circleMesh.position.y = -.35

scene.add(circleMesh)

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

//controls
const controls = new OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;


function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render( scene, camera );
}

animate()


window.addEventListener("resize", () => {
    const w = app.clientWidth || window.innerWidth;
    const h = app.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
});
