import * as THREE from 'three';
import Ammo from 'ammojs-typed';

import { EffectComposer, RenderPass } from "postprocessing";

function assert(expr: unknown, msg?: string): asserts expr {
    if (!expr && expr != 0) throw new Error(msg);
}

export let canvas: HTMLCanvasElement;
if (document.querySelector("canvas")) {
    canvas = <HTMLCanvasElement> document.querySelector("canvas");
} else {
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
}

export let scene: THREE.Scene, renderer: THREE.WebGLRenderer, clock: THREE.Clock, camera: THREE.PerspectiveCamera, composer: EffectComposer;
function initGraphics() {
    clock = new THREE.Clock();

    assert(canvas);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, stencil: false, depth: false });
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 0, 0);
    camera.rotation.set(0, 0, 0);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x393a3d);

    composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    window.addEventListener("resize", () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    });
}

export let world: Ammo.btDiscreteDynamicsWorld; 
let transform: Ammo.btTransform;
function initPhysics() {
    let collisionConfiguration = new Ammo.btDefaultCollisionConfiguration(),
        dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration),
        overlappingPairCache = new Ammo.btDbvtBroadphase(),
        solver = new Ammo.btSequentialImpulseConstraintSolver();

    world = new Ammo.btDiscreteDynamicsWorld(dispatcher, overlappingPairCache, solver, collisionConfiguration);
    world.setGravity(new Ammo.btVector3(0, -10, 0));
    
    transform = new Ammo.btTransform();
}

export async function init() {
    await Ammo(Ammo);
    initGraphics();
    initPhysics();
}

const rigidBodies: THREE.Object3D[] = [];
export class Object {
    mesh: THREE.Object3D = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    body: Ammo.btRigidBody = new Ammo.btRigidBody(new Ammo.btRigidBodyConstructionInfo(0, new Ammo.btDefaultMotionState(transform), new Ammo.btBoxShape(new Ammo.btVector3(0, 0, 0))));
    update() {
        if (this.body && this.mesh) {
            this.body.getMotionState().getWorldTransform(transform);
            const pos = transform.getOrigin();
            const rot = transform.getRotation();
            this.mesh.position.set(pos.x(), pos.y(), pos.z());
            this.mesh.rotation.setFromQuaternion(new THREE.Quaternion(rot.x(), rot.y(), rot.z(), rot.w()));
        } else {
            return;
        }
    }
    destroy() {
        let index = rigidBodies.findIndex((obj) => {return obj===this.mesh});

        scene.remove(this.mesh);
        this.mesh.traverse((child)=>{
            if ("isMesh" in child) {
                const mesh = child as THREE.Mesh;
                mesh.geometry.dispose();
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m)=>{m.dispose()});
                } else {
                    mesh.material.dispose();
                }
            }
        });
        world.removeRigidBody(this.body);
        world.removeCollisionObject(this.body);

        if (index != -1) {
            rigidBodies.splice(index, 1);
        }
    }

    initGraphics(mesh: THREE.Object3D, position?: THREE.Vector3, rotation?: THREE.Euler) {
        if (position) mesh.position.set(position.x, position.y, position.z);
        if (rotation) mesh.setRotationFromEuler(rotation);
        scene.add(mesh);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.traverse((child) => {
            child.castShadow = true;
            child.receiveShadow = true;
        })
        this.mesh = mesh;
    }

    initPhysics(shape: Ammo.btCollisionShape, mass: number, position?: Ammo.btVector3) {
        shape.setMargin(0.05);
        transform.setIdentity();
        if (position) {
            transform.setOrigin(position);
            transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        } else if (this.mesh) {
            const pos = this.mesh.position;
            let rot = new THREE.Quaternion();
            this.mesh.getWorldQuaternion(rot);
            transform.setOrigin(new Ammo.btVector3(pos.x, pos.y, pos.z));
            transform.setRotation(new Ammo.btQuaternion(rot.x, rot.y, rot.z, rot.w));
        } else {
            transform.setOrigin(new Ammo.btVector3(0, 0, 0));
            transform.setRotation(new Ammo.btQuaternion(0, 0, 0, 1));
        }
        let inertia = new Ammo.btVector3(0, 0, 0);
        shape.calculateLocalInertia(mass, inertia);
        const info = new Ammo.btRigidBodyConstructionInfo(mass, new Ammo.btDefaultMotionState(transform), shape, inertia);
        this.body = new Ammo.btRigidBody(info);
        world.addRigidBody(this.body);
        if (this.mesh && mass != 0) {
            this.mesh.userData.physicsBody = this.body;
            rigidBodies.push(this.mesh);
        }
    }
}

const triggers: Trigger[] = [];
export class Trigger {
    object: Ammo.btGhostObject = new Ammo.btGhostObject();
    onColliding: (body: Ammo.btRigidBody)=>void = ()=>{};
    constructor(shape: Ammo.btCollisionShape, position: Ammo.btVector3) {
        this.object.setCollisionShape(shape);
        transform.setIdentity();
        transform.setOrigin(position);
        this.object.setWorldTransform(transform);
        this.object.setCollisionFlags(4);
        triggers.push(this);
        world.addCollisionObject(this.object);
        world.getBroadphase().getOverlappingPairCache().setInternalGhostPairCallback(new Ammo.btGhostPairCallback());
    }

    destroy() {
        world.removeCollisionObject(this.object);
        triggers.splice(triggers.findIndex((value) => {return this===value}), 1);
    }
}

export function render() {
    // update rigid bodies
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

    // renderer.render(scene, camera);
    composer.render()
    
    triggers.forEach((trigger)=>{
        for (let i = 0; i < trigger.object.getNumOverlappingObjects(); i++) {
            trigger.onColliding(Ammo.btRigidBody.prototype.upcast(trigger.object.getOverlappingObject(i)));
        }
    });
}