import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import Ammo from 'ammojs-typed';
import { ThreeMFLoader } from 'three/examples/jsm/Addons.js';

const loader = new GLTFLoader();

const canvas = document.querySelector("canvas");
assert(canvas);

function assert(expr: unknown, msg?: string): asserts expr {
  if (!expr) throw new Error(msg);
}

let physicsWorld: Ammo.btDiscreteDynamicsWorld, transform: Ammo.btTransform;

function initPhysics() {
  let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
    dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
    overlappingPairCache = new Ammo.btDbvtBroadphase(),
    solver = new Ammo.btSequentialImpulseConstraintSolver();

  physicsWorld = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
  physicsWorld.setGravity(new Ammo.btVector3(0, -10, 0));
}

let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, clock: THREE.Clock;

function initGraphics() {
  clock = new THREE.Clock();

  assert(canvas);
  renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
  renderer.setSize(window.innerWidth, window.innerHeight);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x393a3d);

  const skybox = new THREE.CubeTextureLoader().setPath("skybox/").load(["right.png", "left.png", "up.png", "down.png", "front.png", "back.png"]);
  skybox.mapping = THREE.CubeRefractionMapping;
  scene.background = skybox;

  camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.rotation.order = "YXZ";
  camera.position.set(0, 0, 0);
  camera.rotation.set(0, 180*Math.PI/180, 0);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(0, 50, -50);
  scene.add(directionalLight);
  
  const ambientLight = new THREE.AmbientLight(0xbbbbbb);
  scene.add(ambientLight);

  loader.load('/hat.gltf', function (hat) {
    scene.add(hat.scene);
  }, undefined, function (error) {
    console.error(error);
  });

  const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
  const material = new THREE.MeshBasicMaterial({
    color: 0x628297,
    wireframe: true
  });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  cube.position.set(0, 0, 10);
}

let player: Ammo.btRigidBody;

function initWorld() {
  // Create ammo capsule to represent player
  transform = new Ammo.btTransform();
  transform.setIdentity();
  transform.setOrigin(new Ammo.btVector3(0, 0, 0));
  transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
  let colShape: Ammo.btCollisionShape = new Ammo.btCapsuleShape(1, 2);
  colShape.setMargin(0.05);
  let inertia = new Ammo.btVector3(0, 0, 0);
  colShape.calculateLocalInertia(1, inertia);
  let info = new Ammo.btRigidBodyConstructionInfo(1, new Ammo.btDefaultMotionState(transform), colShape, inertia);
  player = new Ammo.btRigidBody(info);
  player.setFriction(2.5);
  player.setDamping(0.8, 0);
  //limit rotation to around y-axis
  player.setAngularFactor(new Ammo.btVector3(0, 1, 0));
  physicsWorld.addRigidBody(player);

  // create floor
  let block = new THREE.Mesh(new THREE.BoxGeometry(100, 1, 100), new THREE.MeshBasicMaterial({color: 0xff0000, wireframe: true}));
  block.position.set(0, -2, 0);
  scene.add(block);

  transform.setOrigin(new Ammo.btVector3(0, -2, 0));
  colShape = new Ammo.btBoxShape(new Ammo.btVector3(50, 0.5, 50));
  colShape.setMargin(0.05);
  inertia = new Ammo.btVector3(0, 0, 0);
  colShape.calculateLocalInertia(0, inertia);
  info = new Ammo.btRigidBodyConstructionInfo(0, new Ammo.btDefaultMotionState(transform), colShape, inertia);
  physicsWorld.addRigidBody(new Ammo.btRigidBody(info));

  // create box
  block = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshPhongMaterial({color: 0xff0000}));
  block.position.set(0, 0, 0);
  scene.add(block);
  transform.setOrigin(new Ammo.btVector3(0, 0, 0));
  colShape = new Ammo.btBoxShape(new Ammo.btVector3(1, 1, 1));
  colShape.setMargin(0.05);
  inertia = new Ammo.btVector3(0, 0, 0);
  colShape.calculateLocalInertia(0, inertia);
  info = new Ammo.btRigidBodyConstructionInfo(8, new Ammo.btDefaultMotionState(transform), colShape, inertia);
  let body = new Ammo.btRigidBody(info)
  physicsWorld.addRigidBody(body);
  block.userData.physicsBody = body;
  rigidBodies.push(block);
}

Ammo(Ammo).then(function() {
  initGraphics();
  initPhysics();
  initWorld();

  requestAnimationFrame(animate);
});

const rigidBodies: THREE.Mesh[] = [];

function createMesh(path: string) {
  loader.load(path, (model: GLTF) => {
    
  });
}

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

window.addEventListener("mousemove", (e: MouseEvent) => {
  if (document.pointerLockElement) {
    camera.rotation.y -= e.movementX * Math.PI/180 * 0.25;
    camera.rotation.x -= e.movementY * Math.PI/180 * 0.25;
    camera.rotation.x = Math.min(Math.max(camera.rotation.x, Math.PI/-2), Math.PI/2)
  }
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth/window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);

  renderer.render(scene, camera);

  const dt = clock.getDelta();
  physicsWorld.stepSimulation(dt);

  player.getMotionState().getWorldTransform(transform);
  const playerPos = transform.getOrigin();

  camera.position.set(playerPos.x(), playerPos.y()+1, playerPos.z());

  const input = new THREE.Vector2((keys.d)? 1:0 + ((keys.a)? -1:0), (keys.w)? 1:0 + ((keys.s)? -1:0));
  input.normalize();
  const yaw = camera.rotation.y;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  player.applyCentralImpulse(new Ammo.btVector3((sin * input.y - cos * input.x) * -0.5, 0, (cos * input.y + sin * input.x) * -0.5));

  for (let i = 0; i < rigidBodies.length; i++) {
    let mesh = rigidBodies[i];
    let body: Ammo.btRigidBody | undefined = mesh.userData.physicsBody;
    assert(body);
    body.getMotionState().getWorldTransform(transform);
    const pos = transform.getOrigin();
    const rot = transform.getRotation();
    mesh.position.set(pos.x(), pos.y(), pos.z());
    mesh.rotation.setFromQuaternion(new THREE.Quaternion(rot.x(), rot.y(), rot.z(), rot.w()));
  }
}
