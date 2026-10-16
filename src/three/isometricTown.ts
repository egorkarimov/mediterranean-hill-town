import * as THREE from 'three'
import type {
  CameraPreset,
  DistrictId,
  TimeOfDay,
  TownPalette,
  TownSceneState,
} from '../shared/domain'

// ============================================================================
// Scene Controller Interface & Singleton Registry for Foldkit Mount + Commands
// ============================================================================

export interface IsometricTownController {
  readonly applyState: (state: TownSceneState) => void
  readonly triggerBellChime: () => void
  readonly setPaused: (paused: boolean) => void
  readonly dispose: () => void
}

let activeController: IsometricTownController | null = null

export const getActiveTownController = (): IsometricTownController | null =>
  activeController

// ============================================================================
// Palette & Atmosphere Definitions
// ============================================================================

interface PaletteColors {
  readonly walls: ReadonlyArray<number>
  readonly roofs: ReadonlyArray<number>
  readonly shutters: ReadonlyArray<number>
  readonly domeColor: number
  readonly cliffColor: number
  readonly cliffSecondary: number
  readonly terraceWall: number
  readonly bougainvillea: ReadonlyArray<number>
}

const PALETTES: Record<TownPalette, PaletteColors> = {
  Amalfi: {
    walls: [0xf4e3c9, 0xe8b882, 0xd9825b, 0xf2d19b, 0xdfa06e, 0xf7ede0],
    roofs: [0xb85236, 0xc75f3e, 0xa1442b, 0xd16b47],
    shutters: [0x2d6a5c, 0x3b7a6b, 0x24546b, 0x6b442a],
    domeColor: 0x2c8c74, // Vietri emerald majolica
    cliffColor: 0x8f8273,
    cliffSecondary: 0x736759,
    terraceWall: 0xa89985,
    bougainvillea: [0xd92672, 0xe83e8c, 0xb81d5d],
  },
  CinqueTerre: {
    walls: [0xe66c55, 0xf0b659, 0xd94f43, 0xe88d56, 0xf5d487, 0xc95a49],
    roofs: [0x6e737b, 0x5d6269, 0xa8523b, 0x7d828a],
    shutters: [0x1f5c4b, 0x286e5b, 0x1a473a, 0x325d73],
    domeColor: 0xd99b26,
    cliffColor: 0x6e6a66,
    cliffSecondary: 0x57534f,
    terraceWall: 0x8c857d,
    bougainvillea: [0xe0246d, 0xf24e8b, 0x9e1952],
  },
  Santorini: {
    walls: [0xfafcff, 0xf2f6fa, 0xe8eef5, 0xffffff, 0xf5f2eb, 0xdce6f2],
    roofs: [0x1a5fb4, 0x2574d1, 0xf2f5f8, 0x174f96],
    shutters: [0x1d63b8, 0x2b7de0, 0x4589d6, 0x154c8f],
    domeColor: 0x1558b0, // Iconic Aegean cobalt dome
    cliffColor: 0x6b564e,
    cliffSecondary: 0x52403a,
    terraceWall: 0x8a756b,
    bougainvillea: [0xd91e6b, 0xf03282, 0xb01556],
  },
  Provence: {
    walls: [0xe5c598, 0xd6a76c, 0xc98b53, 0xebd3ad, 0xdba979, 0xc47947],
    roofs: [0xa65838, 0xb86642, 0x914a2d, 0xc2764f],
    shutters: [0x5e789e, 0x6c87ad, 0x4c6485, 0x786b99],
    domeColor: 0x9c5233,
    cliffColor: 0x968571,
    cliffSecondary: 0x7d6d5b,
    terraceWall: 0xb3a18b,
    bougainvillea: [0x9146b8, 0xb559d6, 0xd63874],
  },
}

interface AtmosphereColors {
  readonly skyTop: number
  readonly skyBottom: number
  readonly fogColor: number
  readonly sunColor: number
  readonly sunIntensity: number
  readonly ambientSky: number
  readonly ambientGround: number
  readonly ambientIntensity: number
  readonly waterDeep: number
  readonly waterShallow: number
  readonly waterSpecular: number
  readonly starOpacity: number
}

const ATMOSPHERES: Record<TimeOfDay, AtmosphereColors> = {
  Dawn: {
    skyTop: 0x3b4d7a,
    skyBottom: 0xf2a68d,
    fogColor: 0xe8ad99,
    sunColor: 0xffa07a,
    sunIntensity: 2.1,
    ambientSky: 0xd9a7c7,
    ambientGround: 0x695958,
    ambientIntensity: 1.15,
    waterDeep: 0x184e6e,
    waterShallow: 0x358296,
    waterSpecular: 0xffbfa3,
    starOpacity: 0.2,
  },
  Midday: {
    skyTop: 0x3a88d4,
    skyBottom: 0xa8d8f8,
    fogColor: 0xbbe1fa,
    sunColor: 0xfff8e7,
    sunIntensity: 2.65,
    ambientSky: 0x99d1ff,
    ambientGround: 0x8c7a6b,
    ambientIntensity: 1.35,
    waterDeep: 0x0b588c,
    waterShallow: 0x1ca8b8,
    waterSpecular: 0xffffff,
    starOpacity: 0.0,
  },
  GoldenHour: {
    skyTop: 0x2b3663,
    skyBottom: 0xf08c55,
    fogColor: 0xe38f62,
    sunColor: 0xff8c42,
    sunIntensity: 2.45,
    ambientSky: 0xff9a66,
    ambientGround: 0x523b35,
    ambientIntensity: 1.1,
    waterDeep: 0x123e5c,
    waterShallow: 0x28788a,
    waterSpecular: 0xffaa5e,
    starOpacity: 0.25,
  },
  Starlight: {
    skyTop: 0x091124,
    skyBottom: 0x192b4d,
    fogColor: 0x13223d,
    sunColor: 0x6d93c7,
    sunIntensity: 0.75,
    ambientSky: 0x263e6b,
    ambientGround: 0x1c1924,
    ambientIntensity: 0.75,
    waterDeep: 0x071d33,
    waterShallow: 0x0f3b57,
    waterSpecular: 0x8cb8ff,
    starOpacity: 0.95,
  },
}

const CAMERA_PRESETS: Record<
  CameraPreset,
  {
    readonly target: THREE.Vector3
    readonly azimuth: number
    readonly polar: number
    readonly zoom: number
  }
> = {
  Panorama: {
    target: new THREE.Vector3(0, 5.5, 0),
    azimuth: Math.PI * 0.25,
    polar: Math.PI * 0.31,
    zoom: 1.0,
  },
  HarborCove: {
    target: new THREE.Vector3(7.5, 1.8, 8.5),
    azimuth: Math.PI * 0.16,
    polar: Math.PI * 0.34,
    zoom: 1.68,
  },
  DuomoPiazza: {
    target: new THREE.Vector3(-1.2, 11.2, -1.5),
    azimuth: Math.PI * 0.32,
    polar: Math.PI * 0.29,
    zoom: 1.82,
  },
  WindmillRidge: {
    target: new THREE.Vector3(-9.5, 7.6, 2.0),
    azimuth: Math.PI * 0.42,
    polar: Math.PI * 0.32,
    zoom: 1.72,
  },
}

const DISTRICT_CENTERS: Record<DistrictId, THREE.Vector3> = {
  duomo: new THREE.Vector3(-1.5, 13.4, -2.0),
  piazza: new THREE.Vector3(1.8, 7.4, 2.2),
  terraces: new THREE.Vector3(4.5, 5.6, -2.5),
  windmill: new THREE.Vector3(-9.8, 8.8, 2.2),
  harbor: new THREE.Vector3(8.5, 2.2, 9.0),
}

// ============================================================================
// Deterministic Seeded PRNG
// ============================================================================

const makeRng = (seed: number) => {
  let state = (Math.abs(Math.floor(seed)) || 42) ^ 0x6d2b79f5
  return () => {
    state = Math.imul(state ^ (state >>> 15), state | 1)
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================================
// Main Three.js Isometric Mediterranean Hill Town Builder
// ============================================================================

export const mountIsometricTown = (
  container: Element,
  initialState: TownSceneState,
  onSelectDistrict: (districtId: DistrictId) => void,
): IsometricTownController => {
  if (activeController !== null) {
    activeController.dispose()
    activeController = null
  }

  let currentState: TownSceneState = { ...initialState }
  let isPaused = false
  let disposed = false

  // --------------------------------------------------------------------------
  // 1. Renderer, Scene & Orthographic Isometric Camera
  // --------------------------------------------------------------------------
  const width = Math.max(container.clientWidth, 320)
  const height = Math.max(container.clientHeight, 320)

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08

  container.innerHTML = ''
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.cursor = 'grab'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const fog = new THREE.FogExp2(0xe38f62, 0.011)
  scene.fog = fog

  const frustumSize = 34
  const aspect = width / height
  const camera = new THREE.OrthographicCamera(
    (-frustumSize * aspect) / 2,
    (frustumSize * aspect) / 2,
    frustumSize / 2,
    -frustumSize / 2,
    -120,
    260,
  )

  // Camera spherical coordinates & smooth interpolation targets
  const initialPreset = CAMERA_PRESETS[currentState.cameraPreset]
  const currentTarget = initialPreset.target.clone()
  const desiredTarget = initialPreset.target.clone()
  let currentAzimuth = initialPreset.azimuth
  let desiredAzimuth = initialPreset.azimuth
  let currentPolar = initialPreset.polar
  let desiredPolar = initialPreset.polar
  let currentZoom = initialPreset.zoom
  let desiredZoom = initialPreset.zoom
  const cameraRadius = 56

  // --------------------------------------------------------------------------
  // 2. Sky Backdrop Dome & Starfield
  // --------------------------------------------------------------------------
  const skyGeo = new THREE.SphereGeometry(135, 32, 24)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x2b3663) },
      bottomColor: { value: new THREE.Color(0xf08c55) },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, 22.0, 0.0)).y;
        float t = clamp(pow(max(h, 0.0), 0.65), 0.0, 1.0);
        gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
      }
    `,
  })
  const skyMesh = new THREE.Mesh(skyGeo, skyMat)
  scene.add(skyMesh)

  // Starfield points
  const starCount = 320
  const starPositions = new Float32Array(starCount * 3)
  const starRng = makeRng(777)
  for (let i = 0; i < starCount; i++) {
    const theta = starRng() * Math.PI * 2
    const phi = starRng() * Math.PI * 0.44
    const r = 115
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.cos(phi) + 8
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0xfff4d6,
    size: 2.2,
    transparent: true,
    opacity: 0.25,
    sizeAttenuation: false,
  })
  const starField = new THREE.Points(starGeo, starMat)
  scene.add(starField)

  // --------------------------------------------------------------------------
  // 3. Lighting System (Sun/Moon Directional + Hemisphere + Warm Point Lights)
  // --------------------------------------------------------------------------
  const hemiLight = new THREE.HemisphereLight(0xff9a66, 0x523b35, 1.1)
  hemiLight.position.set(0, 45, 0)
  scene.add(hemiLight)

  const sunLight = new THREE.DirectionalLight(0xff8c42, 2.45)
  sunLight.position.set(32, 26, 24)
  sunLight.castShadow = true
  sunLight.shadow.mapSize.width = 2048
  sunLight.shadow.mapSize.height = 2048
  sunLight.shadow.camera.near = 5
  sunLight.shadow.camera.far = 110
  const shadowBounds = 26
  sunLight.shadow.camera.left = -shadowBounds
  sunLight.shadow.camera.right = shadowBounds
  sunLight.shadow.camera.top = shadowBounds
  sunLight.shadow.camera.bottom = -shadowBounds
  sunLight.shadow.bias = -0.0005
  scene.add(sunLight)

  const rimLight = new THREE.DirectionalLight(0x70a4ff, 0.55)
  rimLight.position.set(-28, 18, -22)
  scene.add(rimLight)

  // Warm town glow lights (activated when lanterns are lit)
  const piazzaGlowLight = new THREE.PointLight(0xff9d42, 2.2, 16, 1.6)
  piazzaGlowLight.position.set(1.8, 8.8, 2.2)
  scene.add(piazzaGlowLight)

  const duomoGlowLight = new THREE.PointLight(0xffae52, 2.0, 15, 1.6)
  duomoGlowLight.position.set(-1.5, 14.5, -1.8)
  scene.add(duomoGlowLight)

  const harborGlowLight = new THREE.PointLight(0xff9436, 2.4, 18, 1.5)
  harborGlowLight.position.set(8.5, 4.0, 9.2)
  scene.add(harborGlowLight)

  // --------------------------------------------------------------------------
  // 4. Mediterranean Sea & Animated Waves + Shore Foam
  // --------------------------------------------------------------------------
  const waterGeo = new THREE.PlaneGeometry(130, 130, 84, 84)
  waterGeo.rotateX(-Math.PI / 2)
  const waterBasePos = waterGeo.attributes.position!.array.slice() as Float32Array

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x1d6c86,
    roughness: 0.18,
    metalness: 0.12,
    flatShading: true,
  })
  const waterMesh = new THREE.Mesh(waterGeo, waterMat)
  waterMesh.position.y = 0
  waterMesh.receiveShadow = true
  scene.add(waterMesh)

  // Seabed under shallow water
  const seabedGeo = new THREE.PlaneGeometry(130, 130)
  seabedGeo.rotateX(-Math.PI / 2)
  const seabedMat = new THREE.MeshBasicMaterial({ color: 0x0b2c40 })
  const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat)
  seabedMesh.position.y = -1.6
  scene.add(seabedMesh)

  // --------------------------------------------------------------------------
  // 5. Dynamic Scene Groups & Re-seedable Town Hierarchy
  // --------------------------------------------------------------------------
  const townRoot = new THREE.Group()
  scene.add(townRoot)

  // Tracked interactive & animated objects
  const districtClickTargets: Array<THREE.Object3D> = []
  let windowEmissiveMaterials: Array<THREE.MeshStandardMaterial> = []
  let lanternBulbMaterials: Array<THREE.MeshStandardMaterial> = []
  let windmillRotorGroup: THREE.Group | null = null
  let lighthouseBeamGroup: THREE.Group | null = null
  let lighthouseBeamMat: THREE.MeshBasicMaterial | null = null
  let campanileBellGroup: THREE.Group | null = null
  let swayingTrees: Array<{
    readonly mesh: THREE.Object3D
    readonly baseRotZ: number
    readonly baseRotX: number
    readonly phase: number
    readonly speed: number
  }> = []

  interface BoatInstance {
    readonly group: THREE.Group
    readonly mode: 'moored' | 'sailing'
    readonly basePos: THREE.Vector3
    readonly orbitRadiusX: number
    readonly orbitRadiusZ: number
    readonly orbitCenter: THREE.Vector3
    readonly phase: number
    readonly speed: number
    readonly wakeMesh?: THREE.Mesh
  }
  let boats: Array<BoatInstance> = []

  interface SeagullInstance {
    readonly group: THREE.Group
    readonly leftWing: THREE.Object3D
    readonly rightWing: THREE.Object3D
    readonly center: THREE.Vector3
    readonly radius: number
    readonly phase: number
    readonly speed: number
    readonly heightOffset: number
  }
  let seagulls: Array<SeagullInstance> = []

  interface SmokePuff {
    readonly mesh: THREE.Mesh
    readonly origin: THREE.Vector3
    progress: number
    readonly speed: number
  }
  let smokePuffs: Array<SmokePuff> = []

  interface FountainDrop {
    readonly mesh: THREE.Mesh
    readonly angle: number
    progress: number
  }
  let fountainDrops: Array<FountainDrop> = []

  interface ChimeRing {
    readonly mesh: THREE.Mesh
    readonly mat: THREE.MeshBasicMaterial
    progress: number
    active: boolean
  }
  let chimeRings: Array<ChimeRing> = []
  let bellChimeTimer = 0

  // Selection beacon ring floating above currently selected district
  const beaconGroup = new THREE.Group()
  const beaconRingGeo = new THREE.RingGeometry(1.15, 1.42, 32)
  beaconRingGeo.rotateX(-Math.PI / 2)
  const beaconRingMat = new THREE.MeshBasicMaterial({
    color: 0xffd166,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85,
  })
  const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat)
  beaconGroup.add(beaconRing)

  const beaconDiamondGeo = new THREE.OctahedronGeometry(0.38, 0)
  const beaconDiamondMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xff9e1b,
    emissiveIntensity: 0.9,
    roughness: 0.2,
  })
  const beaconDiamond = new THREE.Mesh(beaconDiamondGeo, beaconDiamondMat)
  beaconDiamond.position.y = 1.1
  beaconGroup.add(beaconDiamond)
  beaconGroup.visible = false
  scene.add(beaconGroup)

  // Fireflies / warm evening dust particles
  const fireflyCount = 85
  const fireflyPositions = new Float32Array(fireflyCount * 3)
  const fireflyPhases = new Float32Array(fireflyCount)
  const ffRng = makeRng(909)
  for (let i = 0; i < fireflyCount; i++) {
    const angle = ffRng() * Math.PI * 2
    const rad = 2 + ffRng() * 14
    fireflyPositions[i * 3] = Math.cos(angle) * rad
    fireflyPositions[i * 3 + 1] = 2.0 + ffRng() * 12.5
    fireflyPositions[i * 3 + 2] = Math.sin(angle) * rad
    fireflyPhases[i] = ffRng() * Math.PI * 2
  }
  const fireflyGeo = new THREE.BufferGeometry()
  fireflyGeo.setAttribute(
    'position',
    new THREE.BufferAttribute(fireflyPositions, 3),
  )
  const fireflyMat = new THREE.PointsMaterial({
    color: 0xffd275,
    size: 3.2,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: false,
  })
  const fireflies = new THREE.Points(fireflyGeo, fireflyMat)
  scene.add(fireflies)

  // --------------------------------------------------------------------------
  // 6. Helper Builders for Mediterranean Architecture & Flora
  // --------------------------------------------------------------------------
  const tagDistrict = (obj: THREE.Object3D, districtId: DistrictId) => {
    obj.userData.districtId = districtId
    obj.traverse(child => {
      child.userData.districtId = districtId
    })
    districtClickTargets.push(obj)
  }

  const buildCypressTree = (
    x: number,
    y: number,
    z: number,
    scale: number,
    rng: () => number,
  ) => {
    const group = new THREE.Group()
    group.position.set(x, y, z)

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4028,
      roughness: 0.9,
    })
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08 * scale, 0.13 * scale, 0.55 * scale, 6),
      trunkMat,
    )
    trunk.position.y = 0.25 * scale
    trunk.castShadow = true
    group.add(trunk)

    const foliageColor = rng() > 0.5 ? 0x264d32 : 0x1e4028
    const foliageMat = new THREE.MeshStandardMaterial({
      color: foliageColor,
      roughness: 0.85,
      flatShading: true,
    })

    const cone1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.38 * scale, 1.85 * scale, 7),
      foliageMat,
    )
    cone1.position.y = 1.25 * scale
    cone1.castShadow = true
    cone1.receiveShadow = true
    group.add(cone1)

    const cone2 = new THREE.Mesh(
      new THREE.ConeGeometry(0.28 * scale, 1.35 * scale, 7),
      foliageMat,
    )
    cone2.position.y = 1.85 * scale
    cone2.castShadow = true
    group.add(cone2)

    townRoot.add(group)
    swayingTrees.push({
      mesh: group,
      baseRotZ: 0,
      baseRotX: 0,
      phase: rng() * Math.PI * 2,
      speed: 1.4 + rng() * 0.8,
    })
  }

  const buildOliveTree = (
    x: number,
    y: number,
    z: number,
    scale: number,
    rng: () => number,
  ) => {
    const group = new THREE.Group()
    group.position.set(x, y, z)

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x69543e,
      roughness: 0.9,
    })
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09 * scale, 0.15 * scale, 0.65 * scale, 6),
      trunkMat,
    )
    trunk.position.y = 0.3 * scale
    trunk.rotation.z = (rng() - 0.5) * 0.2
    trunk.castShadow = true
    group.add(trunk)

    const oliveLeafMat = new THREE.MeshStandardMaterial({
      color: rng() > 0.5 ? 0x5f7a52 : 0x6b875e,
      roughness: 0.82,
      flatShading: true,
    })

    for (let i = 0; i < 3; i++) {
      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry((0.42 - i * 0.06) * scale, 0),
        oliveLeafMat,
      )
      crown.position.set(
        (i - 1) * 0.2 * scale,
        (0.78 + (i % 2) * 0.16) * scale,
        ((i % 2) - 0.5) * 0.16 * scale,
      )
      crown.scale.y = 0.68
      crown.castShadow = true
      crown.receiveShadow = true
      group.add(crown)
    }

    townRoot.add(group)
    swayingTrees.push({
      mesh: group,
      baseRotZ: 0,
      baseRotX: 0,
      phase: rng() * Math.PI * 2,
      speed: 1.1 + rng() * 0.6,
    })
  }

  const buildBougainvilleaCluster = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    colors: ReadonlyArray<number>,
    rng: () => number,
  ) => {
    const color = colors[Math.floor(rng() * colors.length)] ?? 0xd92672
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      flatShading: true,
    })
    for (let i = 0; i < 3; i++) {
      const bush = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.18 + rng() * 0.12, 0),
        mat,
      )
      bush.position.set(
        x + (rng() - 0.5) * 0.28,
        y - i * 0.16,
        z + (rng() - 0.5) * 0.28,
      )
      bush.castShadow = true
      parent.add(bush)
    }
  }

  // --------------------------------------------------------------------------
  // 7. Procedural Rebuild of the Entire Hill Town for a Given Seed & Palette
  // --------------------------------------------------------------------------
  const buildTownScene = (seed: number, paletteKey: TownPalette) => {
    // Clear existing townRoot children
    while (townRoot.children.length > 0) {
      const child = townRoot.children[0]!
      townRoot.remove(child)
    }
    districtClickTargets.length = 0
    windowEmissiveMaterials = []
    lanternBulbMaterials = []
    swayingTrees = []
    boats = []
    seagulls = []
    smokePuffs = []
    fountainDrops = []
    chimeRings = []
    windmillRotorGroup = null
    lighthouseBeamGroup = null
    lighthouseBeamMat = null
    campanileBellGroup = null

    const rng = makeRng(seed)
    const pal = PALETTES[paletteKey]

    const cliffMat = new THREE.MeshStandardMaterial({
      color: pal.cliffColor,
      roughness: 0.92,
      flatShading: true,
    })
    const cliffDarkMat = new THREE.MeshStandardMaterial({
      color: pal.cliffSecondary,
      roughness: 0.95,
      flatShading: true,
    })
    const stoneWallMat = new THREE.MeshStandardMaterial({
      color: pal.terraceWall,
      roughness: 0.85,
      flatShading: true,
    })
    const cobbleMat = new THREE.MeshStandardMaterial({
      color: 0xc9bca8,
      roughness: 0.88,
    })

    const makeWindowMaterial = () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffdf9e,
        emissive: 0xff9d3b,
        emissiveIntensity: currentState.lanternsLit ? 1.55 : 0.08,
        roughness: 0.3,
      })
      windowEmissiveMaterials.push(mat)
      return mat
    }

    const makeLanternMaterial = () => {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfff0c2,
        emissive: 0xffa63b,
        emissiveIntensity: currentState.lanternsLit ? 2.4 : 0.15,
        roughness: 0.2,
      })
      lanternBulbMaterials.push(mat)
      return mat
    }

    // ------------------------------------------------------------------------
    // A. Sculpted Limestone Cliff Tiers & Coastal Promontory
    // ------------------------------------------------------------------------
    const cliffGroup = new THREE.Group()
    townRoot.add(cliffGroup)

    const addCliffTier = (
      x: number,
      y: number,
      z: number,
      radiusTop: number,
      radiusBottom: number,
      height: number,
      segments: number,
      districtId: DistrictId,
    ) => {
      const geo = new THREE.CylinderGeometry(
        radiusTop,
        radiusBottom,
        height,
        segments,
      )
      // Perturb vertices slightly for organic limestone crags
      const pos = geo.attributes.position!
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i)
        const vy = pos.getY(i)
        const vz = pos.getZ(i)
        const radial = Math.hypot(vx, vz)
        if (radial > 0.2 && vy < height * 0.45) {
          const n = 0.92 + rng() * 0.16
          pos.setX(i, vx * n)
          pos.setZ(i, vz * n)
        }
      }
      geo.computeVertexNormals()

      const mesh = new THREE.Mesh(
        geo,
        rng() > 0.4 ? cliffMat : cliffDarkMat,
      )
      mesh.position.set(x, y + height / 2, z)
      mesh.castShadow = true
      mesh.receiveShadow = true
      cliffGroup.add(mesh)

      // Top terrace paving cap
      const capGeo = new THREE.CylinderGeometry(
        radiusTop * 0.96,
        radiusTop * 0.98,
        0.28,
        segments,
      )
      const capMesh = new THREE.Mesh(capGeo, stoneWallMat)
      capMesh.position.set(x, y + height + 0.1, z)
      capMesh.receiveShadow = true
      capMesh.castShadow = true
      tagDistrict(capMesh, districtId)
      cliffGroup.add(capMesh)
    }

    // Base Reef & Coastal Shelf
    addCliffTier(0, -0.8, 0, 14.5, 16.5, 2.8, 12, 'terraces')
    // Lower Terrace (Terraces & Viaduct)
    addCliffTier(1.5, 1.8, -0.8, 11.2, 12.6, 3.6, 11, 'terraces')
    // Piazza Middle Terrace
    addCliffTier(1.4, 5.1, 1.5, 7.6, 8.6, 2.5, 10, 'piazza')
    // Western Windmill Ridge Promontory
    addCliffTier(-9.2, 1.5, 2.2, 5.2, 6.8, 6.2, 9, 'windmill')
    // Upper Citadel / Duomo Crown
    addCliffTier(-1.5, 7.3, -2.0, 5.4, 6.5, 4.4, 10, 'duomo')

    // Sea Stacks & Outcrops
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2 + 0.4
      const dist = 15.5 + rng() * 3.5
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.9 + rng() * 1.1, 0),
        cliffDarkMat,
      )
      rock.position.set(
        Math.cos(angle) * dist,
        0.15,
        Math.sin(angle) * dist,
      )
      rock.scale.y = 0.65 + rng() * 0.5
      rock.castShadow = true
      rock.receiveShadow = true
      cliffGroup.add(rock)
    }

    // Roman Arched Viaduct Bridge connecting Windmill Ridge to Central Town
    const viaductGroup = new THREE.Group()
    viaductGroup.position.set(-4.6, 4.5, 0.8)
    viaductGroup.rotation.y = -0.25
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.6, 1.5),
      stoneWallMat,
    )
    deck.position.y = 2.6
    deck.castShadow = true
    deck.receiveShadow = true
    viaductGroup.add(deck)

    for (let i = -2; i <= 2; i++) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 2.8, 1.4),
        stoneWallMat,
      )
      pillar.position.set(i * 1.25, 1.2, 0)
      pillar.castShadow = true
      viaductGroup.add(pillar)
    }
    tagDistrict(viaductGroup, 'terraces')
    townRoot.add(viaductGroup)

    // ------------------------------------------------------------------------
    // B. Mediterranean House Generator
    // ------------------------------------------------------------------------
    const buildHouse = (options: {
      x: number
      y: number
      z: number
      w: number
      h: number
      d: number
      rotY: number
      districtId: DistrictId
      hasChimney?: boolean
      hasBalcony?: boolean
      hasPergola?: boolean
    }) => {
      const houseGroup = new THREE.Group()
      houseGroup.position.set(options.x, options.y, options.z)
      houseGroup.rotation.y = options.rotY

      const wallColor =
        pal.walls[Math.floor(rng() * pal.walls.length)] ?? 0xf4e3c9
      const roofColor =
        pal.roofs[Math.floor(rng() * pal.roofs.length)] ?? 0xb85236
      const shutterColor =
        pal.shutters[Math.floor(rng() * pal.shutters.length)] ?? 0x2d6a5c

      const wallMat = new THREE.MeshStandardMaterial({
        color: wallColor,
        roughness: 0.78,
      })
      const roofMat = new THREE.MeshStandardMaterial({
        color: roofColor,
        roughness: 0.65,
        flatShading: true,
      })
      const shutterMat = new THREE.MeshStandardMaterial({
        color: shutterColor,
        roughness: 0.7,
      })

      // Main stucco body
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(options.w, options.h, options.d),
        wallMat,
      )
      body.position.y = options.h / 2
      body.castShadow = true
      body.receiveShadow = true
      houseGroup.add(body)

      // Roof: Santorini uses barrel vaults or flat terraces; others use pitched terracotta hip/gable roofs
      if (paletteKey === 'Santorini' && rng() > 0.35) {
        const vault = new THREE.Mesh(
          new THREE.CylinderGeometry(
            options.w * 0.48,
            options.w * 0.48,
            options.d * 0.96,
            12,
            1,
            false,
            0,
            Math.PI,
          ),
          wallMat,
        )
        vault.rotation.z = Math.PI / 2
        vault.rotation.y = Math.PI / 2
        vault.scale.set(1, 0.55, 1)
        vault.position.y = options.h
        vault.castShadow = true
        houseGroup.add(vault)
      } else {
        const roofHeight = 0.45 + rng() * 0.32
        const roof = new THREE.Mesh(
          new THREE.ConeGeometry(
            Math.hypot(options.w, options.d) * 0.56,
            roofHeight,
            4,
          ),
          roofMat,
        )
        roof.position.y = options.h + roofHeight / 2 - 0.02
        roof.rotation.y = Math.PI / 4
        roof.scale.set(
          options.w / Math.max(options.w, options.d),
          1,
          options.d / Math.max(options.w, options.d),
        )
        roof.castShadow = true
        roof.receiveShadow = true
        houseGroup.add(roof)
      }

      // Windows on front & back facades
      const floors = Math.max(1, Math.floor(options.h / 0.85))
      const cols = Math.max(1, Math.floor(options.w / 0.72))
      const winMat = makeWindowMaterial()

      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          if (rng() > 0.22) {
            const wx = (c - (cols - 1) / 2) * 0.56
            const wy = 0.48 + f * 0.78
            if (wy < options.h - 0.25) {
              const winPane = new THREE.Mesh(
                new THREE.BoxGeometry(0.22, 0.34, 0.05),
                winMat,
              )
              winPane.position.set(wx, wy, options.d / 2 + 0.01)
              houseGroup.add(winPane)

              // Wooden shutters
              const leftShutter = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.34, 0.06),
                shutterMat,
              )
              leftShutter.position.set(wx - 0.15, wy, options.d / 2 + 0.015)
              houseGroup.add(leftShutter)

              const rightShutter = new THREE.Mesh(
                new THREE.BoxGeometry(0.08, 0.34, 0.06),
                shutterMat,
              )
              rightShutter.position.set(wx + 0.15, wy, options.d / 2 + 0.015)
              houseGroup.add(rightShutter)
            }
          }
        }
      }

      // Optional balcony or pergola with bougainvillea
      if (options.hasBalcony || rng() > 0.62) {
        const bal = new THREE.Mesh(
          new THREE.BoxGeometry(options.w * 0.55, 0.12, 0.36),
          stoneWallMat,
        )
        bal.position.set(0, options.h * 0.58, options.d / 2 + 0.16)
        houseGroup.add(bal)

        if (rng() > 0.4) {
          buildBougainvilleaCluster(
            houseGroup,
            options.w * 0.22,
            options.h * 0.62,
            options.d / 2 + 0.2,
            pal.bougainvillea,
            rng,
          )
        }
      }

      // Optional chimney with rising smoke puffs
      if (options.hasChimney || rng() > 0.72) {
        const chimX = (rng() - 0.5) * options.w * 0.5
        const chimZ = (rng() - 0.5) * options.d * 0.5
        const chimney = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.55, 0.22),
          stoneWallMat,
        )
        chimney.position.set(chimX, options.h + 0.35, chimZ)
        houseGroup.add(chimney)

        if (smokePuffs.length < 18) {
          const smokeMat = new THREE.MeshBasicMaterial({
            color: 0xf5efe6,
            transparent: true,
            opacity: 0.45,
          })
          const puffMesh = new THREE.Mesh(
            new THREE.DodecahedronGeometry(0.18, 0),
            smokeMat,
          )
          const worldOrigin = new THREE.Vector3(
            options.x + chimX,
            options.y + options.h + 0.7,
            options.z + chimZ,
          )
          puffMesh.position.copy(worldOrigin)
          townRoot.add(puffMesh)
          smokePuffs.push({
            mesh: puffMesh,
            origin: worldOrigin,
            progress: rng(),
            speed: 0.25 + rng() * 0.2,
          })
        }
      }

      tagDistrict(houseGroup, options.districtId)
      townRoot.add(houseGroup)
    }

    // ------------------------------------------------------------------------
    // C. Crown Landmark: Hilltop Duomo di Santa Maria & Campanile ('duomo')
    // ------------------------------------------------------------------------
    const duomoGroup = new THREE.Group()
    duomoGroup.position.set(-1.5, 11.8, -2.0)

    const duomoWallMat = new THREE.MeshStandardMaterial({
      color: paletteKey === 'Santorini' ? 0xffffff : 0xfbf2e3,
      roughness: 0.7,
    })
    const duomoTrimMat = new THREE.MeshStandardMaterial({
      color: 0xd9c7ad,
      roughness: 0.8,
    })
    const domeMat = new THREE.MeshStandardMaterial({
      color: pal.domeColor,
      roughness: 0.28,
      metalness: 0.15,
      flatShading: true,
    })
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcf54,
      emissive: 0xffa619,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.8,
    })

    // Cathedral Nave & Transept
    const nave = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 2.3, 4.2),
      duomoWallMat,
    )
    nave.position.y = 1.15
    nave.castShadow = true
    nave.receiveShadow = true
    duomoGroup.add(nave)

    const transept = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 2.1, 1.9),
      duomoWallMat,
    )
    transept.position.set(0, 1.05, -0.4)
    transept.castShadow = true
    duomoGroup.add(transept)

    // Nave pitched roof
    const naveRoof = new THREE.Mesh(
      new THREE.ConeGeometry(2.4, 0.95, 4),
      new THREE.MeshStandardMaterial({
        color: pal.roofs[0] ?? 0xb85236,
        roughness: 0.65,
      }),
    )
    naveRoof.rotation.y = Math.PI / 4
    naveRoof.scale.set(0.78, 1, 1.32)
    naveRoof.position.set(0, 2.75, 0.2)
    naveRoof.castShadow = true
    duomoGroup.add(naveRoof)

    // Octagonal Drum & Ribbed Majolica Dome (Cupola)
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.2, 0.9, 8),
      duomoTrimMat,
    )
    drum.position.set(0, 2.55, -0.5)
    drum.castShadow = true
    duomoGroup.add(drum)

    const cupola = new THREE.Mesh(
      new THREE.SphereGeometry(1.14, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      domeMat,
    )
    cupola.position.set(0, 2.95, -0.5)
    cupola.scale.y = 1.22
    cupola.castShadow = true
    duomoGroup.add(cupola)

    // Golden Cupola Lantern & Cross
    const cupolaLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.28, 0.55, 8),
      makeLanternMaterial(),
    )
    cupolaLantern.position.set(0, 4.42, -0.5)
    duomoGroup.add(cupolaLantern)

    const crossSpire = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.55, 6),
      goldMat,
    )
    crossSpire.position.set(0, 4.9, -0.5)
    duomoGroup.add(crossSpire)

    // Rose Window on Front Facade
    const roseWindow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 0.08, 16),
      makeWindowMaterial(),
    )
    roseWindow.rotation.x = Math.PI / 2
    roseWindow.position.set(0, 1.55, 2.11)
    duomoGroup.add(roseWindow)

    // Tall Campanile (Bell Tower) with Swinging Bronze Bell
    const campanileBase = new THREE.Mesh(
      new THREE.BoxGeometry(1.15, 4.6, 1.15),
      duomoWallMat,
    )
    campanileBase.position.set(1.85, 2.3, 1.35)
    campanileBase.castShadow = true
    campanileBase.receiveShadow = true
    duomoGroup.add(campanileBase)

    // Belfry Crown Pillars
    const belfryY = 4.95
    for (const [px, pz] of [
      [-0.42, -0.42],
      [0.42, -0.42],
      [-0.42, 0.42],
      [0.42, 0.42],
    ] as const) {
      const pillar = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.95, 0.22),
        duomoTrimMat,
      )
      pillar.position.set(1.85 + px, belfryY, 1.35 + pz)
      pillar.castShadow = true
      duomoGroup.add(pillar)
    }

    // Swinging Bronze Bell inside Belfry
    const bellPivot = new THREE.Group()
    bellPivot.position.set(1.85, belfryY + 0.32, 1.35)
    const bellMesh = new THREE.Mesh(
      new THREE.ConeGeometry(0.28, 0.46, 10),
      goldMat,
    )
    bellMesh.position.y = -0.22
    bellPivot.add(bellMesh)
    duomoGroup.add(bellPivot)
    campanileBellGroup = bellPivot

    // Campanile Spire
    const belfrySpire = new THREE.Mesh(
      new THREE.ConeGeometry(0.86, 1.35, 4),
      domeMat,
    )
    belfrySpire.rotation.y = Math.PI / 4
    belfrySpire.position.set(1.85, belfryY + 1.12, 1.35)
    belfrySpire.castShadow = true
    duomoGroup.add(belfrySpire)

    // Acoustic Chime Rings around Campanile
    for (let i = 0; i < 3; i++) {
      const rMat = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
      })
      const rMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.56, 32),
        rMat,
      )
      rMesh.rotation.x = -Math.PI / 2
      rMesh.position.set(1.85, belfryY, 1.35)
      duomoGroup.add(rMesh)
      chimeRings.push({
        mesh: rMesh,
        mat: rMat,
        progress: i * 0.33,
        active: false,
      })
    }

    tagDistrict(duomoGroup, 'duomo')
    townRoot.add(duomoGroup)

    // Surrounding Citadel Houses
    const duomoOffsets = [
      [-3.9, 11.8, -3.5],
      [-4.2, 11.8, -0.8],
      [1.2, 11.8, -4.2],
      [-1.8, 11.8, -5.2],
      [1.8, 11.8, -1.8],
    ] as const
    for (const [hx, hy, hz] of duomoOffsets) {
      buildHouse({
        x: hx,
        y: hy,
        z: hz,
        w: 1.3 + rng() * 0.5,
        h: 1.5 + rng() * 0.8,
        d: 1.3 + rng() * 0.5,
        rotY: (rng() - 0.5) * 0.5,
        districtId: 'duomo',
      })
    }

    // ------------------------------------------------------------------------
    // D. Central Piazza del Mercato, Tiered Fountain & Festoon Garlands ('piazza')
    // ------------------------------------------------------------------------
    const piazzaGroup = new THREE.Group()
    piazzaGroup.position.set(1.4, 7.75, 1.6)

    // Ornate 3-Tier Marble Fountain
    const marbleMat = new THREE.MeshStandardMaterial({
      color: 0xf5efe6,
      roughness: 0.45,
    })
    const fountainWaterMat = new THREE.MeshStandardMaterial({
      color: 0x3ec6e0,
      emissive: 0x16697a,
      emissiveIntensity: 0.35,
      roughness: 0.15,
    })

    const basin1 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.15, 0.38, 10),
      marbleMat,
    )
    basin1.position.y = 0.19
    basin1.castShadow = true
    basin1.receiveShadow = true
    piazzaGroup.add(basin1)

    const pool1 = new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.12, 0.41, 10),
      fountainWaterMat,
    )
    pool1.position.y = 0.2
    piazzaGroup.add(pool1)

    const basin2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.55, 0.28, 10),
      marbleMat,
    )
    basin2.position.y = 0.72
    basin2.castShadow = true
    piazzaGroup.add(basin2)

    const finial = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.65, 8),
      marbleMat,
    )
    finial.position.y = 1.1
    piazzaGroup.add(finial)

    // Animated Fountain Spray Droplets
    for (let i = 0; i < 12; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 6, 6),
        fountainWaterMat,
      )
      piazzaGroup.add(drop)
      fountainDrops.push({
        mesh: drop,
        angle: (i / 12) * Math.PI * 2,
        progress: i / 12,
      })
    }

    // Café Parasols & Tables around Piazza
    const parasolColors = [0xd94f3d, 0xf2b749, 0x2b7a9b, 0xf7f3eb]
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + 0.3
      const r = 2.35 + (i % 2) * 0.45
      const px = Math.cos(angle) * r
      const pz = Math.sin(angle) * r

      const umbrella = new THREE.Mesh(
        new THREE.ConeGeometry(0.52, 0.28, 8),
        new THREE.MeshStandardMaterial({
          color: parasolColors[i % parasolColors.length]!,
          roughness: 0.7,
        }),
      )
      umbrella.position.set(px, 0.72, pz)
      umbrella.castShadow = true
      piazzaGroup.add(umbrella)

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.03, 0.03, 0.7, 6),
        stoneWallMat,
      )
      pole.position.set(px, 0.35, pz)
      piazzaGroup.add(pole)
    }

    // Overhead Festa String Lanterns across the Piazza
    const bulbMat = makeLanternMaterial()
    for (let strand = 0; strand < 3; strand++) {
      const zOff = (strand - 1) * 1.65
      for (let b = -4; b <= 4; b++) {
        const bx = b * 0.78
        const sag = 1.85 - (1 - (b / 4) * (b / 4)) * 0.38
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.085, 8, 8),
          bulbMat,
        )
        bulb.position.set(bx, sag, zOff)
        piazzaGroup.add(bulb)
      }
    }

    tagDistrict(piazzaGroup, 'piazza')
    townRoot.add(piazzaGroup)

    // Piazza Ring of Townhouses &Tavernas
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 1.65 - 0.65
      const rad = 4.6 + (i % 2) * 0.85
      buildHouse({
        x: 1.4 + Math.cos(a) * rad,
        y: 7.7,
        z: 1.5 + Math.sin(a) * rad,
        w: 1.45 + rng() * 0.55,
        h: 1.8 + rng() * 1.15,
        d: 1.35 + rng() * 0.45,
        rotY: -a + Math.PI / 2,
        districtId: 'piazza',
        hasBalcony: true,
      })
    }

    // ------------------------------------------------------------------------
    // E. Western Ridge: Mulino a Vento (Mediterranean Windmill) ('windmill')
    // ------------------------------------------------------------------------
    const windmillGroup = new THREE.Group()
    windmillGroup.position.set(-9.5, 7.85, 2.2)

    const millTower = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.35, 3.3, 12),
      new THREE.MeshStandardMaterial({
        color: 0xf7efe2,
        roughness: 0.78,
      }),
    )
    millTower.position.y = 1.65
    millTower.castShadow = true
    millTower.receiveShadow = true
    windmillGroup.add(millTower)

    const millRoof = new THREE.Mesh(
      new THREE.ConeGeometry(1.22, 1.05, 12),
      new THREE.MeshStandardMaterial({
        color: pal.roofs[0] ?? 0xa65838,
        roughness: 0.7,
      }),
    )
    millRoof.position.y = 3.82
    millRoof.castShadow = true
    windmillGroup.add(millRoof)

    // Rotating 4-Blade Timber & Canvas Sails
    const rotor = new THREE.Group()
    rotor.position.set(0, 2.85, 1.22)

    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x4a321f, roughness: 0.85 }),
    )
    hub.rotation.x = Math.PI / 2
    rotor.add(hub)

    const timberMat = new THREE.MeshStandardMaterial({
      color: 0x5e3f26,
      roughness: 0.85,
    })
    const sailCanvasMat = new THREE.MeshStandardMaterial({
      color: 0xfcf6e8,
      roughness: 0.6,
      side: THREE.DoubleSide,
    })

    for (let i = 0; i < 4; i++) {
      const bladeGroup = new THREE.Group()
      bladeGroup.rotation.z = (i * Math.PI) / 2

      const spar = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.45, 0.08),
        timberMat,
      )
      spar.position.y = 1.25
      spar.castShadow = true
      bladeGroup.add(spar)

      const canvas = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 1.9, 0.03),
        sailCanvasMat,
      )
      canvas.position.set(0.28, 1.4, 0.02)
      canvas.rotation.y = 0.18
      canvas.castShadow = true
      bladeGroup.add(canvas)

      rotor.add(bladeGroup)
    }

    windmillGroup.add(rotor)
    windmillRotorGroup = rotor

    tagDistrict(windmillGroup, 'windmill')
    townRoot.add(windmillGroup)

    // Windmill Keeper Cottages & Grain Silos
    for (let i = 0; i < 4; i++) {
      const a = i * 1.3 + 0.5
      buildHouse({
        x: -9.2 + Math.cos(a) * 2.8,
        y: 7.8,
        z: 2.2 + Math.sin(a) * 2.6,
        w: 1.25 + rng() * 0.4,
        h: 1.35 + rng() * 0.55,
        d: 1.2 + rng() * 0.4,
        rotY: a,
        districtId: 'windmill',
      })
    }

    // ------------------------------------------------------------------------
    // F. Cascading Hillside Houses ('terraces')
    // ------------------------------------------------------------------------
    for (let i = 0; i < 24; i++) {
      const angle = (i / 24) * Math.PI * 2
      const radius = 6.6 + (i % 3) * 1.45 + (rng() - 0.5) * 0.8
      const hx = 1.4 + Math.cos(angle) * radius
      const hz = -0.6 + Math.sin(angle) * radius
      // Leave harbor cove opening on the front-right
      if (hx > 4.5 && hz > 4.5) continue

      buildHouse({
        x: hx,
        y: 5.45 - (radius > 8.2 ? 0.1 : 0),
        z: hz,
        w: 1.25 + rng() * 0.65,
        h: 1.55 + rng() * 1.25,
        d: 1.25 + rng() * 0.6,
        rotY: -angle + Math.PI / 2 + (rng() - 0.5) * 0.35,
        districtId: 'terraces',
      })
    }

    // Lower Coastal Ring Houses
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + 0.2
      const radius = 11.4 + (rng() - 0.5) * 1.1
      const hx = 0.5 + Math.cos(angle) * radius
      const hz = 0.2 + Math.sin(angle) * radius
      if (hx > 3.5 && hz > 3.5) continue

      buildHouse({
        x: hx,
        y: 2.05,
        z: hz,
        w: 1.3 + rng() * 0.55,
        h: 1.6 + rng() * 0.95,
        d: 1.25 + rng() * 0.5,
        rotY: -angle + Math.PI / 2,
        districtId: 'terraces',
      })
    }

    // Stepped Cobblestone Stairs climbing from Harbor to Piazza to Duomo
    for (let s = 0; s < 14; s++) {
      const t = s / 13
      const stepMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.24, 0.65),
        cobbleMat,
      )
      stepMesh.position.set(
        THREE.MathUtils.lerp(6.8, 2.4, t),
        THREE.MathUtils.lerp(2.1, 7.6, t),
        THREE.MathUtils.lerp(6.8, 3.2, t),
      )
      stepMesh.rotation.y = 0.65
      stepMesh.receiveShadow = true
      townRoot.add(stepMesh)
    }

    // ------------------------------------------------------------------------
    // G. Porto Vecchio, Breakwater Pier & Faro Lighthouse ('harbor')
    // ------------------------------------------------------------------------
    const harborGroup = new THREE.Group()
    harborGroup.position.set(6.5, 0, 7.0)

    // Curved Stone Breakwater Mole (Molo)
    const pier1 = new THREE.Mesh(
      new THREE.BoxGeometry(7.2, 1.5, 1.8),
      stoneWallMat,
    )
    pier1.position.set(0.8, 0.65, 1.2)
    pier1.rotation.y = -0.35
    pier1.castShadow = true
    pier1.receiveShadow = true
    harborGroup.add(pier1)

    const pier2 = new THREE.Mesh(
      new THREE.BoxGeometry(4.8, 1.5, 1.6),
      stoneWallMat,
    )
    pier2.position.set(4.6, 0.65, 3.6)
    pier2.rotation.y = -1.05
    pier2.castShadow = true
    pier2.receiveShadow = true
    harborGroup.add(pier2)

    // Wooden Boat Jetties
    const dockMat = new THREE.MeshStandardMaterial({
      color: 0x735135,
      roughness: 0.85,
    })
    for (let d = 0; d < 2; d++) {
      const jetty = new THREE.Mesh(
        new THREE.BoxGeometry(0.75, 0.16, 2.6),
        dockMat,
      )
      jetty.position.set(-0.6 + d * 1.9, 0.65, 2.9 + d * 0.5)
      jetty.rotation.y = -0.35
      jetty.castShadow = true
      harborGroup.add(jetty)
    }

    // Striped Faro (Harbor Lighthouse) at End of Breakwater
    const faroX = 5.6
    const faroZ = 5.4
    const faroBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.82, 0.96, 1.4, 10),
      stoneWallMat,
    )
    faroBase.position.set(faroX, 1.35, faroZ)
    faroBase.castShadow = true
    harborGroup.add(faroBase)

    const stripeWhite = new THREE.MeshStandardMaterial({
      color: 0xfaf6ed,
      roughness: 0.65,
    })
    const stripeRed = new THREE.MeshStandardMaterial({
      color: 0xc93b2b,
      roughness: 0.65,
    })

    for (let s = 0; s < 4; s++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.56 - s * 0.04,
          0.6 - s * 0.04,
          0.72,
          10,
        ),
        s % 2 === 0 ? stripeWhite : stripeRed,
      )
      seg.position.set(faroX, 2.35 + s * 0.72, faroZ)
      seg.castShadow = true
      harborGroup.add(seg)
    }

    // Faro Lantern Room & Rotating Volumetric Beam
    const faroLantern = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.65, 10),
      makeLanternMaterial(),
    )
    faroLantern.position.set(faroX, 5.2, faroZ)
    harborGroup.add(faroLantern)

    const faroCap = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.55, 10),
      stripeRed,
    )
    faroCap.position.set(faroX, 5.75, faroZ)
    harborGroup.add(faroCap)

    const beamPivot = new THREE.Group()
    beamPivot.position.set(faroX, 5.2, faroZ)

    const beamGeo = new THREE.ConeGeometry(2.6, 14, 16, 1, true)
    beamGeo.translate(0, -7, 0)
    beamGeo.rotateX(-Math.PI / 2)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffe49e,
      transparent: true,
      opacity: currentState.lanternsLit ? 0.16 : 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const beamCone = new THREE.Mesh(beamGeo, beamMat)
    beamPivot.add(beamCone)

    const beamConeBack = new THREE.Mesh(beamGeo, beamMat)
    beamConeBack.rotation.y = Math.PI
    beamPivot.add(beamConeBack)

    harborGroup.add(beamPivot)
    lighthouseBeamGroup = beamPivot
    lighthouseBeamMat = beamMat

    tagDistrict(harborGroup, 'harbor')
    townRoot.add(harborGroup)

    // Waterfront Fisherman's Houses along the Cove
    for (let i = 0; i < 7; i++) {
      const t = i / 6
      buildHouse({
        x: THREE.MathUtils.lerp(3.5, 9.2, t),
        y: 1.35,
        z: THREE.MathUtils.lerp(8.5, 5.8, t),
        w: 1.2 + rng() * 0.4,
        h: 1.55 + rng() * 0.75,
        d: 1.2 + rng() * 0.35,
        rotY: -0.42,
        districtId: 'harbor',
      })
    }

    // ------------------------------------------------------------------------
    // H. Wooden Gozzo Fishing Boats (Moored + Sailing Around the Island)
    // ------------------------------------------------------------------------
    const hullColors = [0x1e5c8a, 0xc93b2b, 0x287a5c, 0xd98a26, 0x2d4c73, 0xa8383b]

    const createBoatMesh = (hullColor: number, withSail: boolean) => {
      const boat = new THREE.Group()

      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.72, 0.28, 1.55),
        new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.6 }),
      )
      hull.position.y = 0.12
      hull.castShadow = true
      boat.add(hull)

      const deckTrim = new THREE.Mesh(
        new THREE.BoxGeometry(0.78, 0.08, 1.62),
        new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: 0.7 }),
      )
      deckTrim.position.y = 0.26
      boat.add(deckTrim)

      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(0.44, 0.28, 0.52),
        new THREE.MeshStandardMaterial({ color: 0xede4d3, roughness: 0.7 }),
      )
      cabin.position.set(0, 0.4, -0.15)
      boat.add(cabin)

      // Bow Lantern
      const bowLantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        makeLanternMaterial(),
      )
      bowLantern.position.set(0, 0.42, 0.68)
      boat.add(bowLantern)

      if (withSail) {
        const mast = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.04, 1.45, 6),
          dockMat,
        )
        mast.position.set(0, 0.9, 0.15)
        boat.add(mast)

        const sail = new THREE.Mesh(
          new THREE.ConeGeometry(0.55, 1.25, 3),
          new THREE.MeshStandardMaterial({
            color: 0xfff8eb,
            roughness: 0.65,
            side: THREE.DoubleSide,
          }),
        )
        sail.position.set(0.08, 0.98, 0.15)
        sail.scale.set(0.25, 1, 1.1)
        sail.castShadow = true
        boat.add(sail)
      }

      return boat
    }

    // 3 Moored Boats in Harbor
    const mooredCoords = [
      [5.5, 10.6, 0.3],
      [7.4, 11.2, -0.2],
      [9.3, 11.8, 0.5],
    ] as const
    mooredCoords.forEach(([bx, bz, rot], idx) => {
      const boatGroup = createBoatMesh(hullColors[idx]!, idx === 1)
      boatGroup.position.set(bx, 0.05, bz)
      boatGroup.rotation.y = rot
      tagDistrict(boatGroup, 'harbor')
      townRoot.add(boatGroup)
      boats.push({
        group: boatGroup,
        mode: 'moored',
        basePos: new THREE.Vector3(bx, 0.05, bz),
        orbitRadiusX: 0,
        orbitRadiusZ: 0,
        orbitCenter: new THREE.Vector3(),
        phase: idx * 1.7,
        speed: 1.2,
      })
    })

    // 3 Actively Sailing Gozzo Boats cruising around the Island
    for (let s = 0; s < 3; s++) {
      const boatGroup = createBoatMesh(hullColors[s + 3]!, true)
      const wakeMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      })
      const wakeGeo = new THREE.PlaneGeometry(0.65, 2.1)
      wakeGeo.rotateX(-Math.PI / 2)
      const wakeMesh = new THREE.Mesh(wakeGeo, wakeMat)
      wakeMesh.position.set(0, 0.03, -1.25)
      boatGroup.add(wakeMesh)

      tagDistrict(boatGroup, 'harbor')
      townRoot.add(boatGroup)

      boats.push({
        group: boatGroup,
        mode: 'sailing',
        basePos: new THREE.Vector3(),
        orbitRadiusX: 20.5 + s * 3.4,
        orbitRadiusZ: 18.5 + s * 3.0,
        orbitCenter: new THREE.Vector3(0.5, 0.06, 1.0),
        phase: (s * Math.PI * 2) / 3,
        speed: 0.14 + s * 0.035,
        wakeMesh,
      })
    }

    // ------------------------------------------------------------------------
    // I. Cypress Avenues & Olive Groves Across the Slopes
    // ------------------------------------------------------------------------
    for (let i = 0; i < 34; i++) {
      const angle = rng() * Math.PI * 2
      const dist = 5.0 + rng() * 9.5
      const tx = Math.cos(angle) * dist
      const tz = Math.sin(angle) * dist
      if (tx > 4 && tz > 4) continue // Keep harbor clear
      const ty = dist < 7.5 ? 7.6 : dist < 11.2 ? 5.4 : 2.1
      const scale = 0.72 + rng() * 0.52
      if (rng() > 0.38) {
        buildCypressTree(tx, ty, tz, scale, rng)
      } else {
        buildOliveTree(tx, ty, tz, scale, rng)
      }
    }

    // Cypress Avenue along Windmill Ridge
    for (let i = 0; i < 8; i++) {
      buildCypressTree(
        -7.2 - i * 0.7,
        7.75,
        0.4 + (i % 2) * 3.2,
        0.85 + rng() * 0.35,
        rng,
      )
    }

    // ------------------------------------------------------------------------
    // J. Soaring Seagull Flock
    // ------------------------------------------------------------------------
    const gullMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.5,
    })
    const wingTipMat = new THREE.MeshStandardMaterial({
      color: 0x2b3440,
      roughness: 0.6,
    })

    for (let g = 0; g < 10; g++) {
      const gullGroup = new THREE.Group()
      const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.36, 5),
        gullMat,
      )
      body.rotation.x = Math.PI / 2
      gullGroup.add(body)

      const leftWing = new THREE.Group()
      const lwMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.025, 0.14),
        g % 2 === 0 ? gullMat : wingTipMat,
      )
      lwMesh.position.x = -0.21
      leftWing.add(lwMesh)
      gullGroup.add(leftWing)

      const rightWing = new THREE.Group()
      const rwMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.42, 0.025, 0.14),
        g % 2 === 0 ? gullMat : wingTipMat,
      )
      rwMesh.position.x = 0.21
      rightWing.add(rwMesh)
      gullGroup.add(rightWing)

      townRoot.add(gullGroup)
      seagulls.push({
        group: gullGroup,
        leftWing,
        rightWing,
        center: new THREE.Vector3(
          (rng() - 0.5) * 8,
          14.5 + rng() * 5.5,
          (rng() - 0.5) * 8,
        ),
        radius: 5.5 + rng() * 7.5,
        phase: (g / 10) * Math.PI * 2,
        speed: 0.55 + rng() * 0.35,
        heightOffset: rng() * Math.PI * 2,
      })
    }
  }

  // --------------------------------------------------------------------------
  // 8. Atmosphere, Lighting & Lantern State Synchronization
  // --------------------------------------------------------------------------
  const syncAtmosphereAndLights = (state: TownSceneState) => {
    const atm = ATMOSPHERES[state.timeOfDay]
    skyMat.uniforms.topColor!.value.setHex(atm.skyTop)
    skyMat.uniforms.bottomColor!.value.setHex(atm.skyBottom)
    fog.color.setHex(atm.fogColor)

    sunLight.color.setHex(atm.sunColor)
    sunLight.intensity = atm.sunIntensity

    // Position sun according to sunAngle (degrees above/below horizon)
    const elevationRad = THREE.MathUtils.degToRad(
      THREE.MathUtils.clamp(state.sunAngle, -35, 85),
    )
    const sunAzimuth = 0.68
    const sunDist = 48
    sunLight.position.set(
      Math.cos(elevationRad) * Math.cos(sunAzimuth) * sunDist,
      Math.max(6, Math.sin(Math.abs(elevationRad)) * sunDist),
      Math.cos(elevationRad) * Math.sin(sunAzimuth) * sunDist,
    )

    hemiLight.color.setHex(atm.ambientSky)
    hemiLight.groundColor.setHex(atm.ambientGround)
    hemiLight.intensity = atm.ambientIntensity

    waterMat.color.setHex(atm.waterShallow)
    seabedMat.color.setHex(atm.waterDeep)
    starMat.opacity = atm.starOpacity

    const lanternsActive = state.lanternsLit
    const winEmissive = lanternsActive ? 1.65 : 0.08
    for (const mat of windowEmissiveMaterials) {
      mat.emissiveIntensity = winEmissive
    }
    const bulbEmissive = lanternsActive ? 2.5 : 0.15
    for (const mat of lanternBulbMaterials) {
      mat.emissiveIntensity = bulbEmissive
    }
    if (lighthouseBeamMat !== null) {
      lighthouseBeamMat.opacity = lanternsActive ? 0.18 : 0.0
    }

    piazzaGlowLight.intensity = lanternsActive ? 2.4 : 0.0
    duomoGlowLight.intensity = lanternsActive ? 2.1 : 0.0
    harborGlowLight.intensity = lanternsActive ? 2.5 : 0.0
    fireflyMat.opacity = lanternsActive ? 0.82 : 0.15

    // Selected District 3D Beacon
    if (state.selectedDistrict._tag === 'Some') {
      const center = DISTRICT_CENTERS[state.selectedDistrict.value]
      beaconGroup.position.copy(center)
      beaconGroup.visible = true
    } else {
      beaconGroup.visible = false
    }
  }

  // Initial build
  buildTownScene(currentState.seed, currentState.palette)
  syncAtmosphereAndLights(currentState)

  // --------------------------------------------------------------------------
  // 9. Pointer Orbit, Pan, Zoom & 3D Landmark Click Raycasting
  // --------------------------------------------------------------------------
  let isDragging = false
  let dragButton = 0
  let pointerDownX = 0
  let pointerDownY = 0
  let lastPointerX = 0
  let lastPointerY = 0
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const onPointerDown = (e: PointerEvent) => {
    if (isPaused) return
    isDragging = true
    dragButton = e.button
    pointerDownX = e.clientX
    pointerDownY = e.clientY
    lastPointerX = e.clientX
    lastPointerY = e.clientY
    renderer.domElement.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: PointerEvent) => {
    if (isPaused || !isDragging) return
    const dx = e.clientX - lastPointerX
    const dy = e.clientY - lastPointerY
    lastPointerX = e.clientX
    lastPointerY = e.clientY

    if (dragButton === 2 || e.shiftKey) {
      // Pan target
      const panScale = 0.032 / currentZoom
      const forward = new THREE.Vector3(
        -Math.sin(currentAzimuth),
        0,
        -Math.cos(currentAzimuth),
      )
      const right = new THREE.Vector3(
        Math.cos(currentAzimuth),
        0,
        -Math.sin(currentAzimuth),
      )
      desiredTarget.addScaledVector(right, -dx * panScale)
      desiredTarget.addScaledVector(forward, dy * panScale)
    } else {
      // Orbit isometric angle
      desiredAzimuth -= dx * 0.0065
      desiredPolar = THREE.MathUtils.clamp(
        desiredPolar - dy * 0.005,
        Math.PI * 0.16,
        Math.PI * 0.43,
      )
    }
  }

  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return
    isDragging = false
    renderer.domElement.style.cursor = 'grab'

    const moveDist = Math.hypot(
      e.clientX - pointerDownX,
      e.clientY - pointerDownY,
    )
    if (moveDist < 5 && e.button === 0 && !isPaused) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(districtClickTargets, true)
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0]!.object
        while (obj !== null) {
          const districtId = obj.userData?.districtId as DistrictId | undefined
          if (districtId !== undefined) {
            onSelectDistrict(districtId)
            break
          }
          obj = obj.parent
        }
      }
    }
  }

  const onWheel = (e: WheelEvent) => {
    if (isPaused) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    desiredZoom = THREE.MathUtils.clamp(desiredZoom * factor, 0.58, 2.65)
  }

  const onContextMenu = (e: MouseEvent) => e.preventDefault()

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
  renderer.domElement.addEventListener('contextmenu', onContextMenu)

  // ResizeObserver for responsive container
  const resizeObserver = new ResizeObserver(() => {
    if (disposed) return
    const w = Math.max(container.clientWidth, 320)
    const h = Math.max(container.clientHeight, 320)
    const asp = w / h
    camera.left = (-frustumSize * asp) / 2
    camera.right = (frustumSize * asp) / 2
    camera.top = frustumSize / 2
    camera.bottom = -frustumSize / 2
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  })
  resizeObserver.observe(container)

  // --------------------------------------------------------------------------
  // 10. Real-Time 60fps Animation Loop
  // --------------------------------------------------------------------------
  let animationFrameId = 0
  let lastTime = performance.now()
  let elapsed = 0

  const animate = (now: number) => {
    if (disposed) return
    animationFrameId = requestAnimationFrame(animate)

    const dt = Math.min((now - lastTime) / 1000, 0.1)
    lastTime = now

    if (!isPaused) {
      elapsed += dt
      const wind = Math.max(0.2, currentState.windBreeze)

      // 1. Auto-orbit camera smoothly
      if (currentState.autoOrbit && !isDragging) {
        desiredAzimuth += dt * 0.11
      }

      // Smoothly damp camera spherical coords & zoom
      const damp = 1 - Math.exp(-dt * 6.5)
      currentAzimuth = THREE.MathUtils.lerp(currentAzimuth, desiredAzimuth, damp)
      currentPolar = THREE.MathUtils.lerp(currentPolar, desiredPolar, damp)
      currentZoom = THREE.MathUtils.lerp(currentZoom, desiredZoom, damp)
      currentTarget.lerp(desiredTarget, damp)

      camera.position.set(
        currentTarget.x +
          cameraRadius * Math.sin(currentPolar) * Math.sin(currentAzimuth),
        currentTarget.y + cameraRadius * Math.cos(currentPolar),
        currentTarget.z +
          cameraRadius * Math.sin(currentPolar) * Math.cos(currentAzimuth),
      )
      camera.lookAt(currentTarget)
      if (Math.abs(camera.zoom - currentZoom) > 0.0005) {
        camera.zoom = currentZoom
        camera.updateProjectionMatrix()
      }

      // 2. Animate Mediterranean Sea Waves
      const waterPos = waterGeo.attributes.position!
      for (let i = 0; i < waterPos.count; i++) {
        const bx = waterBasePos[i * 3]!
        const bz = waterBasePos[i * 3 + 2]!
        const dist = Math.hypot(bx, bz)
        const wave1 =
          Math.sin(bx * 0.32 + elapsed * 1.65 * wind) *
          Math.cos(bz * 0.28 + elapsed * 1.35 * wind) *
          0.14
        const wave2 = Math.sin(dist * 0.55 - elapsed * 2.1) * 0.07
        waterPos.setY(i, wave1 + wave2)
      }
      waterPos.needsUpdate = true
      waterGeo.computeVertexNormals()

      // 3. Rotate Windmill Sails
      if (windmillRotorGroup !== null) {
        windmillRotorGroup.rotation.z -= dt * 0.95 * wind
      }

      // 4. Rotate Faro Lighthouse Beam
      if (lighthouseBeamGroup !== null) {
        lighthouseBeamGroup.rotation.y += dt * 0.72
      }

      // 5. Sway Cypresses & Olive Trees in the Breeze
      for (const tree of swayingTrees) {
        const sway =
          Math.sin(elapsed * tree.speed * wind + tree.phase) * 0.032 * wind
        tree.mesh.rotation.z = tree.baseRotZ + sway
        tree.mesh.rotation.x = tree.baseRotX + sway * 0.6
      }

      // 6. Animate Moored & Sailing Gozzo Boats
      for (const boat of boats) {
        if (boat.mode === 'moored') {
          boat.group.position.y =
            boat.basePos.y + Math.sin(elapsed * 2.1 + boat.phase) * 0.07
          boat.group.rotation.z =
            Math.sin(elapsed * 1.8 + boat.phase) * 0.065
          boat.group.rotation.x =
            Math.cos(elapsed * 1.5 + boat.phase) * 0.045
        } else {
          const t = elapsed * boat.speed + boat.phase
          const nx =
            boat.orbitCenter.x + Math.cos(t) * boat.orbitRadiusX
          const nz =
            boat.orbitCenter.z + Math.sin(t) * boat.orbitRadiusZ
          const dx = -Math.sin(t) * boat.orbitRadiusX
          const dz = Math.cos(t) * boat.orbitRadiusZ
          boat.group.position.set(
            nx,
            0.06 + Math.sin(elapsed * 2.4 + boat.phase) * 0.06,
            nz,
          )
          boat.group.rotation.y = Math.atan2(dx, dz)
          boat.group.rotation.z = Math.sin(elapsed * 2.0 + boat.phase) * 0.05
        }
      }

      // 7. Animate Soaring Seagulls (with bell-chime excitement boost)
      const gullBoost = bellChimeTimer > 0 ? 1.85 : 1.0
      for (const gull of seagulls) {
        const gt = elapsed * gull.speed * gullBoost + gull.phase
        const gx = gull.center.x + Math.cos(gt) * gull.radius
        const gz = gull.center.z + Math.sin(gt) * gull.radius
        const gy =
          gull.center.y +
          Math.sin(elapsed * 1.2 + gull.heightOffset) * 0.85 +
          (bellChimeTimer > 0 ? Math.sin(bellChimeTimer * 2) * 1.4 : 0)
        gull.group.position.set(gx, gy, gz)
        gull.group.rotation.y = -gt
        const flap = Math.sin(elapsed * 9.5 * gullBoost + gull.phase * 3) * 0.52
        gull.leftWing.rotation.z = flap
        gull.rightWing.rotation.z = -flap
      }

      // 8. Animate Rising Chimney Smoke Puffs
      for (const puff of smokePuffs) {
        puff.progress = (puff.progress + dt * puff.speed) % 1
        const p = puff.progress
        puff.mesh.position.set(
          puff.origin.x + Math.sin(elapsed * 1.5 + p * 4) * 0.35 + p * 0.45 * wind,
          puff.origin.y + p * 2.2,
          puff.origin.z + Math.cos(elapsed * 1.2 + p * 3) * 0.25,
        )
        const s = 0.55 + p * 1.35
        puff.mesh.scale.setScalar(s)
        const mat = puff.mesh.material as THREE.MeshBasicMaterial
        mat.opacity = (1 - p) * 0.42
      }

      // 9. Animate Piazza Fountain Water Droplets
      for (const drop of fountainDrops) {
        drop.progress = (drop.progress + dt * 1.15) % 1
        const p = drop.progress
        const r = 0.12 + p * 0.72
        const y = 1.05 + Math.sin(p * Math.PI) * 0.75 - p * 0.65
        drop.mesh.position.set(
          Math.cos(drop.angle) * r,
          y,
          Math.sin(drop.angle) * r,
        )
      }

      // 10. Animate Campanile Bell & Golden Acoustic Rings
      if (bellChimeTimer > 0) {
        bellChimeTimer = Math.max(0, bellChimeTimer - dt)
        if (campanileBellGroup !== null) {
          campanileBellGroup.rotation.z =
            Math.sin(elapsed * 14) * 0.55 * Math.min(1, bellChimeTimer)
        }
        for (const ring of chimeRings) {
          ring.progress = (ring.progress + dt * 0.65) % 1
          const scale = 1 + ring.progress * 14
          ring.mesh.scale.setScalar(scale)
          ring.mat.opacity = (1 - ring.progress) * 0.72 * Math.min(1, bellChimeTimer)
        }
      } else {
        if (campanileBellGroup !== null) {
          campanileBellGroup.rotation.z *= 0.9
        }
        for (const ring of chimeRings) {
          ring.mat.opacity = 0
        }
      }

      // 11. Animate District Selection Beacon
      if (beaconGroup.visible) {
        beaconDiamond.rotation.y += dt * 1.8
        beaconDiamond.position.y = 1.1 + Math.sin(elapsed * 3.2) * 0.2
        beaconRing.rotation.z -= dt * 0.8
      }

      // 12. Drift Fireflies
      const ffPos = fireflyGeo.attributes.position!
      for (let i = 0; i < fireflyCount; i++) {
        const py = ffPos.getY(i)
        const phase = fireflyPhases[i]!
        ffPos.setY(i, py + Math.sin(elapsed * 1.6 + phase) * 0.006)
      }
      ffPos.needsUpdate = true
    }

    renderer.render(scene, camera)
  }

  animationFrameId = requestAnimationFrame(animate)

  // --------------------------------------------------------------------------
  // 11. Controller API
  // --------------------------------------------------------------------------
  const controller: IsometricTownController = {
    applyState: (nextState: TownSceneState) => {
      const prevState = currentState
      currentState = { ...nextState }

      // Rebuild town geometry if seed or palette changed
      if (
        prevState.seed !== nextState.seed ||
        prevState.palette !== nextState.palette
      ) {
        buildTownScene(nextState.seed, nextState.palette)
      }

      // Update camera preset target if cameraPreset changed
      if (prevState.cameraPreset !== nextState.cameraPreset) {
        const preset = CAMERA_PRESETS[nextState.cameraPreset]
        desiredTarget.copy(preset.target)
        desiredAzimuth = preset.azimuth
        desiredPolar = preset.polar
        desiredZoom = preset.zoom
      }

      // If selectedDistrict changed to Some, gently focus towards it
      if (
        nextState.selectedDistrict._tag === 'Some' &&
        (prevState.selectedDistrict._tag === 'None' ||
          prevState.selectedDistrict.value !== nextState.selectedDistrict.value)
      ) {
        const center = DISTRICT_CENTERS[nextState.selectedDistrict.value]
        desiredTarget.copy(center).add(new THREE.Vector3(0, -1.5, 0))
        desiredZoom = Math.max(desiredZoom, 1.48)
      } else if (
        nextState.selectedDistrict._tag === 'None' &&
        prevState.selectedDistrict._tag === 'Some'
      ) {
        const preset = CAMERA_PRESETS[nextState.cameraPreset]
        desiredTarget.copy(preset.target)
        desiredZoom = preset.zoom
      }

      if (nextState.bellsRinging && !prevState.bellsRinging) {
        bellChimeTimer = 3.8
      }

      syncAtmosphereAndLights(nextState)
    },

    triggerBellChime: () => {
      bellChimeTimer = 3.8
    },

    setPaused: (paused: boolean) => {
      isPaused = paused
    },

    dispose: () => {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(animationFrameId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      renderer.dispose()
      if (activeController === controller) {
        activeController = null
      }
    },
  }

  activeController = controller
  return controller
}
