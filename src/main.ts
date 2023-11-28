import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import Ammo from 'ammojs-typed';

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
  colShape.calculateLocalInertia(8, inertia);
  let info = new Ammo.btRigidBodyConstructionInfo(8, new Ammo.btDefaultMotionState(transform), colShape, inertia);
  player = new Ammo.btRigidBody(info);
  player.setFriction(0);
  //limit rotation to y-axis
  player.setAngularFactor(new Ammo.btVector3(0, 0, 0));
  /*
  ACTIVE_TAG 1
  ISLAND_SLEEPING 2
  WANTS_DEACTIVATION 3
  DISABLE_DEACTIVATION 4
  DISABLE_SIMULATION 5
  */
  // make sure physics for the player is always active
  player.setActivationState(4);
  physicsWorld.addRigidBody(player);
  // let capsule = new THREE.Mesh(new THREE.CapsuleGeometry(1, 2), new THREE.MeshPhongMaterial({color: 0xdddddd}));
  // capsule.position.set(0, 0, 0);
  // scene.add(capsule);
  // capsule.userData.physicsBody = player;
  // rigidBodies.push(capsule);

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
  colShape.calculateLocalInertia(8, inertia);
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
const inputs: {key: string, time: number}[] = [];

window.addEventListener("keydown", (e: KeyboardEvent) => {
  const key: string = e.key.toLowerCase();

  if (key === "t") {
    player.setLinearVelocity(new Ammo.btVector3(10, 10, 10));
  }

  keys[key] = true;

  if (e.repeat) return;
  inputs.push({key: key, time: clock.elapsedTime});
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

function square(n: number) {
  return n * n;
}

let grounded = false;
let slope: Ammo.btVector3;

const contacts: Map<Ammo.btCollisionObject, Ammo.btPersistentManifold> = new Map();

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);

  const dt = clock.getDelta();
  physicsWorld.stepSimulation(dt);

  grounded = false;
  const dispatcher = physicsWorld.getDispatcher();
  slope = new Ammo.btVector3(0, -1, 0);
  for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
    const manifold = dispatcher.getManifoldByIndexInternal(i);
    const obj1 = Ammo.btRigidBody.prototype.upcast(manifold.getBody0());
    const obj2 = Ammo.btRigidBody.prototype.upcast(manifold.getBody1());
    
    if (player != obj1 && player != obj2) continue;
    for (let j = 0; j < manifold.getNumContacts(); j++) {
      const point = manifold.getContactPoint(j);
      
      if (point.getDistance() <= 1) {
        let normal = point.get_m_normalWorldOnB();
        if (obj2 == player) {
          normal.op_mul(-1);
        }
        // console.log(`X: ${normal.x()} Y: ${normal.y()} Z: ${normal.z()}`)
        // console.log(Math.acos(normal.y()) < 45*Math.PI/180);
        if (Math.acos(normal.y()) < Math.acos(slope.y())) slope = normal;
      }
    }
  }
  if (Math.acos(slope.y()) < 45*Math.PI/180) grounded = true;
  
  player.getMotionState().getWorldTransform(transform);
  const playerPos = transform.getOrigin();
  const rotation = new THREE.Quaternion();
  camera.getWorldQuaternion(rotation);
  transform.setRotation(new Ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w));
  // player.setWorldTransform(transform);
  camera.position.set(playerPos.x(), playerPos.y()+1, playerPos.z());

  const input = new THREE.Vector2((keys.d)? 1:0 + ((keys.a)? -1:0), (keys.w)? 1:0 + ((keys.s)? -1:0));
  input.normalize();
  const yaw = camera.rotation.y;
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const vel = player.getLinearVelocity();
  // let speed = Math.sqrt(square(vel.x()) + square(vel.z()));

  let speed = 288;
  if (!grounded) {
    speed *= 0.1;
  } else {
    player.setLinearVelocity(new Ammo.btVector3(vel.x()*0.95, vel.y(), vel.z()*0.95));
  }
  player.applyCentralForce(new Ammo.btVector3((sin * input.y - cos * input.x)*-speed, 0, (cos * input.y + sin * input.x)*-speed));
  console.log(`X: ${vel.x()} Y: ${vel.y()} Z: ${vel.z()}`);
;  for (let i = 0; i < inputs.length; i++) {
    const key = inputs.pop();
    assert(key);
    if (key.key === " " && grounded) {
      player.applyCentralImpulse(new Ammo.btVector3(0, 60, 0));
    } else if (key.key === "e") {
      player.getMotionState().getWorldTransform(transform);
      const pos = transform.getOrigin();
      pos.setX(pos.x() + 2);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color: 0x00ff00}));
      mesh.position.set(pos.x(), pos.y(), pos.z());
      scene.add(mesh);
      // transform.setIdentity();
      transform.setOrigin(new Ammo.btVector3(pos.x(), pos.y(), pos.z()));
      transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
      let colShape: Ammo.btCollisionShape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5));
      colShape.setMargin(0.05);
      let inertia = new Ammo.btVector3(0, 0, 0);
      colShape.calculateLocalInertia(8, inertia);
      let info = new Ammo.btRigidBodyConstructionInfo(8, new Ammo.btDefaultMotionState(transform), colShape, inertia);
      const body = new Ammo.btRigidBody(info);
      mesh.userData.physicsBody = body;
      physicsWorld.addRigidBody(body);
      rigidBodies.push(mesh);
    }
  }

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
