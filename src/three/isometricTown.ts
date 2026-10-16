import { Array, Match, Option, pipe } from 'effect'
import * as THREE from 'three'

import type { DistrictId, TownSceneState } from '../shared/domain'
import { type BuiltTownScene, buildTownArchitecture } from './architecture'
import {
  atmosphereColorsOf,
  cameraPoseOf,
  districtCenterOf,
  makeRng,
  playBellHarmonics,
} from './palettes'

export { playBellHarmonics }

export interface IsometricTownController {
  readonly applyState: (state: TownSceneState) => void
  readonly triggerBellChime: () => void
  readonly setPaused: (paused: boolean) => void
  readonly dispose: () => void
}

const activeControllerCell: {
  current: Option.Option<IsometricTownController>
} = {
  current: Option.none(),
}

export const getActiveTownController = (): Option.Option<IsometricTownController> =>
  activeControllerCell.current

const districtIdOfObject = (
  maybeObj: Option.Option<THREE.Object3D>,
): Option.Option<DistrictId> =>
  Option.flatMap(maybeObj, (obj) => {
    const tagged = Option.fromNullishOr(
      obj.userData?.districtId as DistrictId | undefined,
    )
    return Option.orElse(tagged, () =>
      districtIdOfObject(Option.fromNullishOr(obj.parent)),
    )
  })

export const mountIsometricTown = (
  container: Element,
  initialState: TownSceneState,
  onSelectDistrict: (districtId: DistrictId) => void,
): IsometricTownController => {
  Option.map(activeControllerCell.current, (existing) => {
    existing.dispose()
  })
  activeControllerCell.current = Option.none()

  const runtime = {
    currentState: { ...initialState },
    isPaused: false,
    disposed: false,
    bellChimeTimer: 0,
    isDragging: false,
    dragButton: 0,
    pointerDownX: 0,
    pointerDownY: 0,
    lastPointerX: 0,
    lastPointerY: 0,
    animationFrameId: 0,
    lastTime: performance.now(),
    elapsed: 0,
  }

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

  const initialPose = cameraPoseOf(runtime.currentState.cameraPreset)
  const cameraRig = {
    currentTarget: initialPose.target.clone(),
    desiredTarget: initialPose.target.clone(),
    currentAzimuth: initialPose.azimuth,
    desiredAzimuth: initialPose.azimuth,
    currentPolar: initialPose.polar,
    desiredPolar: initialPose.polar,
    currentZoom: initialPose.zoom,
    desiredZoom: initialPose.zoom,
    radius: 56,
  }

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
  scene.add(new THREE.Mesh(skyGeo, skyMat))

  const starCount = 320
  const starPositions = new Float32Array(starCount * 3)
  const starRng = makeRng(777)
  Array.forEach(Array.makeBy(starCount, (i) => i), (i) => {
    const theta = starRng() * Math.PI * 2
    const phi = starRng() * Math.PI * 0.44
    const r = 115
    starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    starPositions[i * 3 + 1] = r * Math.cos(phi) + 8
    starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  })
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
  const starMat = new THREE.PointsMaterial({
    color: 0xfff4d6,
    size: 2.2,
    transparent: true,
    opacity: 0.25,
    sizeAttenuation: false,
  })
  scene.add(new THREE.Points(starGeo, starMat))

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

  const piazzaGlowLight = new THREE.PointLight(0xff9d42, 2.2, 16, 1.6)
  piazzaGlowLight.position.set(1.8, 8.8, 2.2)
  scene.add(piazzaGlowLight)

  const duomoGlowLight = new THREE.PointLight(0xffae52, 2.0, 15, 1.6)
  duomoGlowLight.position.set(-1.5, 14.5, -1.8)
  scene.add(duomoGlowLight)

  const harborGlowLight = new THREE.PointLight(0xff9436, 2.4, 18, 1.5)
  harborGlowLight.position.set(8.5, 4.0, 9.2)
  scene.add(harborGlowLight)

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
  waterMesh.receiveShadow = true
  scene.add(waterMesh)

  const seabedGeo = new THREE.PlaneGeometry(130, 130)
  seabedGeo.rotateX(-Math.PI / 2)
  const seabedMat = new THREE.MeshBasicMaterial({ color: 0x0b2c40 })
  const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat)
  seabedMesh.position.y = -1.6
  scene.add(seabedMesh)

  const townRoot = new THREE.Group()
  scene.add(townRoot)

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

  const beaconDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.38, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xff9e1b,
      emissiveIntensity: 0.9,
      roughness: 0.2,
    }),
  )
  beaconDiamond.position.y = 1.1
  beaconGroup.add(beaconDiamond)
  beaconGroup.visible = false
  scene.add(beaconGroup)

  const fireflyCount = 85
  const fireflyPositions = new Float32Array(fireflyCount * 3)
  const fireflyPhases = new Float32Array(fireflyCount)
  const ffRng = makeRng(909)
  Array.forEach(Array.makeBy(fireflyCount, (i) => i), (i) => {
    const angle = ffRng() * Math.PI * 2
    const rad = 2 + ffRng() * 14
    fireflyPositions[i * 3] = Math.cos(angle) * rad
    fireflyPositions[i * 3 + 1] = 2.0 + ffRng() * 12.5
    fireflyPositions[i * 3 + 2] = Math.sin(angle) * rad
    fireflyPhases[i] = ffRng() * Math.PI * 2
  })
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
  scene.add(new THREE.Points(fireflyGeo, fireflyMat))

  const architectureCell: { current: BuiltTownScene } = {
    current: buildTownArchitecture(
      townRoot,
      runtime.currentState.seed,
      runtime.currentState.palette,
      runtime.currentState.lanternsLit,
    ),
  }

  const syncAtmosphereAndLights = (state: TownSceneState): void => {
    const atm = atmosphereColorsOf(state.timeOfDay)
    skyMat.uniforms.topColor!.value.setHex(atm.skyTop)
    skyMat.uniforms.bottomColor!.value.setHex(atm.skyBottom)
    fog.color.setHex(atm.fogColor)

    sunLight.color.setHex(atm.sunColor)
    sunLight.intensity = atm.sunIntensity

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
    Array.forEach(architectureCell.current.windowEmissiveMaterials, (mat) => {
      mat.emissiveIntensity = winEmissive
    })

    const bulbEmissive = lanternsActive ? 2.5 : 0.15
    Array.forEach(architectureCell.current.lanternBulbMaterials, (mat) => {
      mat.emissiveIntensity = bulbEmissive
    })

    Option.map(architectureCell.current.lighthouseBeamMat, (beamMat) => {
      beamMat.opacity = lanternsActive ? 0.18 : 0.0
    })

    piazzaGlowLight.intensity = lanternsActive ? 2.4 : 0.0
    duomoGlowLight.intensity = lanternsActive ? 2.1 : 0.0
    harborGlowLight.intensity = lanternsActive ? 2.5 : 0.0
    fireflyMat.opacity = lanternsActive ? 0.82 : 0.15

    Option.match(state.selectedDistrict, {
      onNone: () => {
        beaconGroup.visible = false
      },
      onSome: (districtId) => {
        beaconGroup.position.copy(districtCenterOf(districtId))
        beaconGroup.visible = true
      },
    })
  }

  syncAtmosphereAndLights(runtime.currentState)

  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()

  const onPointerDown = (e: PointerEvent): void => {
    if (runtime.isPaused) return
    runtime.isDragging = true
    runtime.dragButton = e.button
    runtime.pointerDownX = e.clientX
    runtime.pointerDownY = e.clientY
    runtime.lastPointerX = e.clientX
    runtime.lastPointerY = e.clientY
    renderer.domElement.style.cursor = 'grabbing'
  }

  const onPointerMove = (e: PointerEvent): void => {
    if (runtime.isPaused || !runtime.isDragging) return
    const dx = e.clientX - runtime.lastPointerX
    const dy = e.clientY - runtime.lastPointerY
    runtime.lastPointerX = e.clientX
    runtime.lastPointerY = e.clientY

    if (runtime.dragButton === 2 || e.shiftKey) {
      const panScale = 0.032 / cameraRig.currentZoom
      const forward = new THREE.Vector3(
        -Math.sin(cameraRig.currentAzimuth),
        0,
        -Math.cos(cameraRig.currentAzimuth),
      )
      const right = new THREE.Vector3(
        Math.cos(cameraRig.currentAzimuth),
        0,
        -Math.sin(cameraRig.currentAzimuth),
      )
      cameraRig.desiredTarget.addScaledVector(right, -dx * panScale)
      cameraRig.desiredTarget.addScaledVector(forward, dy * panScale)
    } else {
      cameraRig.desiredAzimuth -= dx * 0.0065
      cameraRig.desiredPolar = THREE.MathUtils.clamp(
        cameraRig.desiredPolar - dy * 0.005,
        Math.PI * 0.16,
        Math.PI * 0.43,
      )
    }
  }

  const onPointerUp = (e: PointerEvent): void => {
    if (!runtime.isDragging) return
    runtime.isDragging = false
    renderer.domElement.style.cursor = 'grab'

    const moveDist = Math.hypot(
      e.clientX - runtime.pointerDownX,
      e.clientY - runtime.pointerDownY,
    )
    if (moveDist < 5 && e.button === 0 && !runtime.isPaused) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointerNdc, camera)
      const hits = raycaster.intersectObjects(
        [...architectureCell.current.districtClickTargets],
        true,
      )
      const maybeDistrict = pipe(
        Option.fromNullishOr(hits[0]),
        Option.map((hit) => hit.object),
        districtIdOfObject,
      )
      Option.map(maybeDistrict, onSelectDistrict)
    }
  }

  const onWheel = (e: WheelEvent): void => {
    if (runtime.isPaused) return
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.92 : 1.08
    cameraRig.desiredZoom = THREE.MathUtils.clamp(
      cameraRig.desiredZoom * factor,
      0.58,
      2.65,
    )
  }

  const onContextMenu = (e: MouseEvent): void => {
    e.preventDefault()
  }

  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('wheel', onWheel, { passive: false })
  renderer.domElement.addEventListener('contextmenu', onContextMenu)

  const resizeObserver = new ResizeObserver(() => {
    if (runtime.disposed) return
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

  const animate = (now: number): void => {
    if (runtime.disposed) return
    runtime.animationFrameId = requestAnimationFrame(animate)

    const dt = Math.min((now - runtime.lastTime) / 1000, 0.1)
    runtime.lastTime = now

    if (!runtime.isPaused) {
      runtime.elapsed += dt
      const elapsed = runtime.elapsed
      const wind = Math.max(0.2, runtime.currentState.windBreeze)
      const arch = architectureCell.current

      if (runtime.currentState.autoOrbit && !runtime.isDragging) {
        cameraRig.desiredAzimuth += dt * 0.11
      }

      const damp = 1 - Math.exp(-dt * 6.5)
      cameraRig.currentAzimuth = THREE.MathUtils.lerp(
        cameraRig.currentAzimuth,
        cameraRig.desiredAzimuth,
        damp,
      )
      cameraRig.currentPolar = THREE.MathUtils.lerp(
        cameraRig.currentPolar,
        cameraRig.desiredPolar,
        damp,
      )
      cameraRig.currentZoom = THREE.MathUtils.lerp(
        cameraRig.currentZoom,
        cameraRig.desiredZoom,
        damp,
      )
      cameraRig.currentTarget.lerp(cameraRig.desiredTarget, damp)

      camera.position.set(
        cameraRig.currentTarget.x +
          cameraRig.radius *
            Math.sin(cameraRig.currentPolar) *
            Math.sin(cameraRig.currentAzimuth),
        cameraRig.currentTarget.y +
          cameraRig.radius * Math.cos(cameraRig.currentPolar),
        cameraRig.currentTarget.z +
          cameraRig.radius *
            Math.sin(cameraRig.currentPolar) *
            Math.cos(cameraRig.currentAzimuth),
      )
      camera.lookAt(cameraRig.currentTarget)
      if (Math.abs(camera.zoom - cameraRig.currentZoom) > 0.0005) {
        camera.zoom = cameraRig.currentZoom
        camera.updateProjectionMatrix()
      }

      const waterPos = waterGeo.attributes.position!
      Array.forEach(Array.makeBy(waterPos.count, (i) => i), (i) => {
        const bx = waterBasePos[i * 3]!
        const bz = waterBasePos[i * 3 + 2]!
        const dist = Math.hypot(bx, bz)
        const wave1 =
          Math.sin(bx * 0.32 + elapsed * 1.65 * wind) *
          Math.cos(bz * 0.28 + elapsed * 1.35 * wind) *
          0.14
        const wave2 = Math.sin(dist * 0.55 - elapsed * 2.1) * 0.07
        waterPos.setY(i, wave1 + wave2)
      })
      waterPos.needsUpdate = true
      waterGeo.computeVertexNormals()

      Option.map(arch.windmillRotorGroup, (rotor) => {
        rotor.rotation.z -= dt * 0.95 * wind
      })

      Option.map(arch.lighthouseBeamGroup, (beam) => {
        beam.rotation.y += dt * 0.72
      })

      Array.forEach(arch.swayingTrees, (tree) => {
        const sway =
          Math.sin(elapsed * tree.speed * wind + tree.phase) * 0.032 * wind
        tree.mesh.rotation.z = tree.baseRotZ + sway
        tree.mesh.rotation.x = tree.baseRotX + sway * 0.6
      })

      Array.forEach(arch.boats, (boat) => {
        Match.value(boat.mode).pipe(
          Match.when('moored', () => {
            boat.group.position.y =
              boat.basePos.y + Math.sin(elapsed * 2.1 + boat.phase) * 0.07
            boat.group.rotation.z =
              Math.sin(elapsed * 1.8 + boat.phase) * 0.065
            boat.group.rotation.x =
              Math.cos(elapsed * 1.5 + boat.phase) * 0.045
          }),
          Match.when('sailing', () => {
            const t = elapsed * boat.speed + boat.phase
            const nx = boat.orbitCenter.x + Math.cos(t) * boat.orbitRadiusX
            const nz = boat.orbitCenter.z + Math.sin(t) * boat.orbitRadiusZ
            const dx = -Math.sin(t) * boat.orbitRadiusX
            const dz = Math.cos(t) * boat.orbitRadiusZ
            boat.group.position.set(
              nx,
              0.06 + Math.sin(elapsed * 2.4 + boat.phase) * 0.06,
              nz,
            )
            boat.group.rotation.y = Math.atan2(dx, dz)
            boat.group.rotation.z = Math.sin(elapsed * 2.0 + boat.phase) * 0.05
          }),
          Match.exhaustive,
        )
      })

      const gullBoost = runtime.bellChimeTimer > 0 ? 1.85 : 1.0
      Array.forEach(arch.seagulls, (gull) => {
        const gt = elapsed * gull.speed * gullBoost + gull.phase
        const gx = gull.center.x + Math.cos(gt) * gull.radius
        const gz = gull.center.z + Math.sin(gt) * gull.radius
        const gy =
          gull.center.y +
          Math.sin(elapsed * 1.2 + gull.heightOffset) * 0.85 +
          (runtime.bellChimeTimer > 0
            ? Math.sin(runtime.bellChimeTimer * 2) * 1.4
            : 0)
        gull.group.position.set(gx, gy, gz)
        gull.group.rotation.y = -gt
        const flap =
          Math.sin(elapsed * 9.5 * gullBoost + gull.phase * 3) * 0.52
        gull.leftWing.rotation.z = flap
        gull.rightWing.rotation.z = -flap
      })

      Array.forEach(arch.smokePuffs, (puff) => {
        puff.progress = (puff.progress + dt * puff.speed) % 1
        const p = puff.progress
        puff.mesh.position.set(
          puff.origin.x +
            Math.sin(elapsed * 1.5 + p * 4) * 0.35 +
            p * 0.45 * wind,
          puff.origin.y + p * 2.2,
          puff.origin.z + Math.cos(elapsed * 1.2 + p * 3) * 0.25,
        )
        puff.mesh.scale.setScalar(0.55 + p * 1.35)
        const mat = puff.mesh.material as THREE.MeshBasicMaterial
        mat.opacity = (1 - p) * 0.42
      })

      Array.forEach(arch.fountainDrops, (drop) => {
        drop.progress = (drop.progress + dt * 1.15) % 1
        const p = drop.progress
        const r = 0.12 + p * 0.72
        const y = 1.05 + Math.sin(p * Math.PI) * 0.75 - p * 0.65
        drop.mesh.position.set(
          Math.cos(drop.angle) * r,
          y,
          Math.sin(drop.angle) * r,
        )
      })

      if (runtime.bellChimeTimer > 0) {
        runtime.bellChimeTimer = Math.max(0, runtime.bellChimeTimer - dt)
        Option.map(arch.campanileBellGroup, (bell) => {
          bell.rotation.z =
            Math.sin(elapsed * 14) * 0.55 * Math.min(1, runtime.bellChimeTimer)
        })
        Array.forEach(arch.chimeRings, (ring) => {
          ring.progress = (ring.progress + dt * 0.65) % 1
          ring.mesh.scale.setScalar(1 + ring.progress * 14)
          ring.mat.opacity =
            (1 - ring.progress) * 0.72 * Math.min(1, runtime.bellChimeTimer)
        })
      } else {
        Option.map(arch.campanileBellGroup, (bell) => {
          bell.rotation.z *= 0.9
        })
        Array.forEach(arch.chimeRings, (ring) => {
          ring.mat.opacity = 0
        })
      }

      if (beaconGroup.visible) {
        beaconDiamond.rotation.y += dt * 1.8
        beaconDiamond.position.y = 1.1 + Math.sin(elapsed * 3.2) * 0.2
        beaconRing.rotation.z -= dt * 0.8
      }

      const ffPos = fireflyGeo.attributes.position!
      Array.forEach(Array.makeBy(fireflyCount, (i) => i), (i) => {
        const py = ffPos.getY(i)
        const phase = fireflyPhases[i]!
        ffPos.setY(i, py + Math.sin(elapsed * 1.6 + phase) * 0.006)
      })
      ffPos.needsUpdate = true
    }

    renderer.render(scene, camera)
  }

  runtime.animationFrameId = requestAnimationFrame(animate)

  const controller: IsometricTownController = {
    applyState: (nextState: TownSceneState): void => {
      const prevState = runtime.currentState
      runtime.currentState = { ...nextState }

      if (
        prevState.seed !== nextState.seed ||
        prevState.palette !== nextState.palette
      ) {
        architectureCell.current = buildTownArchitecture(
          townRoot,
          nextState.seed,
          nextState.palette,
          nextState.lanternsLit,
        )
      }

      if (prevState.cameraPreset !== nextState.cameraPreset) {
        const pose = cameraPoseOf(nextState.cameraPreset)
        cameraRig.desiredTarget.copy(pose.target)
        cameraRig.desiredAzimuth = pose.azimuth
        cameraRig.desiredPolar = pose.polar
        cameraRig.desiredZoom = pose.zoom
      }

      Option.match(nextState.selectedDistrict, {
        onNone: () => {
          if (Option.isSome(prevState.selectedDistrict)) {
            const pose = cameraPoseOf(nextState.cameraPreset)
            cameraRig.desiredTarget.copy(pose.target)
            cameraRig.desiredZoom = pose.zoom
          }
        },
        onSome: (districtId) => {
          const changed =
            Option.isNone(prevState.selectedDistrict) ||
            prevState.selectedDistrict.value !== districtId
          if (changed) {
            cameraRig.desiredTarget
              .copy(districtCenterOf(districtId))
              .add(new THREE.Vector3(0, -1.5, 0))
            cameraRig.desiredZoom = Math.max(cameraRig.desiredZoom, 1.48)
          }
        },
      })

      if (nextState.bellsRinging && !prevState.bellsRinging) {
        runtime.bellChimeTimer = 3.8
      }

      syncAtmosphereAndLights(nextState)
    },

    triggerBellChime: (): void => {
      runtime.bellChimeTimer = 3.8
      playBellHarmonics()
    },

    setPaused: (paused: boolean): void => {
      runtime.isPaused = paused
    },

    dispose: (): void => {
      if (runtime.disposed) return
      runtime.disposed = true
      cancelAnimationFrame(runtime.animationFrameId)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      renderer.domElement.removeEventListener('contextmenu', onContextMenu)
      renderer.dispose()
      activeControllerCell.current = Option.none()
    },
  }

  activeControllerCell.current = Option.some(controller)
  return controller
}
