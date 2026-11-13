import * as THREE from './lib/three.module.min.js';
import { HologramGlobe } from './globe/hologramGlobe.js';

class OrbitalLimbStage {
    constructor() {
        this.canvas = document.getElementById('globe-canvas');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

        // Wallpaper-friendly frame limiter (45 FPS cap to keep GPU cool and idle-friendly)
        this.targetFps = 45;
        this.frameInterval = 1000 / this.targetFps;
        this.lastFrameTime = 0;
        this.startTime = performance.now();

        this.initStage();
    }

    async initStage() {
        this.scene = new THREE.Scene();

        this.camera = new THREE.PerspectiveCamera(38, this.width / this.height, 1, 2000);
        this.camera.position.set(0, 0, 420);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true,
            powerPreference: 'low-power'
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.setClearColor(0x000000, 0);

        this.globe = new HologramGlobe(this.scene, this.pixelRatio);
        await this.globe.init();
        this.globe.updateLayout(this.width, this.height, this.camera);

        window.addEventListener('resize', () => this.onResize(), { passive: true });

        requestAnimationFrame((now) => this.animate(now));
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(this.pixelRatio);

        if (this.globe) {
            this.globe.setPixelRatio(this.pixelRatio);
            this.globe.updateLayout(this.width, this.height, this.camera);
        }
    }

    animate(now) {
        requestAnimationFrame((t) => this.animate(t));

        if (document.hidden) return;

        const deltaMs = now - this.lastFrameTime;
        if (deltaMs < this.frameInterval) return;

        const deltaSeconds = Math.min(deltaMs / 1000, 0.1);
        this.lastFrameTime = now - (deltaMs % this.frameInterval);
        const elapsedSeconds = (now - this.startTime) / 1000;

        if (this.globe) {
            this.globe.update(elapsedSeconds, deltaSeconds);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new OrbitalLimbStage();
});
