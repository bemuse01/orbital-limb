/**
 * Shared GLSL snippet for viewport boundary attenuation & 3D horizon depth masking.
 * Ensures the oversized off-center globe smoothly dissolves before touching any screen border.
 */
const COMMON_MASK_GLSL = `
float computeViewportFade(vec2 screenUv) {
    // Smooth rectangular edge margins (Left, Right, Top, Bottom)
    float fadeLeft   = smoothstep(0.18, 0.50, screenUv.x);
    float fadeRight  = smoothstep(0.99, 0.79, screenUv.x);
    float fadeTop    = smoothstep(0.98, 0.76, screenUv.y);
    float fadeBottom = smoothstep(0.02, 0.24, screenUv.y);
    float edgeMask   = fadeLeft * fadeRight * fadeTop * fadeBottom;

    // Volumetric elliptical beam falloff focused on the exposed upper-left planetary limb
    vec2 beamDelta = (screenUv - vec2(0.65, 0.48)) / vec2(0.39, 0.45);
    float beamDist = length(beamDelta);
    float beamMask = 1.0 - smoothstep(0.50, 1.04, beamDist);

    return edgeMask * beamMask;
}
`;

export const ATMOSPHERE_LIMB_SHADER = {
    vertex: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;

        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normal);
            vClipPos = projectionMatrix * viewMatrix * worldPos;
            gl_Position = vClipPos;
        }
    `,
    fragment: `
        uniform vec3 uColorRim;
        uniform vec3 uColorAccent;
        uniform vec3 uSunDir;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.002) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndv = dot(vWorldNormal, viewDir);

            // Razor-thin Fresnel rim along the planetary curvature
            float rim = pow(1.0 - clamp(ndv, 0.0, 1.0), 4.2);
            float innerHaze = pow(1.0 - clamp(ndv, 0.0, 1.0), 1.8) * 0.12;

            // Subtle solar terminator tint on the limb
            float sunDot = dot(vWorldNormal, normalize(uSunDir));
            float terminatorBand = exp(-pow(sunDot * 7.0, 2.0));

            vec3 col = mix(uColorRim, uColorAccent, terminatorBand * 0.45);
            float alpha = (rim * 0.55 + innerHaze) * vpFade;

            gl_FragColor = vec4(col, alpha);
        }
    `
};

export const GRATICULE_SHADER = {
    vertex: `
        attribute float aArcDist;
        attribute float aIsMajor;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;
        varying float vArcDist;
        varying float vIsMajor;

        void main() {
            vArcDist = aArcDist;
            vIsMajor = aIsMajor;

            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));
            vClipPos = projectionMatrix * viewMatrix * worldPos;
            gl_Position = vClipPos;
        }
    `,
    fragment: `
        uniform vec3 uColor;
        uniform vec3 uColorAccent;
        uniform float uTime;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;
        varying float vArcDist;
        varying float vIsMajor;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.002) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndv = dot(vWorldNormal, viewDir);

            // Front hemisphere is crisp; back hemisphere is ghosted at 8% for 3D hologram depth
            float hemiAlpha = ndv >= 0.0
                ? mix(0.32, 0.16, ndv)
                : 0.045;

            // Fine procedural dashing for minor graticule lines, solid for Equator/Prime Meridian
            float dashPattern = sin(vArcDist * 180.0);
            if (vIsMajor < 0.5 && dashPattern < -0.25) discard;

            vec3 col = vIsMajor > 0.5 ? mix(uColor, uColorAccent, 0.35) : uColor;
            float majorBoost = vIsMajor > 0.5 ? 1.65 : 1.0;

            gl_FragColor = vec4(col, hemiAlpha * majorBoost * vpFade);
        }
    `
};

export const FIDUCIAL_CROSS_SHADER = {
    vertex: `
        uniform float uPixelRatio;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;

        void main() {
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * normalize(position));

            vec4 mvPosition = viewMatrix * worldPos;
            vClipPos = projectionMatrix * mvPosition;
            gl_Position = vClipPos;

            gl_PointSize = clamp((7.5 * uPixelRatio) * (420.0 / -mvPosition.z), 3.0, 9.0);
        }
    `,
    fragment: `
        uniform vec3 uColor;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec4 vClipPos;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.01) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndv = dot(vWorldNormal, viewDir);
            if (ndv < 0.05) discard;

            // Render a sharp 1px industrial '+' fiducial crosshair
            vec2 uv = abs(gl_PointCoord - vec2(0.5));
            bool onArm = (uv.x < 0.09 && uv.y < 0.42) || (uv.y < 0.09 && uv.x < 0.42);
            if (!onArm) discard;

            float alpha = smoothstep(0.05, 0.35, ndv) * 0.42 * vpFade;
            gl_FragColor = vec4(uColor, alpha);
        }
    `
};

export const COASTLINE_SHADER = {
    vertex: `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec4 vClipPos;

        void main() {
            vLocalPos = normalize(position);
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * vLocalPos);
            vClipPos = projectionMatrix * viewMatrix * worldPos;
            gl_Position = vClipPos;
        }
    `,
    fragment: `
        uniform vec3 uColorDay;
        uniform vec3 uColorNight;
        uniform vec3 uColorAccent;
        uniform vec3 uSunDir;
        uniform float uTime;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec4 vClipPos;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.002) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndv = dot(vWorldNormal, viewDir);

            // Front vs Back hemisphere visibility
            float hemiFactor = ndv >= 0.0
                ? smoothstep(0.0, 0.18, ndv)
                : 0.06;

            // Rim glow boost near the curved horizon
            float rimBoost = ndv > 0.0 ? pow(1.0 - clamp(ndv, 0.0, 1.0), 2.2) * 0.55 : 0.0;

            // Real-time solar day/night modulation in local Earth frame
            float sunDot = dot(vLocalPos, normalize(uSunDir));
            float dayFactor = smoothstep(-0.12, 0.18, sunDot);
            float terminatorLine = exp(-pow(sunDot * 10.0, 2.0));

            // Periodic latitudinal telemetry scan pulse
            float scanLat = cos(uTime * 0.38);
            float scanPulse = exp(-pow((vLocalPos.y - scanLat) * 14.0, 2.0));

            vec3 baseCol = mix(uColorNight, uColorDay, dayFactor);
            vec3 finalCol = mix(baseCol, uColorAccent, clamp(terminatorLine * 0.75 + scanPulse * 0.55, 0.0, 1.0));

            float alpha = (mix(0.38, 0.78, dayFactor) + rimBoost + scanPulse * 0.35) * hemiFactor * vpFade;
            gl_FragColor = vec4(finalCol, clamp(alpha, 0.0, 1.0));
        }
    `
};

export const LAND_POINTS_SHADER = {
    vertex: `
        attribute float aTier;
        attribute float aSeed;

        uniform float uTime;
        uniform float uPixelRatio;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec4 vClipPos;
        varying float vTier;
        varying float vSeed;
        varying float vScanPulse;

        void main() {
            vTier = aTier;
            vSeed = aSeed;
            vLocalPos = normalize(position);

            // Subtle holographic elevation pulse along the scanning latitude
            float scanLat = cos(uTime * 0.38);
            float scanPulse = exp(-pow((vLocalPos.y - scanLat) * 14.0, 2.0));
            vScanPulse = scanPulse;

            vec3 displaced = position * (1.0 + scanPulse * 0.0045 + aTier * 0.002);

            vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
            vWorldPos = worldPos.xyz;
            vWorldNormal = normalize(mat3(modelMatrix) * vLocalPos);

            vec4 mvPosition = viewMatrix * worldPos;
            vClipPos = projectionMatrix * mvPosition;
            gl_Position = vClipPos;

            float baseSize = aTier > 0.75 ? 4.8 : (aTier > 0.35 ? 2.65 : 2.05);
            float pulseScale = 1.0 + scanPulse * 0.45;
            gl_PointSize = clamp((baseSize * pulseScale * uPixelRatio) * (410.0 / -mvPosition.z), 1.1, 11.0);
        }
    `,
    fragment: `
        uniform vec3 uColorDay;
        uniform vec3 uColorNight;
        uniform vec3 uColorAccent;
        uniform vec3 uSunDir;
        uniform float uTime;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        varying vec3 vLocalPos;
        varying vec4 vClipPos;
        varying float vTier;
        varying float vSeed;
        varying float vScanPulse;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.003) discard;

            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            float ndv = dot(vWorldNormal, viewDir);

            // Cull most back-facing landmass dots except a faint ghost silhouette
            if (ndv < -0.05 && fract(vSeed * 13.7) > 0.18) discard;
            float hemiAlpha = ndv >= 0.0
                ? smoothstep(-0.02, 0.16, ndv)
                : 0.07;

            vec2 pCoord = gl_PointCoord - vec2(0.5);
            float dist = length(pCoord);

            float shapeAlpha = 0.0;
            if (vTier > 0.75) {
                // Strategic urban node: crisp hollow/core reticle diamond
                float manhattan = abs(pCoord.x) + abs(pCoord.y);
                float core = 1.0 - smoothstep(0.12, 0.24, dist);
                float ring = smoothstep(0.32, 0.38, manhattan) * (1.0 - smoothstep(0.42, 0.50, manhattan));
                shapeAlpha = max(core, ring * 0.9);
            } else {
                // Crisp circular dot-matrix particle
                shapeAlpha = 1.0 - smoothstep(0.28, 0.50, dist);
            }
            if (shapeAlpha < 0.02) discard;

            // Real-time Solar Terminator calculation
            float sunDot = dot(vLocalPos, normalize(uSunDir));
            float dayFactor = smoothstep(-0.14, 0.18, sunDot);
            float terminatorBand = exp(-pow(sunDot * 9.5, 2.0));

            // Industrial Monochrome on day side; dark graphite + orange beacons on night side
            vec3 col = mix(uColorNight, uColorDay, dayFactor);
            float alpha = mix(0.26, 0.86, dayFactor);

            // Strategic urban hubs & terminator line glow in Industrial International Orange
            if (vTier > 0.75) {
                float blink = 0.75 + 0.25 * sin(uTime * 3.2 + vSeed * 25.0);
                col = mix(uColorAccent, vec3(1.0, 0.92, 0.86), 0.25);
                alpha = 0.95 * blink;
            } else if (vTier > 0.35 && dayFactor < 0.4) {
                // Coastal night-side nodes catch a subtle warm amber/monochrome edge
                col = mix(col, uColorAccent, 0.45);
                alpha = max(alpha, 0.52);
            }

            // Apply terminator & scan wave highlight
            float accentMix = clamp(terminatorBand * 0.7 + vScanPulse * 0.65, 0.0, 1.0);
            col = mix(col, uColorAccent, accentMix * 0.75);
            alpha = clamp(alpha + vScanPulse * 0.35 + terminatorBand * 0.25, 0.0, 1.0);

            gl_FragColor = vec4(col, alpha * shapeAlpha * hemiAlpha * vpFade);
        }
    `
};

export const ORBITAL_RING_SHADER = {
    vertex: `
        attribute float aAngle;
        attribute float aRole; // 0 = base orbit track, 1 = tick mark, 2 = active telemetry pulse arc

        uniform float uTime;

        varying vec3 vWorldPos;
        varying vec4 vClipPos;
        varying float vAngle;
        varying float vRole;

        void main() {
            vAngle = aAngle;
            vRole = aRole;

            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vClipPos = projectionMatrix * viewMatrix * worldPos;
            gl_Position = vClipPos;
        }
    `,
    fragment: `
        uniform vec3 uColorBase;
        uniform vec3 uColorAccent;
        uniform float uTime;
        uniform float uGlobeRadius;
        uniform vec3 uGlobeCenter;

        varying vec3 vWorldPos;
        varying vec4 vClipPos;
        varying float vAngle;
        varying float vRole;

        ${COMMON_MASK_GLSL}

        void main() {
            vec2 screenUv = (vClipPos.xy / vClipPos.w) * 0.5 + 0.5;
            float vpFade = computeViewportFade(screenUv);
            if (vpFade < 0.002) discard;

            // Determine if orbital ring segment is in front of or behind the globe sphere
            vec3 relPos = vWorldPos - uGlobeCenter;
            vec3 toCam = normalize(cameraPosition - uGlobeCenter);
            float depthDot = dot(normalize(relPos), toCam);
            float occFactor = depthDot >= -0.05 ? 1.0 : 0.14;

            vec3 col = uColorBase;
            float alpha = 0.28;

            if (vRole > 1.5) {
                // Active orbital telemetry packet stream (Industrial Orange)
                float headAngle = mod(uTime * 0.32, 6.2831853);
                float angularDiff = mod(headAngle - vAngle + 6.2831853, 6.2831853);
                float trail = smoothstep(1.6, 0.0, angularDiff);
                col = mix(uColorBase, uColorAccent, smoothstep(0.2, 0.85, trail));
                alpha = mix(0.12, 0.92, trail);
            } else if (vRole > 0.5) {
                // Degree tick marks along astrometric rings
                col = uColorBase;
                alpha = 0.44;
            }

            gl_FragColor = vec4(col, alpha * occFactor * vpFade);
        }
    `
};
