import * as THREE from 'three';
import Ammo from 'ammojs-typed';
import { BloomEffect, PixelationEffect, ColorDepthEffect, EffectPass, ChromaticAberrationEffect, BlendFunction, ScanlineEffect, VignetteEffect } from 'postprocessing'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import * as Engine from "./engine"

// initialize engine
Engine.init();

function assert(expr: unknown, msg?: string): asserts expr {
    if (!expr) throw new Error(msg);
}

// set up temporary transform
let transform = new Ammo.btTransform();

Engine.camera.rotation.order = "YXZ";

let modal = false;

let shedModal = <HTMLDialogElement> document.getElementById("shed");

let messages = <HTMLElement> document.getElementById("log");
function log(msg: string) {
    const div = document.createElement("div");
    div.innerText = msg;
    messages.appendChild(div);
}

let code: {[index: string]: number} = {
    "red": Math.floor(Math.random()*256),
    "green": Math.floor(Math.random()*256),
    "blue": Math.floor(Math.random()*256)
};

// add objects to the world
function world() {
    // create sun+shadow map
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

    // post processing fx
    const bloom = new BloomEffect({blendFunction: BlendFunction.ADD, luminanceThreshold: 0.3, mipmapBlur: true})
    const pass = new EffectPass(Engine.camera, 
        bloom,
        new ColorDepthEffect({ bits: 24 }), 
        new PixelationEffect(4)
    );
    pass.dithering = true;
    Engine.composer.addPass(pass);
    const scanline = new ScanlineEffect({blendFunction: BlendFunction.MULTIPLY, density: 2});
    scanline.blendMode.setOpacity(0.25);
    const vignette = new VignetteEffect({offset: 0.35, darkness: 0.5});
    const pass2 = new EffectPass(Engine.camera, 
        new ChromaticAberrationEffect(),
        vignette, 
        // scanline
    )
    Engine.composer.addPass(pass2);

    // enable shadow map
    Engine.renderer.shadowMap.enabled = true;

    // show fog
    Engine.scene.background = new THREE.Color(0xa0aab0);
    Engine.scene.fog = new THREE.FogExp2(0xa0aab0, 0.05);

    // make ambient light
    const ambientLight = new THREE.AmbientLight(0xbbbbbb, 0.5);
    Engine.scene.add(ambientLight);
}
world();

const inventory: {[index: string]: boolean} = {};

// make player capsule physics
const player = new Engine.Object();
player.initPhysics(new Ammo.btCapsuleShape(0.5, 1.5), 4, new Ammo.btVector3(0, 5, 5));
player.body.setActivationState(4);
player.body.setFriction(0);
player.body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
player.body.setRestitution(0);

const loader = new GLTFLoader();

// load map
loader.load('/shed.gltf', function (shed) {
    const objects: Engine.Object[] = [];
    shed.scene.traverse((child) => {
        let mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
            const obj = new Engine.Object();
            objects.push(obj);
            obj.mesh = mesh;

            // allow transparent textures
            if (mesh.name === "Gate") {
                assert(mesh.material instanceof THREE.MeshStandardMaterial);
                mesh.material.transparent = true;
                mesh.material.shadowSide = THREE.DoubleSide;
                mesh.material.alphaTest = 0.1;
                // add trigger
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(12, 7.2, .5)), new Ammo.btVector3(pos.x, pos.y, pos.z));
                trigger.onColliding = (body) => {
                    if (body === player.body && click) {
                        if (inventory.keys) {
                            obj.destroy();
                            trigger.destroy();
                            log("You escaped!")
                        } else {
                            log("The gate is locked shut.")
                        }
                    }
                }
            }
            // add trigger
            if (mesh.name === "Door") {
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(4.5, 4.8, .5)), new Ammo.btVector3(pos.x, pos.y, pos.z));
                trigger.onColliding = (body) => {
                    if (body === player.body && click) {
                        if (inventory.axe) {
                            obj.destroy();
                            trigger.destroy();
                            log("The Rusted Axe broke.")
                        } else {
                            log("The door is chained up.")
                        }
                    }
                }
            }
            // add trigger
            if (mesh.name === "Shed_Door") {
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(4.5, 4.8, .5)), new Ammo.btVector3(pos.x, pos.y, pos.z));
                const form = shedModal.children[0]
                shedModal.children[0].addEventListener("submit", (e)=>{
                    e.preventDefault();
                    assert(form.children[1] instanceof HTMLInputElement)
                    assert(form.children[2] instanceof HTMLInputElement)
                    assert(form.children[3] instanceof HTMLInputElement)
                    // check for code
                    if (form.children[1].value == code.red.toString() && form.children[2].value == code.green.toString() && form.children[3].value == code.blue.toString()) {
                        obj.destroy();
                        trigger.destroy();
                    } else {
                        log("The door remained firmly shut.")
                    }
                    if (shedModal.open) shedModal.close();
                });
                trigger.onColliding = (body) => {
                    if (body === player.body && click && !modal) {
                        shedModal.showModal();
                        modal = true
                    }
                }
            }
            // create trigger
            if (mesh.name === "Axe") {
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(.1, .5, .1)), new Ammo.btVector3(pos.x, pos.y+2.5, pos.z));
                trigger.onColliding = (body) => {
                    if (body === player.body && click) {
                        inventory.axe = true;
                        obj.destroy();
                        trigger.destroy();
                        log("Got Rusted Axe.")
                    }
                }
                return;
            }
            // create trigger
            if (mesh.name === "Lighter") {
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(.1, .5, .1)), new Ammo.btVector3(pos.x, pos.y, pos.z));
                trigger.onColliding = (body) => {
                    if (body === player.body && click) {
                        inventory.lighter = true;
                        obj.destroy();
                        trigger.destroy();
                        log("Got Lighter.")
                    }
                }
                return;
            }
            // disable collisions for trees
            if (mesh.name.indexOf("Tree") != -1) {
                return;
            }
            // create triggers for all notes
            if (mesh.name.indexOf("Note") != -1) {
                const pos = new THREE.Vector3();
                mesh.getWorldPosition(pos);
                const color = mesh.name.replace("_Note", "").toLowerCase();
                const dialog = <HTMLDialogElement> document.getElementById(color);
                dialog.children[0].innerHTML = code[color].toString(16).toUpperCase();
                const trigger = new Engine.Trigger(new Ammo.btBoxShape(new Ammo.btVector3(.1, .5, .1)), new Ammo.btVector3(pos.x, pos.y+.5, pos.z));
                trigger.onColliding = (body) => {
                    if (body === player.body && click) {
                        obj.destroy();
                        trigger.destroy();
                        log(`Got ${mesh.name.replace("_", " ")}.`);
                        dialog.showModal();
                        modal = true;
                    }
                }
                return;
            }
            // create physics geometry
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
            obj.initPhysics(new Ammo.btBvhTriangleMeshShape(triMesh, true, true), 0);
        }
    });
    // initialize graphics
    for (let i = 0; i < objects.length; i++) {
        objects[i].initGraphics(objects[i].mesh);
    }
}, undefined, function (error) {
    console.error(error);
});

// load crate
let crate: Engine.Object;
loader.load('/crate.gltf', function (model) {
    crate = new Engine.Object();
    crate.initGraphics(model.scene, new THREE.Vector3(2, 1, 0));
    crate.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), 1);
}, undefined, function (error) {
    console.error(error);
});

const keys: { [index: string]: boolean } = {};
const inputs: string[] = [];

// handle key inputs
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

// handle clicking
window.addEventListener("click", async (e) => {
    if (document.pointerLockElement) {
        click = true
    } else if (!modal) {
        // try pointer lock
        await Engine.canvas.requestPointerLock();
    } else {
        // close all modals if they are open
        const modals = document.getElementsByTagName("dialog");

        for (let i = 0; i < modals.length; i++) {
            modals[i].onclose = () => {
                modal = false;
                Engine.canvas.requestPointerLock();
            };
            if (modals[i].open && e.target == modals[i]) {
                modals[i].close();
            }
        }
    }
});

// handle mouse moving
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

let click = false

// game loop
function loop(time: number) {
    requestAnimationFrame(loop);

    // exit pointer lock if modal is open
    if (modal && document.pointerLockElement) {
        document.exitPointerLock();
    }

    let dt: number;
    if (oldTime) {
        dt = (time - oldTime)/1000;
    } else {
        dt = 1 / 120;
    }
    oldTime = time;

    // physics
    Engine.world.stepSimulation(dt);
    // render
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
    // if the slope is less than 45 degrees, the player is grounded
    if (Math.acos(slope.y()) < 45 * Math.PI / 180) grounded = true;

    // handle key inputs
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs.pop();

        if (input === " " && grounded) {
            player.body.applyCentralImpulse(new Ammo.btVector3(0, 20, 0));
        }
    }

    // player movement
    const input = new THREE.Vector2((keys.d) ? 1 : 0 + ((keys.a) ? -1 : 0), (keys.w) ? 1 : 0 + ((keys.s) ? -1 : 0));
    input.normalize();
    const yaw = Engine.camera.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const vel = player.body.getLinearVelocity();

    let speed = 72;
    if (!grounded) {
        speed *= 0.1;
    } else {
        player.body.setLinearVelocity(new Ammo.btVector3(vel.x() * 0.95, vel.y(), vel.z() * 0.95));
    }
    player.body.applyCentralForce(new Ammo.btVector3((sin * input.y - cos * input.x) * -speed, 0, (cos * input.y + sin * input.x) * -speed));

    // set cam position
    player.body.getMotionState().getWorldTransform(transform)
    const playerPos = transform.getOrigin();
    Engine.camera.position.set(playerPos.x(), playerPos.y() + .5, playerPos.z());
    playerPos.setY(playerPos.y() + 1);
    transform.setOrigin(playerPos);

    // handle lighter behavior
    if (inventory.lighter && click) {
        const cratePos = crate.mesh.position;
        const pos = new THREE.Vector3(playerPos.x(), playerPos.y(), playerPos.z())
        if (cratePos.add(pos.multiplyScalar(-1)).length() < 2) {
            inventory.lighter = false
            crate.destroy();
            log("Got keys.")
            inventory.keys = true;
        }
    }

    click = false;
}

requestAnimationFrame(loop);