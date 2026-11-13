import * as THREE from '../lib/three.module.min.js';
import { feature } from '../lib/topojson-client.esm.js';
import { latLonToVec3, getSunDirectionLocal } from '../core/solarMath.js';
import {
    ATMOSPHERE_LIMB_SHADER,
    GRATICULE_SHADER,
    FIDUCIAL_CROSS_SHADER,
    COASTLINE_SHADER,
    LAND_POINTS_SHADER,
    ORBITAL_RING_SHADER
} from '../shader/globeShaders.js';

const DEG2RAD = Math.PI / 180;

// Major global metropolitan & orbital telemetry tracking hubs
const STRATEGIC_HUBS = [
    { name: 'SEOUL', lat: 37.5665, lon: 126.9780 },
    { name: 'TOKYO', lat: 35.6762, lon: 139.6503 },
    { name: 'BUSAN', lat: 35.1796, lon: 129.0756 },
    { name: 'SHANGHAI', lat: 31.2304, lon: 121.4737 },
    { name: 'HONG KONG', lat: 22.3193, lon: 114.1694 },
    { name: 'SINGAPORE', lat: 1.3521, lon: 103.8198 },
    { name: 'TAIPEI', lat: 25.0330, lon: 121.5654 },
    { name: 'SYDNEY', lat: -33.8688, lon: 151.2093 },
    { name: 'MUMBAI', lat: 19.0760, lon: 72.8777 },
    { name: 'DUBAI', lat: 25.2048, lon: 55.2708 },
    { name: 'LONDON', lat: 51.5074, lon: -0.1278 },
    { name: 'PARIS', lat: 48.8566, lon: 2.3522 },
    { name: 'FRANKFURT', lat: 50.1109, lon: 8.6821 },
    { name: 'STOCKHOLM', lat: 59.3293, lon: 18.0686 },
    { name: 'NEW YORK', lat: 40.7128, lon: -74.0060 },
    { name: 'SAN FRANCISCO', lat: 37.7749, lon: -122.4194 },
    { name: 'LOS ANGELES', lat: 34.0522, lon: -118.2437 },
    { name: 'CHICAGO', lat: 41.8781, lon: -87.6298 },
    { name: 'HOUSTON', lat: 29.7604, lon: -95.3698 },
    { name: 'TORONTO', lat: 43.6532, lon: -79.3832 },
    { name: 'SAO PAULO', lat: -23.5505, lon: -46.6333 },
    { name: 'BUENOS AIRES', lat: -34.6037, lon: -58.3816 },
    { name: 'CAIRO', lat: 30.0444, lon: 31.2357 },
    { name: 'JOHANNESBURG', lat: -26.2041, lon: 28.0473 },
    { name: 'HONOLULU', lat: 21.3069, lon: -157.8583 },
    { name: 'ANCHORAGE', lat: 61.2181, lon: -149.9003 }
];

export class HologramGlobe {
    constructor(scene, pixelRatio = 1) {
        this.scene = scene;
        this.pixelRatio = pixelRatio;

        // Industrial Monochrome + International Orange Palette (Ash Thorp / Territory Studio inspired)
        this.palette = {
            dayWhite: new THREE.Color('#e6ecf2'),
            nightSteel: new THREE.Color('#3e4652'),
            gridGrey: new THREE.Color('#6c7787'),
            fiducialGrey: new THREE.Color('#8c98a8'),
            rimSilver: new THREE.Color('#cfd8e3'),
            accentOrange: new THREE.Color('#ff3e14')
        };

        // Overscaled radius & off-center placement for Composition A (Planetary Limb Framing)
        this.radius = 238;
        this.anchorGroup = new THREE.Group();
        this.axialTiltGroup = new THREE.Group();
        this.spinGroup = new THREE.Group();
        this.orbitalGroup = new THREE.Group();

        // Start centered around East Asia (Korea/Japan visible in the primary limb window)
        this.spinGroup.rotation.y = -128 * DEG2RAD;

        // Earth axial tilt + cinematic pitch so Northern & Equatorial latitudes sweep across the upper-left limb
        this.axialTiltGroup.rotation.z = -21.5 * DEG2RAD;
        this.axialTiltGroup.rotation.x = 19.5 * DEG2RAD;

        this.axialTiltGroup.add(this.spinGroup);
        this.axialTiltGroup.add(this.orbitalGroup);
        this.anchorGroup.add(this.axialTiltGroup);
        this.scene.add(this.anchorGroup);

        this.uniformMaterials = [];
        this.orbitRings = [];
        this.sunDir = getSunDirectionLocal(new Date());
        this.lastSolarUpdate = 0;
    }

    async init() {
        this.buildAtmosphereShell();
        this.buildGraticuleAndCrosses();
        this.buildOrbitalRings();

        const response = await fetch('./assets/data/land-50m.json');
        const topology = await response.json();
        const landGeoJson = feature(topology, topology.objects.land);

        this.buildCoastlines(landGeoJson);
        this.buildLandPointCloud(landGeoJson);
    }

    /**
     * Positions the oversized globe toward the right / lower-right of the viewport (Composition A)
     */
    updateLayout(viewportWidth, viewportHeight, camera) {
        const dist = camera.position.z;
        const vFov = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * Math.tan(vFov / 2) * dist;
        const visibleWidth = visibleHeight * (viewportWidth / viewportHeight);

        // Shift globe center to the right and slightly down so the upper-left planetary limb dominates the stage
        const offsetX = visibleWidth * 0.22;
        const offsetY = -visibleHeight * 0.16;

        this.anchorGroup.position.set(offsetX, offsetY, 0);

        for (const mat of this.uniformMaterials) {
            if (mat.uniforms.uGlobeCenter) {
                mat.uniforms.uGlobeCenter.value.copy(this.anchorGroup.position);
            }
        }
    }

    buildAtmosphereShell() {
        const geometry = new THREE.SphereGeometry(this.radius * 1.005, 72, 72);
        const material = new THREE.ShaderMaterial({
            vertexShader: ATMOSPHERE_LIMB_SHADER.vertex,
            fragmentShader: ATMOSPHERE_LIMB_SHADER.fragment,
            uniforms: {
                uColorRim: { value: this.palette.rimSilver },
                uColorAccent: { value: this.palette.accentOrange },
                uSunDir: { value: this.sunDir.clone() }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.uniformMaterials.push(material);
        const shellMesh = new THREE.Mesh(geometry, material);
        this.spinGroup.add(shellMesh);
    }

    buildGraticuleAndCrosses() {
        const positions = [];
        const arcDists = [];
        const isMajorArr = [];
        const r = this.radius * 1.0005;
        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();

        const addParallel = (latDeg, isMajor = 0.0) => {
            const segments = 180;
            let accumDist = 0;
            for (let i = 0; i < segments; i++) {
                const lon1 = -180 + (i / segments) * 360;
                const lon2 = -180 + ((i + 1) / segments) * 360;
                latLonToVec3(latDeg, lon1, r, vA);
                latLonToVec3(latDeg, lon2, r, vB);

                const segLen = vA.distanceTo(vB) / r;
                positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
                arcDists.push(accumDist, accumDist + segLen);
                isMajorArr.push(isMajor, isMajor);
                accumDist += segLen;
            }
        };

        // Standard 10° parallels + Equator & Tropics
        for (let lat = -80; lat <= 80; lat += 10) {
            addParallel(lat, lat === 0 ? 1.0 : 0.0);
        }
        addParallel(23.44, 1.0);
        addParallel(-23.44, 1.0);

        // Standard 10° meridians
        for (let lon = -180; lon < 180; lon += 10) {
            const isMajor = (lon === 0 || lon === -180 || lon === 120 || lon === -60) ? 1.0 : 0.0;
            const segments = 96;
            let accumDist = 0;
            for (let i = 0; i < segments; i++) {
                const lat1 = -80 + (i / segments) * 160;
                const lat2 = -80 + ((i + 1) / segments) * 160;
                latLonToVec3(lat1, lon, r, vA);
                latLonToVec3(lat2, lon, r, vB);

                const segLen = vA.distanceTo(vB) / r;
                positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
                arcDists.push(accumDist, accumDist + segLen);
                isMajorArr.push(isMajor, isMajor);
                accumDist += segLen;
            }
        }

        const graticuleGeo = new THREE.BufferGeometry();
        graticuleGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        graticuleGeo.setAttribute('aArcDist', new THREE.Float32BufferAttribute(arcDists, 1));
        graticuleGeo.setAttribute('aIsMajor', new THREE.Float32BufferAttribute(isMajorArr, 1));

        const graticuleMat = new THREE.ShaderMaterial({
            vertexShader: GRATICULE_SHADER.vertex,
            fragmentShader: GRATICULE_SHADER.fragment,
            uniforms: {
                uColor: { value: this.palette.gridGrey },
                uColorAccent: { value: this.palette.accentOrange },
                uTime: { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.uniformMaterials.push(graticuleMat);
        this.spinGroup.add(new THREE.LineSegments(graticuleGeo, graticuleMat));

        // Fiducial '+' micro-crosses at every 10° intersection
        const crossPositions = [];
        const rCross = this.radius * 1.0015;
        for (let lat = -70; lat <= 70; lat += 10) {
            for (let lon = -180; lon < 180; lon += 10) {
                latLonToVec3(lat, lon, rCross, vA);
                crossPositions.push(vA.x, vA.y, vA.z);
            }
        }

        const crossGeo = new THREE.BufferGeometry();
        crossGeo.setAttribute('position', new THREE.Float32BufferAttribute(crossPositions, 3));
        const crossMat = new THREE.ShaderMaterial({
            vertexShader: FIDUCIAL_CROSS_SHADER.vertex,
            fragmentShader: FIDUCIAL_CROSS_SHADER.fragment,
            uniforms: {
                uColor: { value: this.palette.fiducialGrey },
                uPixelRatio: { value: this.pixelRatio }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.uniformMaterials.push(crossMat);
        this.spinGroup.add(new THREE.Points(crossGeo, crossMat));
    }

    buildCoastlines(landGeoJson) {
        const positions = [];
        const r = this.radius * 1.0025;
        const vA = new THREE.Vector3();
        const vB = new THREE.Vector3();

        const processRing = (ring) => {
            for (let i = 0; i < ring.length - 1; i++) {
                const [lon1, lat1] = ring[i];
                const [lon2, lat2] = ring[i + 1];
                // Skip antimeridian wrap jumps
                if (Math.abs(lon2 - lon1) > 90) continue;

                latLonToVec3(lat1, lon1, r, vA);
                latLonToVec3(lat2, lon2, r, vB);
                positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
            }
        };

        const extractGeometry = (geom) => {
            if (!geom) return;
            if (geom.type === 'Polygon') {
                geom.coordinates.forEach(processRing);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach((poly) => poly.forEach(processRing));
            } else if (geom.type === 'GeometryCollection') {
                geom.geometries.forEach(extractGeometry);
            }
        };

        if (landGeoJson.type === 'FeatureCollection') {
            landGeoJson.features.forEach((f) => extractGeometry(f.geometry));
        } else if (landGeoJson.type === 'Feature') {
            extractGeometry(landGeoJson.geometry);
        } else {
            extractGeometry(landGeoJson);
        }

        const coastGeo = new THREE.BufferGeometry();
        coastGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

        const coastMat = new THREE.ShaderMaterial({
            vertexShader: COASTLINE_SHADER.vertex,
            fragmentShader: COASTLINE_SHADER.fragment,
            uniforms: {
                uColorDay: { value: this.palette.dayWhite },
                uColorNight: { value: this.palette.nightSteel },
                uColorAccent: { value: this.palette.accentOrange },
                uSunDir: { value: this.sunDir.clone() },
                uTime: { value: 0 }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.uniformMaterials.push(coastMat);
        this.spinGroup.add(new THREE.LineSegments(coastGeo, coastMat));
    }

    buildLandPointCloud(landGeoJson) {
        // Offscreen equirectangular rasterization for fast, uniform latitude-compensated sampling
        const width = 2048;
        const height = 1024;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);

        // Red channel = land interior, Green channel = coastal border highlight
        ctx.fillStyle = '#ff0000';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2.6;

        const lonToX = (lon) => ((lon + 180) / 360) * width;
        const latToY = (lat) => ((90 - lat) / 180) * height;

        const drawRing = (ring) => {
            if (ring.length < 3) return;
            ctx.beginPath();
            for (let i = 0; i < ring.length; i++) {
                const [lon, lat] = ring[i];
                const x = lonToX(lon);
                const y = latToY(lat);
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    const [prevLon] = ring[i - 1];
                    if (Math.abs(lon - prevLon) > 90) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        };

        const renderGeom = (geom) => {
            if (!geom) return;
            if (geom.type === 'Polygon') {
                geom.coordinates.forEach(drawRing);
            } else if (geom.type === 'MultiPolygon') {
                geom.coordinates.forEach((poly) => poly.forEach(drawRing));
            }
        };

        if (landGeoJson.type === 'FeatureCollection') {
            landGeoJson.features.forEach((f) => renderGeom(f.geometry));
        } else if (landGeoJson.type === 'Feature') {
            renderGeom(landGeoJson.geometry);
        } else {
            renderGeom(landGeoJson);
        }

        const imgData = ctx.getImageData(0, 0, width, height).data;
        const positions = [];
        const tiers = [];
        const seeds = [];
        const r = this.radius * 1.003;
        const vTemp = new THREE.Vector3();

        // Latitude-compensated hexagonal dot matrix so spacing is uniform from Equator to Poles
        const baseStepDeg = 0.66;
        let rowIdx = 0;

        for (let lat = -80; lat <= 83; lat += baseStepDeg) {
            const cosLat = Math.max(0.14, Math.cos(lat * DEG2RAD));
            const lonStep = baseStepDeg / cosLat;
            const stagger = (rowIdx % 2) * (lonStep * 0.5);
            rowIdx++;

            const py = Math.min(height - 1, Math.max(0, Math.floor(latToY(lat))));

            for (let lon = -180 + stagger; lon < 180; lon += lonStep) {
                const px = Math.min(width - 1, Math.max(0, Math.floor(lonToX(lon))));
                const idx = (py * width + px) * 4;
                const isLand = imgData[idx] > 90;
                const isCoast = imgData[idx + 1] > 90;

                if (isLand || isCoast) {
                    latLonToVec3(lat, lon, r, vTemp);
                    positions.push(vTemp.x, vTemp.y, vTemp.z);
                    tiers.push(isCoast ? 0.5 : 0.0);
                    seeds.push(Math.abs(Math.sin(lat * 12.9898 + lon * 78.233)));
                }
            }
        }

        // Inject high-priority strategic metropolitan nodes (Tier = 1.0 -> Orange Reticle Beacons)
        const rHub = this.radius * 1.006;
        STRATEGIC_HUBS.forEach((hub, idx) => {
            latLonToVec3(hub.lat, hub.lon, rHub, vTemp);
            positions.push(vTemp.x, vTemp.y, vTemp.z);
            tiers.push(1.0);
            seeds.push((idx + 1) * 0.173);
        });

        const pointsGeo = new THREE.BufferGeometry();
        pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        pointsGeo.setAttribute('aTier', new THREE.Float32BufferAttribute(tiers, 1));
        pointsGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));

        const pointsMat = new THREE.ShaderMaterial({
            vertexShader: LAND_POINTS_SHADER.vertex,
            fragmentShader: LAND_POINTS_SHADER.fragment,
            uniforms: {
                uColorDay: { value: this.palette.dayWhite },
                uColorNight: { value: this.palette.nightSteel },
                uColorAccent: { value: this.palette.accentOrange },
                uSunDir: { value: this.sunDir.clone() },
                uTime: { value: 0 },
                uPixelRatio: { value: this.pixelRatio }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.uniformMaterials.push(pointsMat);
        this.spinGroup.add(new THREE.Points(pointsGeo, pointsMat));
    }

    buildOrbitalRings() {
        const ringConfigs = [
            {
                // Equatorial astrometric scale ring with dense degree ticks
                radius: this.radius * 1.075,
                tiltX: 0,
                tiltZ: 0,
                speed: -0.025,
                tickCount: 180,
                tickLength: 3.2,
                hasTelemetryArc: false
            },
            {
                // ISS-like 51.6° inclined active telemetry orbit
                radius: this.radius * 1.135,
                tiltX: 34 * DEG2RAD,
                tiltZ: 28 * DEG2RAD,
                speed: 0.045,
                tickCount: 72,
                tickLength: 4.5,
                hasTelemetryArc: true
            },
            {
                // High-inclination polar reconnaissance orbit
                radius: this.radius * 1.195,
                tiltX: -62 * DEG2RAD,
                tiltZ: 18 * DEG2RAD,
                speed: -0.032,
                tickCount: 90,
                tickLength: 3.8,
                hasTelemetryArc: true
            }
        ];

        const orbitalMat = new THREE.ShaderMaterial({
            vertexShader: ORBITAL_RING_SHADER.vertex,
            fragmentShader: ORBITAL_RING_SHADER.fragment,
            uniforms: {
                uColorBase: { value: this.palette.fiducialGrey },
                uColorAccent: { value: this.palette.accentOrange },
                uTime: { value: 0 },
                uGlobeRadius: { value: this.radius },
                uGlobeCenter: { value: this.anchorGroup.position.clone() }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        this.uniformMaterials.push(orbitalMat);

        ringConfigs.forEach((cfg) => {
            const positions = [];
            const angles = [];
            const roles = [];
            const segs = 240;
            const r = cfg.radius;

            // Main orbital track circle
            for (let i = 0; i < segs; i++) {
                const a1 = (i / segs) * Math.PI * 2;
                const a2 = ((i + 1) / segs) * Math.PI * 2;
                positions.push(
                    Math.cos(a1) * r, 0, Math.sin(a1) * r,
                    Math.cos(a2) * r, 0, Math.sin(a2) * r
                );
                angles.push(a1, a2);
                const role = cfg.hasTelemetryArc ? 2.0 : 0.0;
                roles.push(role, role);
            }

            // Precision degree tick marks along the orbital plane
            for (let i = 0; i < cfg.tickCount; i++) {
                const a = (i / cfg.tickCount) * Math.PI * 2;
                const isMajorTick = i % 6 === 0;
                const len = isMajorTick ? cfg.tickLength * 1.85 : cfg.tickLength;
                const rIn = r - len * 0.5;
                const rOut = r + len * 0.5;

                positions.push(
                    Math.cos(a) * rIn, 0, Math.sin(a) * rIn,
                    Math.cos(a) * rOut, 0, Math.sin(a) * rOut
                );
                angles.push(a, a);
                roles.push(1.0, 1.0);
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            geo.setAttribute('aAngle', new THREE.Float32BufferAttribute(angles, 1));
            geo.setAttribute('aRole', new THREE.Float32BufferAttribute(roles, 1));

            const ringMesh = new THREE.LineSegments(geo, orbitalMat);
            ringMesh.rotation.x = cfg.tiltX;
            ringMesh.rotation.z = cfg.tiltZ;

            this.orbitalGroup.add(ringMesh);
            this.orbitRings.push({ mesh: ringMesh, speed: cfg.speed });
        });
    }

    setPixelRatio(ratio) {
        this.pixelRatio = ratio;
        for (const mat of this.uniformMaterials) {
            if (mat.uniforms.uPixelRatio) {
                mat.uniforms.uPixelRatio.value = ratio;
            }
        }
    }

    update(elapsedSeconds, deltaSeconds) {
        // Slow, majestic planetary rotation
        this.spinGroup.rotation.y += deltaSeconds * 0.038;

        // Counter-rotating astrometric rings
        for (const item of this.orbitRings) {
            item.mesh.rotation.y += deltaSeconds * item.speed;
        }

        // Refresh real-time solar vector once every 30 seconds
        if (elapsedSeconds - this.lastSolarUpdate > 30) {
            this.lastSolarUpdate = elapsedSeconds;
            getSunDirectionLocal(new Date(), this.sunDir);
            for (const mat of this.uniformMaterials) {
                if (mat.uniforms.uSunDir) {
                    mat.uniforms.uSunDir.value.copy(this.sunDir);
                }
            }
        }

        for (const mat of this.uniformMaterials) {
            if (mat.uniforms.uTime) {
                mat.uniforms.uTime.value = elapsedSeconds;
            }
        }
    }
}
