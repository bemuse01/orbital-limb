import * as THREE from '../lib/three.module.min.js';

const DEG2RAD = Math.PI / 180;

/**
 * Converts latitude (deg), longitude (deg), and radius into 3D Cartesian coordinates.
 * Standard right-handed globe convention:
 * +Y = North Pole, +Z = Prime Meridian (0° lon), +X = 90°E
 */
export function latLonToVec3(latDeg, lonDeg, radius = 1, target = new THREE.Vector3()) {
    const phi = (90 - latDeg) * DEG2RAD;
    const theta = lonDeg * DEG2RAD;

    const sinPhi = Math.sin(phi);
    target.set(
        radius * sinPhi * Math.sin(theta),
        radius * Math.cos(phi),
        radius * sinPhi * Math.cos(theta)
    );
    return target;
}

/**
 * Pure astronomical calculation of the Sun's subsolar point (Declination & Greenwich Hour Angle)
 * from any UTC Date object. No external API required.
 */
export function getSubsolarCoordinates(date = new Date()) {
    // Days since J2000.0 epoch (2000-01-01 12:00:00 UTC)
    const jd = date.getTime() / 86400000 + 2440587.5;
    const n = jd - 2451545.0;

    // Mean longitude & mean anomaly of the Sun (degrees)
    const L = (280.460 + 0.9856474 * n) % 360;
    const g = ((357.528 + 0.9856003 * n) % 360) * DEG2RAD;

    // Ecliptic longitude (degrees)
    const lambda = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG2RAD;

    // Obliquity of the ecliptic (degrees)
    const epsilon = (23.439 - 0.0000004 * n) * DEG2RAD;

    // Solar declination (subsolar latitude in degrees)
    const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda)) / DEG2RAD;

    // Equation of time approximation (minutes)
    const y = Math.pow(Math.tan(epsilon / 2), 2);
    const Lrad = L * DEG2RAD;
    const eqTimeMin = 4 * (
        y * Math.sin(2 * Lrad) -
        2 * 0.01671 * Math.sin(g) +
        4 * 0.01671 * y * Math.sin(g) * Math.cos(2 * Lrad)
    ) / DEG2RAD;

    // Subsolar longitude based on UTC solar time
    const utcHours =
        date.getUTCHours() +
        date.getUTCMinutes() / 60 +
        date.getUTCSeconds() / 3600;

    let subsolarLon = -15 * (utcHours - 12 + eqTimeMin / 60);
    subsolarLon = ((subsolarLon + 540) % 360) - 180;

    return {
        lat: declination,
        lon: subsolarLon
    };
}

/**
 * Returns the 3D unit vector pointing toward the Sun in the Earth's local frame.
 */
export function getSunDirectionLocal(date = new Date(), target = new THREE.Vector3()) {
    const { lat, lon } = getSubsolarCoordinates(date);
    return latLonToVec3(lat, lon, 1.0, target).normalize();
}
