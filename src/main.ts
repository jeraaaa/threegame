import * as THREE from 'three';
import Ammo from 'ammojs-typed';

import { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import * as Engine from "./engine"

await Engine.init();

let transform = new Ammo.btTransform();

Engine.camera.rotation.order = "YXZ";

let output = <HTMLElement> document.getElementById("output");

function world() {
    // const skybox = new THREE.CubeTextureLoader().setPath("skybox/").load(["right.png", "left.png", "up.png", "down.png", "front.png", "back.png"]);
    // skybox.mapping = THREE.CubeRefractionMapping;
    // Engine.scene.background = skybox;
    Engine.scene.background = new THREE.Color(0xa0aab0);
    Engine.scene.fog = new THREE.FogExp2(0xa0aab0, 0.05);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(0, 50, -50);
    Engine.scene.add(directionalLight);
    
    const ambientLight = new THREE.AmbientLight(0xbbbbbb);
    Engine.scene.add(ambientLight);

    const floor = new Engine.Object();
    floor.initGraphics(new THREE.Mesh(new THREE.BoxGeometry(100, 1, 100), new THREE.MeshPhongMaterial({ color: 0xdddddd })), new THREE.Vector3(0, -2, 0));
    floor.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(50, 0.5, 50)), 0);

    const box = new Engine.Object();
    box.initGraphics(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({ color: 0xff0000 })), new THREE.Vector3(0, 5, 0));
    box.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), 1);
}
world();

const player = new Engine.Object();
player.initPhysics(new Ammo.btCapsuleShape(1, 2), 8, new Ammo.btVector3(0, 5, 5));
player.body.setActivationState(4);
player.body.setFriction(0);
player.body.setAngularFactor(new Ammo.btVector3(0, 0, 0));
player.body.setRestitution(0);

const loader = new GLTFLoader();
loader.load('/hat.gltf', function (hat) {
    const obj = new Engine.Object();
    obj.initGraphics(hat.scene);
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

function loop() {
    requestAnimationFrame(loop);
    Engine.world.stepSimulation(1 / 120);
    Engine.render();

    const dispatcher = Engine.world.getDispatcher();
    grounded = false;
    slope = new Ammo.btVector3(0, -1, 0);
    for (let i = 0; i < dispatcher.getNumManifolds(); i++) {
        const manifold = dispatcher.getManifoldByIndexInternal(i);
        const obj1 = Ammo.btRigidBody.prototype.upcast(manifold.getBody0());
        const obj2 = Ammo.btRigidBody.prototype.upcast(manifold.getBody1());

        if (player.body != obj1 && player.body != obj2) continue;
        for (let j = 0; j < manifold.getNumContacts(); j++) {
            const point = manifold.getContactPoint(j);

            if (point.getDistance() <= 0.001) {
                let normal = point.get_m_normalWorldOnB();
                if (obj2 === player.body) {
                    normal = new Ammo.btVector3(-normal.x(), -normal.y(), -normal.z());
                }
                // output.innerHTML += `X: ${normal.x().toFixed(2)}<br>Y: ${normal.y().toFixed(2)}<br>Z: ${normal.z().toFixed(2)}<br>`;
                // output.innerHTML += `Slope: ${(Math.acos(normal.y()) * 180/Math.PI).toFixed(2)} <br>`;
                if (Math.acos(normal.y()) < Math.acos(slope.y())) slope = normal;
            }
        }
    }
    if (Math.acos(slope.y()) < 45 * Math.PI / 180) grounded = true;

    for (let i = 0; i < inputs.length; i++) {
        const input = inputs.pop();

        if (input === " " && grounded) {
            player.body.applyCentralImpulse(new Ammo.btVector3(0, 60, 0));
        } else if (input === "e") {
            player.body.getMotionState().getWorldTransform(transform);
            const pos = transform.getOrigin();
            const block = new Engine.Object();
            block.initGraphics(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshPhongMaterial({color: 0xff0000})), new THREE.Vector3(pos.x(), pos.y(), pos.z()-5));
            block.initPhysics(new Ammo.btBoxShape(new Ammo.btVector3(.5, .5, .5)), 8);
        }
    }

    const input = new THREE.Vector2((keys.d) ? 1 : 0 + ((keys.a) ? -1 : 0), (keys.w) ? 1 : 0 + ((keys.s) ? -1 : 0));
    input.normalize();
    const yaw = Engine.camera.rotation.y;
    const cos = Math.cos(yaw);
    const sin = Math.sin(yaw);
    const vel = player.body.getLinearVelocity();
    // let speed = Math.sqrt(square(vel.x()) + square(vel.z()));

    let speed = 288;
    if (!grounded) {
        speed *= 0.1;
    } else {
        player.body.setLinearVelocity(new Ammo.btVector3(vel.x() * 0.95, vel.y(), vel.z() * 0.95));
    }
    player.body.applyCentralForce(new Ammo.btVector3((sin * input.y - cos * input.x) * -speed, 0, (cos * input.y + sin * input.x) * -speed));

    player.body.getMotionState().getWorldTransform(transform)
    const playerPos = transform.getOrigin();
    Engine.camera.position.set(playerPos.x(), playerPos.y()+.5, playerPos.z());
    playerPos.setY(playerPos.y() + 1);
    transform.setOrigin(playerPos);
}

requestAnimationFrame(loop);