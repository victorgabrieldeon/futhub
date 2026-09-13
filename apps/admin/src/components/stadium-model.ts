import * as THREE from 'three';
import { createGoal, createPitch } from './stadium-pitch';

export function mountStadium(host: HTMLElement, onStatus: (status: 'ready' | 'fallback') => void) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) {
    onStatus('fallback');
    return () => {};
  }
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 100);
  camera.position.set(13, 16, 20);
  camera.lookAt(0, 0.4, 0);
  scene.add(new THREE.HemisphereLight('#cbddeb', '#617157', 2.2));
  const sun = new THREE.DirectionalLight('#fff1d8', 3.4);
  sun.position.set(-8, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -13,
    right: 13,
    top: 13,
    bottom: -13,
    near: 0.5,
    far: 50,
  });
  sun.shadow.normalBias = 0.035;
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#cbddeb', 1.2);
  fill.position.set(8, 8, -10);
  scene.add(fill);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 50),
    new THREE.ShadowMaterial({ opacity: 0.17 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.565;
  floor.receiveShadow = true;
  scene.add(floor);

  function render() {
    if (context?.isContextLost()) return;
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const halfHeight = Math.max(8.1, 11.3 / (width / height));
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.right = halfHeight * (width / height);
    camera.left = -camera.right;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    renderer.render(scene, camera);
    onStatus('ready');
  }
  const observer = new ResizeObserver(render);
  function lost(event: Event) {
    event.preventDefault();
    onStatus('fallback');
  }
  function dispose() {
    observer.disconnect();
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.removeEventListener('webglcontextrestored', render);
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) textures.add(value);
        }
      }
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    sun.shadow.dispose();
    renderer.dispose();
    canvas.remove();
  }
  try {
    scene.add(createStadium());
    host.append(canvas);
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', render);
    observer.observe(host);
    render();
  } catch (error) {
    dispose();
    throw error;
  }
  return dispose;
}

export function createStadium() {
  const stadium = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: '#89969e', roughness: 0.92 });
  const graphite = new THREE.MeshStandardMaterial({ color: '#25343e', roughness: 0.68 });
  const metal = new THREE.MeshStandardMaterial({
    color: '#c0cbd0',
    roughness: 0.4,
    metalness: 0.65,
  });
  const paint = new THREE.MeshStandardMaterial({ color: '#edf3e9', roughness: 0.64 });
  const board = new THREE.MeshStandardMaterial({ color: '#223840', roughness: 0.6 });
  const lamp = new THREE.MeshStandardMaterial({
    color: '#edf3e9',
    emissive: '#fff1d8',
    emissiveIntensity: 2,
  });

  function box(
    size: readonly [number, number, number],
    position: readonly [number, number, number],
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    stadium.add(mesh);
    return mesh;
  }

  function beam(start: THREE.Vector3, end: THREE.Vector3, radius = 0.035) {
    const direction = end.clone().sub(start);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
      metal,
    );
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    mesh.castShadow = true;
    stadium.add(mesh);
    return mesh;
  }

  box([15.3, 0.36, 11.6], [0, -0.38, 0], graphite);
  box([15.1, 0.2, 11.4], [0, -0.1, 0], concrete);
  box([11.65, 0.065, 7.95], [0, -0.015, 0], graphite);
  const pitch = createPitch();
  if (pitch) stadium.add(pitch);

  const seatMaterial = new THREE.MeshStandardMaterial({ color: '#4b5289', roughness: 0.55 });
  const seats = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.11, 0.05, 0.13),
    seatMaterial,
    2200,
  );
  const backs = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.11, 0.13, 0.025),
    seatMaterial,
    2200,
  );
  seats.name = 'Individual stadium seats';
  backs.name = 'Individual seat backs';
  const transform = new THREE.Object3D();
  const seatColors = [
    new THREE.Color('#4b5289'),
    new THREE.Color('#6878a8'),
    new THREE.Color('#edf3e9'),
  ];
  let count = 0;
  const sides = [
    { length: 11.5, distance: 4.16, rotation: 0 },
    { length: 11.5, distance: 4.16, rotation: Math.PI },
    { length: 7.7, distance: 5.96, rotation: Math.PI / 2 },
    { length: 7.7, distance: 5.96, rotation: -Math.PI / 2 },
  ];
  for (const side of sides) {
    const sideGroup = new THREE.Group();
    sideGroup.rotation.y = side.rotation;
    for (let row = 0; row < 7; row++) {
      const height = 0.12 + row * 0.17;
      const distance = side.distance + row * 0.2;
      const step = new THREE.Mesh(new THREE.BoxGeometry(side.length, height, 0.21), concrete);
      step.position.set(0, height / 2, -distance);
      step.receiveShadow = true;
      sideGroup.add(step);
      const columns = Math.floor(side.length / 0.155);
      for (let column = 0; column < columns; column++) {
        if (column % 18 < 2) continue;
        const x = (column - (columns - 1) / 2) * 0.155;
        transform.position.set(x, height + 0.055, -distance);
        transform.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, side.rotation);
        transform.rotation.set(0, side.rotation, 0);
        transform.updateMatrix();
        seats.setMatrixAt(count, transform.matrix);
        transform.position.y += 0.075;
        transform.position.x -= Math.sin(side.rotation) * 0.055;
        transform.position.z -= Math.cos(side.rotation) * 0.055;
        transform.updateMatrix();
        backs.setMatrixAt(count, transform.matrix);
        const color = seatColors[column % 18 === 3 ? 2 : row % 2];
        seats.setColorAt(count, color);
        backs.setColorAt(count, color);
        count++;
      }
    }
    const wall = new THREE.Mesh(new THREE.BoxGeometry(side.length, 1.4, 0.12), graphite);
    wall.position.set(0, 0.7, -side.distance - 1.35);
    sideGroup.add(wall);
    const advertising = new THREE.Mesh(new THREE.BoxGeometry(side.length, 0.15, 0.045), board);
    advertising.position.set(0, 0.09, -side.distance + 0.18);
    sideGroup.add(advertising);
    stadium.add(sideGroup);
  }
  seats.count = count;
  backs.count = count;
  seats.receiveShadow = true;
  backs.receiveShadow = true;
  stadium.add(seats, backs);

  for (const x of [-5.25, 5.25]) {
    const goal = createGoal();
    goal.position.set(x, 0.035, 0);
    goal.rotation.y = x < 0 ? Math.PI : 0;
    stadium.add(goal);
    for (const z of [-3.4, 3.4]) {
      beam(new THREE.Vector3(x, 0.03, z), new THREE.Vector3(x, 0.2, z), 0.006);
      box([0.08, 0.055, 0.003], [x + 0.04, 0.177, z], paint);
    }
  }

  // Back grandstand canopy: columns, diagonal steel trusses and standing-seam roof.
  for (const x of [-5.45, -3.63, -1.81, 0, 1.81, 3.63, 5.45]) {
    beam(new THREE.Vector3(x, 0, -5.52), new THREE.Vector3(x, 2.05, -5.52));
    beam(new THREE.Vector3(x, 1.58, -5.52), new THREE.Vector3(x, 1.91, -4.39), 0.024);
    beam(new THREE.Vector3(x, 2.05, -5.52), new THREE.Vector3(x, 1.91, -4.39), 0.024);
  }
  box([11.85, 0.065, 1.4], [0, 1.99, -5], metal).rotation.x = -0.1;
  box([11.95, 0.13, 0.065], [0, 1.93, -4.3], paint);
  for (let x = -5.7; x < 5.8; x += 0.24) {
    box([0.014, 0.024, 1.38], [x, 2.037, -5], metal).rotation.x = -0.1;
  }
  // Perimeter railings and corner floodlight towers, clear of the playing surface.
  for (const x of [-6.55, 6.55]) {
    for (const z of [-4.65, 4.65]) {
      box([0.32, 0.12, 0.32], [x, 0.06, z], concrete);
      for (const offset of [-0.09, 0.09]) {
        beam(new THREE.Vector3(x + offset, 0.12, z), new THREE.Vector3(x + offset, 2.85, z), 0.027);
      }
      for (let y = 0.3; y < 2.6; y += 0.4) {
        beam(new THREE.Vector3(x - 0.09, y, z), new THREE.Vector3(x + 0.09, y + 0.4, z), 0.016);
      }
      const lamps = new THREE.Group();
      lamps.position.set(x, 2.9, z);
      lamps.lookAt(0, 0, 0);
      for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 3; row++) {
          const housing = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.14, 0.08), graphite);
          housing.position.set((column - 1.5) * 0.22, (row - 1) * 0.17, 0);
          const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), lamp);
          lens.position.z = 0.042;
          housing.add(lens);
          lamps.add(housing);
        }
      }
      stadium.add(lamps);
    }
  }
  for (let x = -5.6; x <= 5.6; x += 0.7) {
    beam(new THREE.Vector3(x, 1.2, 5.52), new THREE.Vector3(x, 1.52, 5.52), 0.014);
  }
  beam(new THREE.Vector3(-5.65, 1.52, 5.52), new THREE.Vector3(5.65, 1.52, 5.52), 0.018);
  // Two dugouts with translucent curved polycarbonate shells.
  const glass = new THREE.MeshStandardMaterial({
    color: '#cbddeb',
    transparent: true,
    opacity: 0.3,
    roughness: 0.22,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  for (const x of [-1.8, 1.8]) {
    const shelter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1.1, 16, 1, true, 0, Math.PI),
      glass,
    );
    shelter.rotation.z = Math.PI / 2;
    shelter.position.set(x, 0.16, 3.87);
    stadium.add(shelter);
    box([1.04, 0.07, 0.16], [x, 0.09, 3.91], seatMaterial);
  }
  return stadium;
}
