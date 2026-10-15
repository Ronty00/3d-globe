import * as THREE from "three";
import { EARTH_RADIUS } from "./math.js";

const TEX = {
  day: "https://cdn.jsdelivr.net/npm/three-globe@2.41.12/example/img/earth-blue-marble.jpg",
  night: "https://cdn.jsdelivr.net/npm/three-globe@2.41.12/example/img/earth-night.jpg",
  bump: "https://cdn.jsdelivr.net/npm/three-globe@2.41.12/example/img/earth-topology.png",
  water: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_specular_2048.jpg",
  clouds: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/earth_clouds_1024.png",
  moon: "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/moon_1024.jpg",
};

const earthVertex = /* glsl */ `
  uniform sampler2D bumpMap;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    // Topology is 0 on the ocean and about 0.95 on the highest land.
    // The clamp stays under the country borders, which sit 0.007 above the sphere.
    float h = textureLod(bumpMap, uv, 0.0).r;
    float lift = clamp((h - 0.015) * 0.0064, -0.0020, 0.0056);
    vec3 displaced = position + normal * lift;
    vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
    vPosW = worldPos.xyz;
    // Sphere normal, not the slope. The day/night split uses this so night ridges stay dark.
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const earthFragment = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D specularMap;
  uniform sampler2D bumpMap;
  uniform vec3 sunDirection;
  uniform vec3 moonDirection;
  uniform float moonIntensity;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 sunDir = normalize(sunDirection);
    float ndl = dot(n, sunDir);
    vec3 viewDir = normalize(cameraPosition - vPosW);

    // Soft shadow where day meets night. No colored rim.
    float dayFactor = smoothstep(-0.02, 0.12, ndl);

    vec3 dayColor = texture(dayMap, vUv).rgb;
    vec3 nightColor = texture(nightMap, vUv).rgb * 1.35;

    // Per-pixel slope from the height map. The day/night split stays on the sphere normal.
    // Gain stays small on the full disk and rises when the camera is close,
    // so ridges show up close without mottling the sunny side.
    float h = texture(bumpMap, vUv).r;
    float uvSpan = length(dFdx(vUv)) + length(dFdy(vUv));
    float gain = clamp(0.035 + 0.000015 / max(uvSpan, 0.000001), 0.035, 0.85);
    vec3 surfX = dFdx(vPosW) + n * dFdx(h) * gain;
    vec3 surfY = dFdy(vPosW) + n * dFdy(h) * gain;
    vec3 nShade = cross(surfX, surfY);
    float shadeLen = length(nShade);
    nShade = shadeLen > 0.00001 ? nShade / shadeLen : n;
    if (dot(nShade, viewDir) < 0.0) nShade = -nShade;
    float slope = clamp(dot(nShade, sunDir) - ndl, -0.45, 0.45);
    dayColor *= mix(1.0, 1.0 + slope * 1.55, dayFactor);

    // The day photo is linear and reads too dark on this canvas. The curve
    // lifts the sunny side to a full-day photo and keeps snow from clipping.
    vec3 litDay = vec3(1.0) - exp(-dayColor * 5.5);
    vec3 albedo = mix(nightColor, litDay, dayFactor);

    vec3 halfV = normalize(sunDir + viewDir);
    float specMask = texture(specularMap, vUv).r;
    float spec = pow(max(dot(nShade, halfV), 0.0), 70.0) * specMask * dayFactor * 0.14;

    float moonDiff = max(dot(n, normalize(moonDirection)), 0.0) * moonIntensity;
    albedo += vec3(0.55, 0.68, 1.0) * moonDiff * 0.02;

    float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 4.2);
    albedo += vec3(0.55, 0.75, 1.0) * fresnel * 0.02 * dayFactor;

    gl_FragColor = linearToOutputTexel(vec4(albedo + spec * vec3(0.85, 0.92, 1.0), 1.0));
  }
`;

const cloudVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D cloudMap;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vec4 tex = texture(cloudMap, vUv);
    float cloud = tex.r * mix(tex.a, 1.0, step(0.999, tex.a));
    float ndl = dot(normalize(vNormalW), normalize(sunDirection));
    float day = smoothstep(-0.02, 0.12, ndl);
    vec3 col = mix(vec3(0.04, 0.05, 0.07), vec3(1.02, 1.01, 0.98), day);
    float alpha = cloud * mix(0.028, 0.16, day);
    gl_FragColor = linearToOutputTexel(vec4(col, alpha));
  }
`;

const atmosVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosFragment = /* glsl */ `
  uniform vec3 glowColor;
  uniform vec3 sunDirection;
  uniform float power;
  uniform float intensity;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec3 n = normalize(vNormal);
    float rim = pow(1.0 - abs(dot(n, normalize(vView))), power);
    float day = smoothstep(-0.2, 0.45, dot(n, normalize(sunDirection)));
    float lit = mix(0.04, 1.0, day);
    gl_FragColor = linearToOutputTexel(vec4(glowColor, 1.0) * rim * intensity * lit);
  }
`;

function loadTexture(loader, url, colorSpace) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace ?? THREE.SRGBColorSpace;
        tex.anisotropy = 16;
        resolve(tex);
      },
      undefined,
      reject
    );
  });
}

function makeStarTexture() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(220,235,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function dummyTex(r, g, b) {
  const tex = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGlowSprite(stops) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(128, 128, 10, 128, 128, 128);
  for (const [t, color] of stops) g.addColorStop(t, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function createWorld(scene, onProgress) {
  const loader = new THREE.TextureLoader();
  const keys = Object.keys(TEX);
  let loaded = 0;

  const textures = {};
  await Promise.all(
    keys.map(async (key) => {
      const colorSpace = key === "bump" || key === "water" ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      try {
        textures[key] = await loadTexture(loader, TEX[key], colorSpace);
      } catch {
        textures[key] = null;
      } finally {
        loaded += 1;
        onProgress?.(loaded / keys.length, `Loaded ${key} map`);
      }
    })
  );

  const root = new THREE.Group();
  scene.add(root);

  const earthGroup = new THREE.Group();
  earthGroup.rotation.z = THREE.MathUtils.degToRad(23.4);
  root.add(earthGroup);

  const earthMat = new THREE.ShaderMaterial({
    uniforms: {
      dayMap: { value: textures.day ?? dummyTex(28, 78, 140) },
      nightMap: { value: textures.night ?? dummyTex(4, 8, 22) },
      specularMap: { value: textures.water ?? dummyTex(40, 40, 40) },
      bumpMap: { value: textures.bump ?? dummyTex(80, 80, 80) },
      sunDirection: { value: new THREE.Vector3(1, 0.2, 0.1) },
      moonDirection: { value: new THREE.Vector3(-1, 0, 0) },
      moonIntensity: { value: 0.35 },
    },
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
  });

  const earth = new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS, 512, 256), earthMat);
  earthGroup.add(earth);

  if (textures.clouds) {
    const clouds = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 80, 56),
      new THREE.ShaderMaterial({
        uniforms: {
          cloudMap: { value: textures.clouds },
          sunDirection: { value: new THREE.Vector3(1, 0.2, 0.1) },
        },
        vertexShader: cloudVertex,
        fragmentShader: cloudFragment,
        transparent: true,
        depthWrite: false,
      })
    );
    earthGroup.add(clouds);
    earth.userData.clouds = clouds;
  }

  const atmosInner = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.018, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x9fd4ff) },
        sunDirection: { value: new THREE.Vector3(1, 0.2, 0.1) },
        power: { value: 5.2 },
        intensity: { value: 0.95 },
      },
      vertexShader: atmosVertex,
      fragmentShader: atmosFragment,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    })
  );
  earthGroup.add(atmosInner);

  const atmosOuter = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS * 1.038, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color(0x3d8dff) },
        sunDirection: { value: new THREE.Vector3(1, 0.2, 0.1) },
        power: { value: 3.4 },
        intensity: { value: 0.55 },
      },
      vertexShader: atmosVertex,
      fragmentShader: atmosFragment,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    })
  );
  earthGroup.add(atmosOuter);

  const stars = makeStars();
  scene.add(stars);

  const celestial = createCelestial(scene, textures.moon);

  const hemi = new THREE.HemisphereLight(0x9eb7ff, 0x0a0612, 0.28);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0x334466, 0.18);
  scene.add(ambient);

  return {
    root,
    earthGroup,
    earth,
    earthMat,
    celestial,
    stars,
    update(dt, state) {
      if (earth.userData.clouds) {
        earth.userData.clouds.rotation.y += dt * 0.012;
      }
      celestial.update(dt, state);
      const sunPos = celestial.sun.position;
      const moonPos = celestial.moon.position;
      const sunDir = sunPos.clone().normalize();
      earthMat.uniforms.sunDirection.value.copy(sunDir);
      earthMat.uniforms.moonDirection.value.copy(moonPos).normalize();
      earthMat.uniforms.moonIntensity.value = state.moonVisible ? 0.38 : 0.0;
      if (earth.userData.clouds?.material.uniforms?.sunDirection) {
        earth.userData.clouds.material.uniforms.sunDirection.value.copy(sunDir);
      }
      atmosInner.material.uniforms.sunDirection.value.copy(sunDir);
      atmosOuter.material.uniforms.sunDirection.value.copy(sunDir);
    },
  };
}

function makeStars() {
  const count = 4500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const r = 40 + Math.random() * 70;
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    const tint = Math.random();
    if (tint < 0.15) color.setHSL(0.62, 0.45, 0.85);
    else if (tint < 0.25) color.setHSL(0.08, 0.55, 0.85);
    else color.setRGB(1, 1, 1);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = 0.4 + Math.random() * 1.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    map: makeStarTexture(),
    size: 0.28,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  return new THREE.Points(geo, mat);
}

function createCelestial(scene, moonMap) {
  const sunGroup = new THREE.Group();
  const moonGroup = new THREE.Group();
  scene.add(sunGroup, moonGroup);

  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.78, 48, 48),
    new THREE.MeshBasicMaterial({ color: 0xfff1c1 })
  );
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowSprite([
        [0, "rgba(255,255,240,1)"],
        [0.16, "rgba(255,196,80,0.9)"],
        [0.45, "rgba(255,150,40,0.28)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    })
  );
  sunGlow.scale.set(3.1, 3.1, 1);
  const sunHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowSprite([
        [0, "rgba(255,220,140,0.8)"],
        [0.2, "rgba(255,150,40,0.45)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    })
  );
  sunHalo.scale.set(5.4, 5.4, 1);

  const sunLight = new THREE.DirectionalLight(0xfff4d8, 2.4);
  sunLight.castShadow = false;
  scene.add(sunLight.target);

  sunGroup.add(sunCore, sunGlow, sunHalo, sunLight);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(0.52, 48, 32),
    new THREE.MeshStandardMaterial({
      map: moonMap,
      roughness: 1,
      metalness: 0,
      color: moonMap ? 0xffffff : 0xb8c2d6,
    })
  );
  const moonGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: makeGlowSprite([
        [0, "rgba(230,238,255,0.95)"],
        [0.22, "rgba(170,196,255,0.45)"],
        [1, "rgba(0,0,0,0)"],
      ]),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
    })
  );
  moonGlow.scale.set(2.15, 2.15, 1);
  const moonLight = new THREE.PointLight(0x9bb7ff, 1.4, 16, 2);
  moonGroup.add(moon, moonGlow, moonLight);

  const SUN_DIST = 11.5;
  const MOON_DIST = 8.8;

  const api = {
    sun: sunGroup,
    moon: moonGroup,
    sunLight,
    moonLight,
    update(dt, state) {
      if (state.orbiting && !state.realtime) {
        state.sunAngle += dt * state.sunSpeed;
        state.moonAngle += dt * state.moonSpeed;
      }
      if (state.realtime) {
        const d = new Date();
        const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
        state.sunAngle = (hours / 24) * Math.PI * 2 + Math.PI;
        state.hours = hours;
      } else {
        state.hours = (((state.sunAngle - Math.PI) / (Math.PI * 2)) * 24 + 24) % 24;
      }

      const sa = state.sunAngle;
      sunGroup.position.set(Math.cos(sa) * SUN_DIST, Math.sin(sa) * 0.18 * SUN_DIST, Math.sin(sa) * SUN_DIST);
      sunLight.position.copy(sunGroup.position);
      sunLight.target.position.set(0, 0, 0);
      sunLight.target.updateMatrixWorld();

      const ma = state.moonAngle;
      moonGroup.position.set(
        Math.cos(ma) * MOON_DIST,
        Math.sin(ma * 1.15) * 0.35,
        Math.sin(ma) * MOON_DIST
      );
      moon.lookAt(0, 0, 0);

      sunGroup.visible = state.sunVisible;
      moonGroup.visible = state.moonVisible;
      sunLight.intensity = state.sunVisible ? 2.4 : 0.12;
      moonLight.intensity = state.moonVisible ? 1.4 : 0;
    },
  };

  return api;
}
