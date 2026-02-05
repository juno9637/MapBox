import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const app = document.getElementById("app");

const width = app.clientWidth || window.innerWidth;
const height = app.clientHeight || window.innerHeight;

// Canvas
const canvas = document.querySelector('canvas.webgl')

//scene
const scene = new THREE.Scene();

//object
const geometry = new THREE.BoxGeometry(1,1,1)
const material = new THREE.MeshBasicMaterial({color: 0xC5D4D6})
const mesh = new THREE.Mesh(geometry, material)
scene.add(mesh)

//object
const circleGeometry = new THREE.CircleGeometry(1.2,64)
const circleMaterial = new THREE.MeshBasicMaterial({
    color: 0xD6D6C5,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide
});
const circleMesh = new THREE.Mesh(circleGeometry, circleMaterial)
circleMesh.rotation.x = -Math.PI / 2;
circleMesh.position.y = -0.5;


scene.add(circleMesh)

//sizes
const sizes = {
    width:width,
    height:height
}
//camera
const camera = new THREE.PerspectiveCamera(75, sizes.width/sizes.height)
camera.position.z = 3
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
