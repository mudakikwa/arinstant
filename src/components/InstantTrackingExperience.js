import React, { Component, createRef } from 'react'
import * as THREE from "three";
import * as ZapparThree from "@zappar/zappar-threejs";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import ZapparSharing from '@zappar/sharing'
import "./styles/InstantTrackingExperience.css"
import "./styles/loadingUI.css"
import "./styles/manager.css"

export default class InstantTrackingExperience extends Component {
    constructor(props) {
        super(props)
        this.canvas = createRef()
        this.experienceUI = createRef()
        this.dragInfo = {
            enabled: false,
            positionX: 0,
        }
        this.model=null
        this.renderer=null
        this.scene=null
        this.camera=null
        this.state={
            scale:1
        }
    }
    onPointerMove = (e) => {
        if (!this.dragInfo.enabled) return false
        const getRotation=()=> {
            let x = e.clientX - this.dragInfo.positionX
            return -THREE.MathUtils.degToRad(360 * (x / window.innerWidth))
        }
        if (this.model) {
            this.model.rotation.y += getRotation()
        }
        this.dragInfo.positionX = e.clientX
    }
    onPointerDown = (e) => {
        this.dragInfo.positionX = e.clientX
        this.dragInfo.enabled = true
    }
    onPointerCancel = () => {
        this.dragInfo.enabled = false
    }
    handleScaleChange=(e)=>{
        let scaleValue = e.target.value
        this.model.scale.set(scaleValue, scaleValue, scaleValue)
        this.setState({ ...this.state, scale: scaleValue })
    }
    handleResize=()=>{
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    handleImageDownload=()=>{
        const url =this.canvas.current?.toDataURL('image/jpeg', 0.8);
        ZapparSharing({
            data: url,
        });
    }
    init=()=>{
        let tracker, hasPlaced, mixer, loadingManager
        const clock = new THREE.Clock();
        const main = () => {
            this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas.current, preserveDrawingBuffer: true });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            ZapparThree.glContextSet(this.renderer.getContext());
            ZapparThree.permissionRequestUI().then((granted) => {
                if (granted) this.camera.start();
                else ZapparThree.permissionDeniedUI();
            });
        }
        const handleResize = () => {
            window.addEventListener("resize", this.handleResize);
        }
        const createCamera = () => {
            this.camera = new ZapparThree.Camera();
        }
        const setupScene = () => {
            this.scene = new THREE.Scene();
            this.scene.background = this.camera.backgroundTexture;
            tracker = new ZapparThree.InstantWorldTracker();
            const trackerGroup = new ZapparThree.InstantWorldAnchorGroup(this.camera, tracker);
            this.scene.add(trackerGroup);
            new GLTFLoader(loadingManager).load("./fishes.glb", (gltf) => {
                mixer = new THREE.AnimationMixer(gltf.scene);
                mixer.clipAction(gltf.animations[0]).play();
                this.model = gltf.scene
                this.model.scale.set(this.state.scale, this.state.scale, this.state.scale)
                trackerGroup.add(gltf.scene)
            })
        }
        const handleUI = () => {
            hasPlaced = false;
            const placementUI = document.getElementById("zappar-placement-ui") || document.createElement("div");
            placementUI.addEventListener("click", () => {
                placementUI.remove();
                hasPlaced = true;
            })
        }
        const render = () => {
            const delta = clock.getDelta();
            mixer?.update(delta);
            this.camera.updateFrame(this.renderer);

            if (!hasPlaced) tracker.setAnchorPoseFromCameraOffset(0, 0, -5);

            this.renderer.render(this.scene, this.camera);
        }
        const animation = () => {
            this.renderer.setAnimationLoop(render);
        }
        const setupLoadingManager = () => {
            loadingManager = new THREE.LoadingManager(() => {
                this.experienceUI.current.style.display = "none"
            })
        }
        const handleRotation = () => {
            this.canvas.current.addEventListener('pointermove', this.onPointerMove);
            this.canvas.current.addEventListener('pointerdown', this.onPointerDown);
            this.canvas.current.addEventListener('pointerup', this.onPointerCancel);
            this.canvas.current.addEventListener('pointerleave', this.onPointerCancel);
        }
        setupLoadingManager()
        createCamera()
        setupScene()
        main()
        animation()
        handleUI()
        handleResize()
        handleRotation()
    }
    disposeAll=()=>{
        const clearEvents = () => {
            this.canvas.current.removeEventListener('pointermove', this.onPointerMove);
            this.canvas.current.removeEventListener('pointerdown', this.onPointerDown);
            this.canvas.current.removeEventListener('pointerup', this.onPointerCancel);
            this.canvas.current.removeEventListener('pointerleave', this.onPointerCancel);
            window.removeEventListener("resize", this.handleResize);
        }
        const disposeScene = () => {
            const disposeMaterial = (material) => {
                material.dispose()
                // dispose textures
                for (let key of Object.keys(material)) {
                    let value = material[key]
                    if (value && typeof value === 'object' && 'minFilter' in value) {
                        value.dispose()
                    } else {
                    }
                }
            }
            this.scene.children.forEach((item) => {
                item.traverse((child) => {
                    if (child.isMesh) {
                        child.geometry.dispose()
                        disposeMaterial(child.material)
                    }
                })
                this.scene.remove(item);
            })
        }
        disposeScene()
        clearEvents()
    }
    componentDidMount() {
        this.init()
    }
    componentWillUnmount(){
        this.disposeAll()
    }
    render() {
        return (
            <>
                <div id="loading-ui" ref={this.experienceUI}>
                    <div className="wrapper">
                        <div className="lds-ripple"><div></div><div></div></div>
                        <div className="text">Loading experience</div>
                    </div>
                </div>
                <div id="manager">
                    <input type="range" min="1" max="100" value={this.state.scale} onChange={this.handleScaleChange}  className="slider" />
                    <button onClick={this.handleImageDownload}>
                        <img src="./camera.svg" alt="camera" />
                    </button>
                </div>
                <div id="zappar-placement-ui">Tap here to place the object</div>
                <canvas ref={this.canvas}></canvas>
            </>
        )
    }
}
