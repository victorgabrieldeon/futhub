import {
  AmbientLight,
  type CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { packFaceArtwork, packSealArtwork } from './pack-face-art';
import type { PackStudioDraft } from './pack-studio-model';

const packModelUrl = '/models/futhub-standard-pack.glb';
const packModelLoader = new GLTFLoader();
const packModelPromise = packModelLoader.loadAsync(packModelUrl);

function setPackMaterial(material: MeshStandardMaterial, draft: PackStudioDraft) {
  if (material.name === 'ReferencePack_Blue') {
    material.color.set(draft.color);
    material.emissive.set(draft.color);
    material.emissiveIntensity = draft.tintOpacity / 280;
  }
  if (material.name === 'ReferencePack_Blue' || material.name === 'ReferencePack_Chrome') {
    const finish = {
      foil: { metalness: 0.64, roughness: 0.28 },
      holographic: { metalness: 0.48, roughness: 0.2 },
      chrome: { metalness: 0.86, roughness: 0.1 },
    }[draft.effect];
    material.metalness = finish.metalness;
    material.roughness = finish.roughness;
  }
  if (material.name === 'ReferencePack_Chrome') {
    material.color.set('#c9cbd6');
  }
  if (material.name === 'ReferencePack_Rib') {
    material.color.set(draft.color).lerp(new Color('#ffffff'), 0.18);
  }
  if (material.name === 'ReferencePack_RibGleam') {
    material.color.set(draft.color).lerp(new Color('#ffffff'), 0.7);
  }
}

async function configurePack(
  scene: Scene,
  draft: PackStudioDraft,
  owned: Set<Material | CanvasTexture>,
) {
  const clones = new Map<Material, Material>();
  const faces: Mesh[] = [];
  const seals: Mesh[] = [];
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const clone = (source: Material) => {
      const existing = clones.get(source);
      if (existing) return existing;
      const material = source.clone();
      owned.add(material);
      clones.set(source, material);
      if (material instanceof MeshStandardMaterial) setPackMaterial(material, draft);
      return material;
    };
    node.material = Array.isArray(node.material) ? node.material.map(clone) : clone(node.material);
    if (node.name === 'SM_StudioPack_ReferenceFace') faces.push(node);
    if (node.name === 'SM_StudioPack_ReferenceSeal') seals.push(node);
  });
  for (const node of seals) {
    const map = await packSealArtwork();
    owned.add(map);
    const material = new MeshStandardMaterial({
      map,
      transparent: true,
      alphaTest: 0.01,
      side: DoubleSide,
    });
    owned.add(material);
    node.material = material;
  }
  for (const node of faces) {
    const map = await packFaceArtwork(draft);
    owned.add(map);
    const material = new MeshStandardMaterial({
      metalness: 0.42,
      map,
      roughness: 0.3,
      side: DoubleSide,
    });
    owned.add(material);
    node.material = material;
  }
}

export async function packModelImage(draft: PackStudioDraft): Promise<HTMLCanvasElement> {
  const gltf = await packModelPromise;
  const scene = new Scene();
  const pack = gltf.scene.clone(true);
  scene.add(pack);
  const owned = new Set<Material | CanvasTexture>();
  let renderer: WebGLRenderer | undefined;
  try {
    await configurePack(scene, draft, owned);

    const camera = new PerspectiveCamera(32, 600 / 800, 0.1, 100);
    camera.position.set(0.34, 0.18, 10.1);
    camera.lookAt(0, 0, 0);
    scene.add(new AmbientLight(new Color('#b8c8ff'), 2.1));
    const key = new DirectionalLight(new Color('#ffffff'), 3.5);
    key.position.set(4, 5, 8);
    scene.add(key);
    const rim = new DirectionalLight(new Color('#ffffff'), 1.15);
    rim.position.set(-4, 2, 5);
    scene.add(rim);

    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 800;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Pack snapshot canvas is unavailable.');
    renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.outputColorSpace = SRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.setSize(600, 800, false);
    renderer.render(scene, camera);
    context.drawImage(renderer.domElement, 0, 0);
    return canvas;
  } finally {
    for (const resource of owned) resource.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
}
