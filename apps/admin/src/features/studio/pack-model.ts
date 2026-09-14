import {
  AmbientLight,
  type BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  type Material,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PackStudioDraft } from './pack-studio-model';

const packModelUrl = '/models/futhub-standard-pack.glb';
const packModelLoader = new GLTFLoader();
const packModelPromise = packModelLoader.loadAsync(packModelUrl);

function rgba(color: string, opacity: number): string {
  const normalized = color.replace('#', '');
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgb(${red} ${green} ${blue} / ${opacity}%)`;
}

function backgroundDecoration(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  const opacity = Math.min(draft.textureOpacity, 36);
  context.strokeStyle = rgba(draft.accentColor, opacity);
  context.lineWidth = 4;
  context.lineCap = 'round';
  if (draft.texture === 'mesh') {
    for (let x = 80; x < 1024; x += 96) {
      context.beginPath();
      context.moveTo(x, 210);
      context.lineTo(x, 1320);
      context.stroke();
    }
    return;
  }
  if (draft.texture === 'rings') {
    for (const radius of [180, 310, 440]) {
      context.beginPath();
      context.arc(512, 820, radius, 0, Math.PI * 2);
      context.stroke();
    }
    return;
  }
  for (const [x, y] of [
    [90, 360],
    [610, 850],
    [260, 1120],
  ] as const) {
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + 210, y - 90);
    context.lineTo(x + 340, y + 100);
    context.closePath();
    context.stroke();
  }
}

function drawTitleBanner(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  const kickerY = (331 / 800) * 1536;
  const headlineY = (draft.headlineY / 800) * 1536;
  const center = (kickerY + headlineY) / 2;
  const top = Math.max(148, center - 160);
  const bottom = Math.min(1320, center + 170);

  context.save();
  context.globalAlpha = 0.48;
  context.fillStyle = rgba(draft.accentColor, 42);
  context.beginPath();
  context.moveTo(62, center);
  context.lineTo(302, top + 32);
  context.lineTo(355, center);
  context.lineTo(302, bottom - 32);
  context.closePath();
  context.fill();
  context.beginPath();
  context.moveTo(962, center);
  context.lineTo(722, top + 32);
  context.lineTo(669, center);
  context.lineTo(722, bottom - 32);
  context.closePath();
  context.fill();
  context.globalAlpha = 1;
  context.lineWidth = 8;
  context.strokeStyle = rgba(draft.accentColor, 76);
  context.setLineDash([54, 30]);
  context.beginPath();
  context.moveTo(256, top + 8);
  context.bezierCurveTo(420, top - 18, 604, top - 18, 768, top + 8);
  context.stroke();
  context.beginPath();
  context.moveTo(256, bottom - 8);
  context.bezierCurveTo(420, bottom + 18, 604, bottom + 18, 768, bottom - 8);
  context.stroke();
  context.setLineDash([]);
  context.restore();
}

function drawFootballStamp(context: CanvasRenderingContext2D, draft: PackStudioDraft) {
  context.save();
  context.translate(512, 836);
  context.rotate(-0.16);
  context.globalAlpha = 0.22;
  context.strokeStyle = rgba(draft.accentColor, 72);
  context.fillStyle = 'rgb(1 4 15 / 38%)';
  context.lineWidth = 16;
  context.beginPath();
  context.arc(0, 0, 176, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.lineWidth = 8;
  context.beginPath();
  for (let index = 0; index < 5; index++) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    const x = Math.cos(angle) * 64;
    const y = Math.sin(angle) * 64;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.stroke();
  for (let index = 0; index < 5; index++) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 64, Math.sin(angle) * 64);
    context.lineTo(Math.cos(angle) * 142, Math.sin(angle) * 142);
    context.stroke();
  }
  context.restore();
}

function drawCartoonTitle(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: string,
  accentColor: string,
  textColor: string,
) {
  context.save();
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.letterSpacing = '0px';
  context.shadowBlur = 18;
  context.shadowColor = 'rgb(0 0 0 / 88%)';
  context.shadowOffsetY = 12;
  context.lineWidth = 11;
  context.strokeStyle = 'rgb(0 0 0 / 88%)';
  context.strokeText(text, x, y, maxWidth);
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;
  context.lineWidth = 3;
  context.strokeStyle = rgba(accentColor, 92);
  context.strokeText(text, x, y, maxWidth);
  const ink = context.createLinearGradient(0, y - 116, 0, y + 20);
  ink.addColorStop(0, '#ffffff');
  ink.addColorStop(0.28, '#fffdf6');
  ink.addColorStop(0.72, textColor);
  ink.addColorStop(1, '#cfc9bd');
  context.fillStyle = ink;
  context.fillText(text, x, y, maxWidth);
  context.restore();
}

function drawStadiumDepth(context: CanvasRenderingContext2D, accentColor: string) {
  context.save();
  const stadium = context.createLinearGradient(0, 860, 0, 1536);
  stadium.addColorStop(0, 'rgb(0 0 0 / 0%)');
  stadium.addColorStop(0.34, 'rgb(0 0 0 / 48%)');
  stadium.addColorStop(1, 'rgb(0 0 0 / 82%)');
  context.fillStyle = stadium;
  context.fillRect(0, 790, 1024, 746);
  context.strokeStyle = rgba(accentColor, 35);
  context.lineWidth = 5;
  for (let index = 0; index < 30; index += 1) {
    const x = 42 + index * 33;
    context.beginPath();
    context.arc(x, 1090, 5 + (index % 3), Math.PI, Math.PI * 2);
    context.stroke();
  }
  context.globalAlpha = 0.24;
  context.fillStyle = '#567e46';
  context.beginPath();
  context.moveTo(88, 1536);
  context.lineTo(936, 1536);
  context.lineTo(770, 1308);
  context.lineTo(254, 1308);
  context.closePath();
  context.fill();
  context.strokeStyle = 'rgb(247 243 218 / 62%)';
  context.lineWidth = 3;
  context.strokeRect(310, 1360, 404, 174);
  context.beginPath();
  context.moveTo(512, 1360);
  context.lineTo(512, 1536);
  context.stroke();
  context.restore();
}

function packFaceArtwork(draft: PackStudioDraft): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.height = 1536;
  canvas.width = 1024;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Pack artwork canvas is unavailable.');

  const body = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  body.addColorStop(0, '#020309');
  body.addColorStop(0.32, draft.color);
  body.addColorStop(0.66, '#05070d');
  body.addColorStop(1, '#010207');
  context.fillStyle = body;
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawStadiumDepth(context, draft.accentColor);
  context.save();
  context.strokeStyle = rgba(draft.accentColor, 44);
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(112, 300);
  context.lineTo(256, 224);
  context.lineTo(768, 224);
  context.lineTo(912, 300);
  context.stroke();
  context.beginPath();
  context.moveTo(112, 1204);
  context.lineTo(256, 1280);
  context.lineTo(768, 1280);
  context.lineTo(912, 1204);
  context.stroke();
  context.globalAlpha = 0.5;
  context.strokeRect(126, 174, 772, 1168);
  context.beginPath();
  context.moveTo(512, 264);
  context.lineTo(576, 328);
  context.lineTo(512, 392);
  context.lineTo(448, 328);
  context.closePath();
  context.stroke();
  context.restore();
  const glow = context.createRadialGradient(512, 980, 30, 512, 980, 520);
  glow.addColorStop(0, rgba(draft.accentColor, Math.min(draft.tintOpacity + 18, 58)));
  glow.addColorStop(1, rgba(draft.color, 0));
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);
  backgroundDecoration(context, draft);

  // ponytail: fixed-view coating; use an environment map for interactive rotation.
  const sheen = context.createLinearGradient(0, 0, 1024, draft.effect === 'chrome' ? 0 : 1536);
  switch (draft.effect) {
    case 'foil':
      sheen.addColorStop(0, rgba(draft.accentColor, 8));
      sheen.addColorStop(0.35, rgba(draft.accentColor, 24));
      sheen.addColorStop(0.5, 'rgb(255 255 255 / 42%)');
      sheen.addColorStop(0.65, rgba(draft.accentColor, 12));
      sheen.addColorStop(1, 'rgb(0 0 0 / 15%)');
      break;
    case 'holographic':
      for (let index = 0; index <= 6; index++) {
        sheen.addColorStop(index / 6, `hsl(${index * 60 + 180} 100% 65% / 42%)`);
      }
      break;
    case 'chrome':
      for (const [stop, color] of [
        [0, 'rgb(0 0 0 / 36%)'],
        [0.22, 'rgb(219 231 255 / 56%)'],
        [0.3, 'rgb(255 255 255 / 72%)'],
        [0.34, 'rgb(0 0 0 / 44%)'],
        [0.62, 'rgb(219 231 255 / 12%)'],
        [0.72, 'rgb(255 255 255 / 64%)'],
        [1, 'rgb(0 0 0 / 30%)'],
      ] as const)
        sheen.addColorStop(stop, color);
      break;
    default: {
      const effect: never = draft.effect;
      throw new Error(`Unsupported pack finish: ${effect}`);
    }
  }
  context.fillStyle = sheen;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (draft.effect === 'foil') {
    context.fillStyle = 'rgb(255 255 255 / 9%)';
    for (let y = 0; y < canvas.height; y += 6) context.fillRect(0, y, canvas.width, 1);
  }
  if (draft.effect === 'holographic') {
    for (let y = -160; y < canvas.height; y += 160) {
      for (let x = -160; x < canvas.width; x += 160) {
        context.fillStyle = `hsl(${(x + y) / 4 + 180} 100% 75% / 18%)`;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x + 160, y + 80);
        context.lineTo(x, y + 160);
        context.lineTo(x - 160, y + 80);
        context.fill();
      }
    }
  }

  const kickerX = canvas.width / 2;
  const kickerY = (331 / 800) * canvas.height;
  const headlineX = (draft.headlineX / 600) * canvas.width;
  const headlineY = (draft.headlineY / 800) * canvas.height;
  const packName = draft.kicker.toUpperCase().replace(/(\S)PACK$/, '$1 PACK');
  drawFootballStamp(context, draft);
  drawTitleBanner(context, draft);
  drawCartoonTitle(
    context,
    packName,
    headlineX,
    headlineY,
    792,
    `900 ${Math.round(Math.max(82, Math.min(draft.headlineSize * 2.15, 162)))}px Arial Black, Arial, sans-serif`,
    draft.accentColor,
    draft.textColor,
  );
  context.font = '800 34px Arial, sans-serif';
  context.letterSpacing = '10px';
  context.textAlign = 'center';
  context.shadowBlur = 6;
  context.shadowColor = 'rgb(0 0 0 / 72%)';
  context.fillStyle = rgba(draft.accentColor, 82);
  context.fillText(draft.headline.toUpperCase(), kickerX, kickerY);
  context.shadowBlur = 0;
  context.font = '700 18px Arial, sans-serif';
  context.letterSpacing = '8px';
  context.fillStyle = 'rgb(255 255 255 / 54%)';
  context.fillText('FUTURE FOOTBALL COLLECTION', canvas.width / 2, 1160);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

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
    material.color.set('#dbe7ff');
  }
  if (material.name === 'ReferencePack_White') {
    material.color.set(draft.textColor);
  }
}

function applyPlanarArtworkUv(node: Mesh, owned: Set<Material | CanvasTexture | BufferGeometry>) {
  const geometry = node.geometry.clone();
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return;

  const position = geometry.getAttribute('position');
  const width = bounds.max.x - bounds.min.x;
  const height = bounds.max.y - bounds.min.y;
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index += 1) {
    uv[index * 2] = (position.getX(index) - bounds.min.x) / width;
    uv[index * 2 + 1] = (position.getY(index) - bounds.min.y) / height;
  }
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  node.geometry = geometry;
  owned.add(geometry);
}

async function configurePack(
  scene: Scene,
  draft: PackStudioDraft,
  owned: Set<Material | CanvasTexture | BufferGeometry>,
) {
  const clones = new Map<Material, Material>();
  const faces: Mesh[] = [];
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    if (node.name === 'StudioPack_ReferenceHeadline') node.visible = false;
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
    if (node.name === 'StudioPack_ReferenceFace') {
      applyPlanarArtworkUv(node, owned);
      faces.push(node);
    }
  });
  for (const node of faces) {
    const map = packFaceArtwork(draft);
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
  const owned = new Set<Material | CanvasTexture | BufferGeometry>();
  let renderer: WebGLRenderer | undefined;
  try {
    await configurePack(scene, draft, owned);

    const camera = new PerspectiveCamera(32, 600 / 800, 0.1, 100);
    camera.position.set(0.12, 0.08, 8.7);
    camera.lookAt(0, 0, 0);
    scene.add(new AmbientLight(new Color('#b8c8ff'), 2.1));
    const key = new DirectionalLight(new Color('#ffffff'), 3.5);
    key.position.set(4, 5, 8);
    scene.add(key);
    const rim = new DirectionalLight(new Color(draft.accentColor), 2.8);
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

export async function packModelPng(draft: PackStudioDraft): Promise<Blob> {
  const canvas = await packModelImage(draft);
  const response = await fetch(canvas.toDataURL('image/png'));
  return response.blob();
}
