import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  BoxGeometry,
  CapsuleGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Mesh,
  MeshStandardMaterial,
  Scene,
  Shape,
  ShapeGeometry,
} from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// Node does not provide FileReader, which GLTFExporter uses for binary output.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const scene = new Scene();
scene.name = 'COL_Geo_PlayerPack';
const materials = {
  wrapper: new MeshStandardMaterial({
    name: 'ReferencePack_Blue',
    color: '#2812d6',
    metalness: 0.35,
    roughness: 0.22,
  }),
  foil: new MeshStandardMaterial({
    name: 'ReferencePack_Chrome',
    color: '#c5c7d4',
    metalness: 0.65,
    roughness: 0.24,
  }),
  rib: new MeshStandardMaterial({
    name: 'ReferencePack_Rib',
    color: '#5142fc',
    metalness: 0.38,
    roughness: 0.17,
  }),
  gleam: new MeshStandardMaterial({
    name: 'ReferencePack_RibGleam',
    color: '#bbb3ff',
    metalness: 0.12,
    roughness: 0.18,
  }),
};

function add(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = `SM_${name}`;
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function bar(name, width, height, depth, material, x, y, z) {
  return add(name, new BoxGeometry(width, height, depth), material, x, y, z);
}

function roundedRectangle(width, height, radius) {
  const x = -width / 2;
  const y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

const seal = new ExtrudeGeometry(roundedRectangle(3, 4.24, 0.13), {
  depth: 0.23,
  bevelEnabled: true,
  bevelThickness: 0.035,
  bevelSize: 0.018,
  bevelSegments: 3,
  steps: 1,
  curveSegments: 6,
});
seal.translate(0, 0, -0.21);
add('PlayerPack_SilverSeal', seal, materials.foil);

const cushion = new ExtrudeGeometry(roundedRectangle(2.79, 4.04, 0.18), {
  depth: 0.11,
  bevelEnabled: true,
  bevelThickness: 0.045,
  bevelSize: 0.03,
  bevelSegments: 3,
  steps: 1,
  curveSegments: 6,
});
cushion.translate(0, 0, 0.045);
add('PlayerPack_GlossyWrapper', cushion, materials.wrapper);

const face = new ShapeGeometry(roundedRectangle(2.67, 3.88, 0.15), 6);
// The runtime's canvas map flips V, so these UVs keep the brand upright.
const uv = face.getAttribute('uv');
const position = face.getAttribute('position');
for (let i = 0; i < uv.count; i++) {
  uv.setXY(i, (position.getX(i) + 1.335) / 2.67, 1 - (position.getY(i) + 1.94) / 3.88);
}
add(
  'StudioPack_ReferenceFace',
  face,
  new MeshStandardMaterial({
    name: 'StudioPack_ArtworkPlaceholder',
    color: '#2911ce',
    side: DoubleSide,
  }),
  0,
  0,
  0.205,
);

const edgeArtwork = new ShapeGeometry(roundedRectangle(3, 4.24, 0.13), 6);
const edgeUv = edgeArtwork.getAttribute('uv');
const edgePosition = edgeArtwork.getAttribute('position');
for (let i = 0; i < edgeUv.count; i++) {
  edgeUv.setXY(i, (edgePosition.getX(i) + 1.5) / 3, 1 - (edgePosition.getY(i) + 2.12) / 4.24);
}
add(
  'StudioPack_ReferenceSeal',
  edgeArtwork,
  new MeshStandardMaterial({
    name: 'StudioPack_SealArtworkPlaceholder',
    color: '#ffffff',
    transparent: true,
    opacity: 0,
  }),
  0,
  0,
  0.212,
);

for (const sign of [-1, 1]) {
  const edge = sign < 0 ? 'Bottom' : 'Top';
  for (let i = 0; i < 5; i++) {
    const y = sign * ((sign > 0 ? 1.58 : 1.66) + i * 0.047);
    const rib = add(
      `PlayerPack_${edge}Rib_${i}`,
      new CapsuleGeometry(0.018, 2.52, 4, 10),
      materials.rib,
      0,
      y,
      0.226,
    );
    rib.rotation.z = Math.PI / 2;
    bar(`PlayerPack_${edge}Glint_${i}`, 2.48, 0.006, 0.003, materials.gleam, 0, y + 0.019, 0.235);
  }
}

const output = await new GLTFExporter().parseAsync(scene, { binary: true, onlyVisible: true });
const destination = fileURLToPath(
  new URL('../public/models/futhub-standard-pack.glb', import.meta.url),
);
await writeFile(destination, Buffer.from(output));
console.log(`Exported ${destination} (${output.byteLength} bytes)`);
