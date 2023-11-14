import * as THREE from 'three';
import * as BULLET from 'ammo.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const canvas = document.querySelector("canvas");
assert(canvas);

function assert(expr: unknown, msg?: string): asserts expr {
  if (!expr) throw new Error(msg);
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.rotation.order = "YXZ";
camera.position.set(0, 0, 0);
camera.rotation.set(0, 180*Math.PI/180, 0);

scene.background = new THREE.Color(0x393a3d);

const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

function setup() {
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
  scene.add(directionalLight);
  
  const ambientLight = new THREE.AmbientLight(0xbbbbbb);
  scene.add(ambientLight);

  loader.load('/public/hat.gltf', function (hat) {
    scene.add(hat.scene);
  }, undefined, function (error) {
    console.error(error);
  });
}
setup();

const keys: {[index: string]: boolean} = {};

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const key: string = e.key.toLowerCase();

  keys[key] = true;
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
  const key: string = e.key.toLowerCase();

  keys[key] = false;
});

window.addEventListener("click", async () => {
  await canvas.requestPointerLock();
});

const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
const material = new THREE.MeshBasicMaterial({
  color: 0x628297,
  wireframe: true
});
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);
cube.position.set(0, 0, 10);

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (document.pointerLockElement) {
    camera.rotation.y -= e.movementX * Math.PI/180 * 0.25;
    camera.rotation.x -= e.movementY * Math.PI/180 * 0.25;
    camera.rotation.x = Math.min(Math.max(camera.rotation.x, Math.PI/-2), Math.PI/2)
  }
});

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);

  const input = new THREE.Vector2((keys.d)? 1:0 + ((keys.a)? -1:0), (keys.w)? 1:0 + ((keys.s)? -1:0));
  input.normalize();
  const yaw = camera.rotation.y;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  camera.position.z -= (cos * input.y + sin * input.x) * 0.1;
  camera.position.x -= (sin * input.y - cos * input.x) * 0.1;

  camera.position.y -= ((keys.q)? 1:0 - ((keys.e)? 1:0)) * 0.1;
}
requestAnimationFrame(animate);
