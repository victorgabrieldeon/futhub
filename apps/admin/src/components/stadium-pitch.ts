import * as THREE from 'three';

export function createPitch() {
  const canvas = document.createElement('canvas');
  canvas.width = 1536;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  let seed = 73;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const grain = (seed / 4294967296 - 0.5) * 22;
      const stripe = Math.floor(x / 128) % 2 === 0 ? 0 : 9;
      const offset = (y * canvas.width + x) * 4;
      pixels.data[offset] = 55 + grain + stripe;
      pixels.data[offset + 1] = 119 + grain + stripe;
      pixels.data[offset + 2] = 71 + grain + stripe;
      pixels.data[offset + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  ctx.scale(canvas.width / 11.5, canvas.height / 7.8);
  ctx.translate(0.5, 0.5);
  ctx.strokeStyle = '#edf3e9';
  ctx.fillStyle = '#edf3e9';
  ctx.lineWidth = 0.014;
  ctx.strokeRect(0, 0, 10.5, 6.8);
  ctx.beginPath();
  ctx.moveTo(5.25, 0);
  ctx.lineTo(5.25, 6.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(5.25, 3.4, 0.915, 0, Math.PI * 2);
  ctx.stroke();
  for (const x of [0, 10.5]) {
    const sign = x === 0 ? 1 : -1;
    ctx.strokeRect(x, 1.384, sign * 1.65, 4.032);
    ctx.strokeRect(x, 2.484, sign * 0.55, 1.832);
    ctx.beginPath();
    const angle = Math.acos(0.55 / 0.915);
    ctx.arc(
      x + sign * 1.1,
      3.4,
      0.915,
      x === 0 ? -angle : Math.PI - angle,
      x === 0 ? angle : Math.PI + angle,
    );
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + sign * 1.1, 3.4, 0.025, 0, Math.PI * 2);
    ctx.fill();
    for (const y of [0, 6.8]) {
      ctx.beginPath();
      const start = x === 0 ? (y === 0 ? 0 : -Math.PI / 2) : y === 0 ? Math.PI / 2 : Math.PI;
      ctx.arc(x, y, 0.1, start, start + Math.PI / 2);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.arc(5.25, 3.4, 0.026, 0, Math.PI * 2);
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const field = new THREE.Mesh(
    new THREE.PlaneGeometry(11.5, 7.8),
    new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.96,
      bumpMap: texture,
      bumpScale: 0.012,
    }),
  );
  field.name = 'Striped turf with regulation markings';
  field.rotation.x = -Math.PI / 2;
  field.position.y = 0.025;
  field.receiveShadow = true;
  return field;
}

export function createGoal() {
  const goal = new THREE.Group();
  goal.name = 'Tubular goal with woven net';
  const paint = new THREE.MeshStandardMaterial({
    color: '#edf3e9',
    roughness: 0.42,
    metalness: 0.2,
  });
  const upright = new THREE.CylinderGeometry(0.009, 0.009, 0.244, 10);
  for (const z of [-0.366, 0.366]) {
    const post = new THREE.Mesh(upright, paint);
    post.position.set(0, 0.122, z);
    post.castShadow = true;
    goal.add(post);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.75, 12), paint);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = 0.244;
  bar.castShadow = true;
  goal.add(bar);
  const vertices: number[] = [];
  for (let z = -0.366; z <= 0.367; z += 0.025) {
    vertices.push(0, 0.244, z, 0.2, 0.244, z, 0.2, 0.244, z, 0.26, 0, z);
  }
  for (let y = 0; y <= 0.245; y += 0.0244) {
    const x = 0.26 - (y / 0.244) * 0.06;
    vertices.push(x, y, -0.366, x, y, 0.366);
    for (const z of [-0.366, 0.366]) vertices.push(0, y, z, x, y, z);
  }
  for (let x = 0.025; x < 0.2; x += 0.025) {
    vertices.push(x, 0.244, -0.366, x, 0.244, 0.366);
    for (const z of [-0.366, 0.366]) vertices.push(x, 0, z, x, 0.244, z);
  }
  const net = new THREE.BufferGeometry();
  net.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  goal.add(
    new THREE.LineSegments(
      net,
      new THREE.LineBasicMaterial({ color: '#edf3e9', transparent: true, opacity: 0.65 }),
    ),
  );
  return goal;
}
