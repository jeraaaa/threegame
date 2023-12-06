import * as THREE from 'three';
import Ammo from 'ammojs-typed';
import { BloomEffect, PixelationEffect, ColorDepthEffect, Effect, EffectPass } from 'postprocessing'

import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// import * as Debug from './debug.js';

import * as Engine from "./engine"

await Engine.init();

// Debug.initDebug(Engine.scene, Engine.world);

function assert(expr: unknown, msg?: string): asserts expr {
    if (!expr) throw new Error(msg);
}

let transform = new Ammo.btTransform();

Engine.camera.rotation.order = "YXZ";

let output = <HTMLElement>document.getElementById("output");

function world() {
    // const skybox = new THREE.CubeTextureLoader().setPath("skybox/").load(["right.png", "left.png", "up.png", "down.png", "front.png", "back.png"]);
    // skybox.mapping = THREE.CubeRefractionMapping;
    // Engine.scene.background = skybox;
    const effects: Effect[] = [];
    effects.push(new BloomEffect());
    effects.push(new PixelationEffect(4));
    effects.push(new ColorDepthEffect({ bits: 24 }));
    Engine.composer.addPass(new EffectPass(Engine.camera, ...effects));

    window.addEventListener("resize", () => {
        effects.forEach((effect) => {
            if ("setSize" in effect) {
                assert(typeof (effect.setSize) === "function");
                effect.setSize(window.innerWidth, window.innerHeight);
            }
        });
    })

    Engine.renderer.shadowMap.enabled = true;

    Engine.scene.background = new THREE.Color(0xa0aab0);
    Engine.scene.fog = new THREE.FogExp2(0xa0aab0, 0.05);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
    directionalLight.position.set(0, 50, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.mapSize.width = 4096;
    directionalLight.shadow.mapSize.height = 4096;
    directionalLight.shadow.bias = -0.0001;
    directionalLight.shadow.normalBias = 0.01;
    Engine.scene.add(directionalLight);

    const ambientLight = new THREE.AmbientLight(0xbbbbbb, 0.5);
    Engine.scene.add(ambientLight);

    // const plane = new Engine.Object();
    // plane.initGraphics(new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshPhongMaterial({color: 0xdddddd})), new THREE.Vector3(0, -2, 0));
    // plane.mesh.rotateX(-Math.PI/2);
    // plane.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(50, 50, 0.1)), 0);

    // const box = new Engine.Object();
    // box.initGraphics(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({ color: 0xff0000 })), new THREE.Vector3(0, 5, 0));
    // box.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), 1);
}
world();

const player = new Engine.Object();
player.initPhysics(new Ammo.btCapsuleShape(0.5, 1.5), 4, new Ammo.btVector3(0, 5, 5));
player.body.setActivationState(4);
player.body.setFriction(0);
player.body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
player.body.setRestitution(0);

const loader = new GLTFLoader();
loader.load('/shed.gltf', function (shed) {
    const objects: Engine.Object[] = [];
    shed.scene.traverse((child) => {
        let mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            assert(mesh.material instanceof THREE.MeshStandardMaterial);
            if (mesh.name === "Plane003") {
                mesh.material.transparent = true;
                mesh.material.shadowSide = THREE.DoubleSide;
                mesh.material.alphaTest = 0.1;
            }
            const obj = new Engine.Object();
            const triMesh = new Ammo.btTriangleMesh(true, true);
            const geometry = mesh.geometry
            const position = geometry.getAttribute("position");
            const array = position.array;
            const vertices: Ammo.btVector3[] = [];
            for (let i = 0; i < array.length; i += 3) {
                vertices.push(new Ammo.btVector3(array[i], array[i + 1], array[i + 2]));
            }
            if (geometry.index) {
                const indices = geometry.index.array;
                for (let i = 0; i < indices.length; i += 3) {
                    triMesh.addTriangle(vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]);
                }
            } else {
                for (let i = 0; i < vertices.length; i += 3) {
                    triMesh.addTriangle(vertices[i], vertices[i + 1], vertices[i + 2]);
                }
            }
            objects.push(obj);
            obj.mesh = mesh;
            obj.initPhysics(new Ammo.btBvhTriangleMeshShape(triMesh, true, true), 0);
        }
    });
    for (let i = 0; i < objects.length; i++) {
        objects[i].initGraphics(objects[i].mesh);
    }
    // const obj = new Engine.Object();
    // obj.initGraphics(shed.scene, new THREE.Vector3(0, -2, 0));
    // obj.initPhysics(Engine.createbtBvhTriangleMeshShape(shed), 0, new Ammo.btVector3(0, 0, 0));
}, undefined, function (error) {
    console.error(error);
});
let crate: Engine.Object;
loader.load('/crate.gltf', function (model) {
    crate = new Engine.Object();
    crate.initGraphics(model.scene, new THREE.Vector3(2, 1, 0));
    crate.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), 1);
}, undefined, function (error) {
    console.error(error);
});
let notes: Engine.Object[] = [];
loader.load('/note.gltf', function (note) {
    notes.push(new Engine.Object());
    const t1 = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), new Ammo.btVector3(0, 0.25, 0));
    t1.onColliding = (obj) => {
        if (obj === player.body) {
            notes[0].mesh.traverse((child) => {
                if ("isMesh" in child) {
                    const mesh = child as THREE.Mesh;
                    mesh.geometry.dispose();
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((m)=>{m.dispose()});
                    } else {
                        mesh.material.dispose();
                    }
                }
            })
            Engine.scene.remove(notes[0].mesh);
            Engine.world.removeCollisionObject(t1.object);
        }
    }
    notes[0].initGraphics(note.scene, new THREE.Vector3(0, 0, 0), new THREE.Euler(0, 12 / 180 * Math.PI, 0));
}, undefined, function (error) {
    console.error(error);
});

const keys: { [index: string]: boolean } = {};
const inputs: string[] = [];

window.addEventListener("keydown", (e: KeyboardEvent) => {
    const key: string = e.key.toLowerCase();

    keys[key] = true;

    if (e.repeat) return;
    inputs.push(key);
});

window.addEventListener("keyup", (e: KeyboardEvent) => {
    const key: string = e.key.toLowerCase();

    keys[key] = false;
});

window.addEventListener("click", async () => {
    if (!document.pointerLockElement) await Engine.canvas.requestPointerLock();
});

window.addEventListener("mousemove", (e: MouseEvent) => {
    if (document.pointerLockElement) {
        Engine.camera.rotation.y -= e.movementX * Math.PI / 180 * 0.25;
        Engine.camera.rotation.x -= e.movementY * Math.PI / 180 * 0.25;
        Engine.camera.rotation.x = Math.min(Math.max(Engine.camera.rotation.x, Math.PI / -2), Math.PI / 2)
    }
});

let grounded = false;
let slope: Ammo.btVector3;

let oldTime: number;

let fps = 60;
let accumulator = 0;

function loop(time: number) {
    requestAnimationFrame(loop);

    let dt: number;
    if (oldTime) {
        dt = time - oldTime;
    } else {
        dt = 1 / 120;
    }

    Engine.world.stepSimulation(dt);

    accumulator += dt;
    if (accumulator > 1 / fps) {
        accumulator -= 1 / fps;
    }

    Engine.render();

    const dispatcher = Engine.world.getDispatcher();
    grounded = false;
    slope = new Ammo.btVector3(0, -1, 0);
    // iterate through collisions
    for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
        const manifold = dispatcher.getManifoldByIndexInternal(i);
        const obj1 = Ammo.btRigidBody.prototype.upcast(manifold.getBody0());
        const obj2 = Ammo.btRigidBody.prototype.upcast(manifold.getBody1());

        // look for contacts only with the player
        if (player.body != obj1 && player.body != obj2) continue;
        for (let j = 0; j < manifold.getNumContacts(); j++) {
            const point = manifold.getContactPoint(j);

            if (point.getDistance() <= 0.001) {
                let normal = point.get_m_normalWorldOnB();
                if (obj2 === player.body) {
                    normal = new Ammo.btVector3(-normal.x(), -normal.y(), -normal.z());
                }
                // look for the most horizontal contact normal
                if (Math.acos(normal.y()) < Math.acos(slope.y())) slope = normal;
            }
        }
    }
    if (Math.acos(slope.y()) < 45 * Math.PI / 180) grounded = true;

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs.pop();

        if (input === " " && grounded) {
            player.body.applyCentralImpulse(new Ammo.btVector3(0, 20, 0));
        } else if (input === "r") {
            player.body.getMotionState().getWorldTransform(transform);
            transform.setOrigin(transform.getOrigin().op_add(new Ammo.btVector3(0, 2, 0)))
            crate.body.setWorldTransform(transform);
            crate.body.activate();
            crate.body.setLinearVelocity(new Ammo.btVector3(0, 0, 0));
        }
    }

    const input = new THREE.Vector2((keys.d) ? 1 : 0 + ((keys.a) ? -1 : 0), (keys.w) ? 1 : 0 + ((keys.s) ? -1 : 0));
    input.normalize();
    const yaw = Engine.camera.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const vel = player.body.getLinearVelocity();
    // let speed = Math.sqrt(square(vel.x()) + square(vel.z()));

    let speed = 72;
    if (!grounded) {
        speed *= 0.1;
    } else {
        player.body.setLinearVelocity(new Ammo.btVector3(vel.x() * 0.95, vel.y(), vel.z() * 0.95));
    }
    player.body.applyCentralForce(new Ammo.btVector3((sin * input.y - cos * input.x) * -speed, 0, (cos * input.y + sin * input.x) * -speed));

    player.body.getMotionState().getWorldTransform(transform)
    const playerPos = transform.getOrigin();
    Engine.camera.position.set(playerPos.x(), playerPos.y() + .5, playerPos.z());
    playerPos.setY(playerPos.y() + 1);
    transform.setOrigin(playerPos);
}

requestAnimationFrame(loop);