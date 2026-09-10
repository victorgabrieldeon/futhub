import {
  CanvasTexture,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  PMREMGenerator,
  PlaneGeometry,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { type CardDesign, cardFramePaths } from './card-design';

export async function cardModelImage(
  art: CanvasImageSource,
  design: CardDesign,
  renderFrame = true,
): Promise<HTMLCanvasElement> {
  const output = document.createElement('canvas');
  output.width = 600;
  output.height = 800;
  const context = output.getContext('2d');
  if (!context) throw new Error('Canvas 2D indisponível para o modelo do card.');
  context.drawImage(art, 0, 0, 600, 800);
  if (!renderFrame) return output;

  const resources: { dispose(): void }[] = [];
  function own<T extends { dispose(): void }>(resource: T): T {
    resources.push(resource);
    return resource;
  }
  let renderer: WebGLRenderer | undefined;
  try {
    const width = Math.min(12, Math.max(4, design.frameWidth));
    const outline = cardFramePaths[design.frame];
    const { paths } = new SVGLoader().parse(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800">
        <path d="${outline}"/>
        <path d="${outline}" transform="translate(300 400) scale(${1 - width / 300} ${1 - width / 400}) translate(-300 -400)"/>
      </svg>`,
    );
    const [outerPath, innerPath] = paths;
    const ring = outerPath && SVGLoader.createShapes(outerPath)[0];
    const hole = innerPath && SVGLoader.createShapes(innerPath)[0];
    if (!ring || !hole) throw new Error('Contorno inválido para o modelo do card.');
    ring.holes.push(hole);

    const bevel = width * 0.12;
    const geometry = own(
      new ExtrudeGeometry(ring, {
        depth: 5,
        steps: 1,
        curveSegments: 32,
        bevelEnabled: true,
        bevelSegments: 4,
        bevelThickness: 2,
        bevelSize: bevel,
        bevelOffset: -bevel,
      }),
    );
    const metal = own(
      new MeshStandardMaterial({
        color: design.metalColor,
        metalness: 1,
        roughness: 0.26,
        envMapIntensity: 0.85,
      }),
    );
    const frame = new Mesh(geometry, metal);
    frame.position.z = 3;

    const texture = own(new CanvasTexture(output));
    texture.colorSpace = SRGBColorSpace;
    // SVG coordinates increase downward; the group supplies the sole Y inversion.
    texture.flipY = false;
    const artGeometry = own(new PlaneGeometry(600, 800));
    const artMaterial = own(
      new MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const surface = new Mesh(artGeometry, artMaterial);
    surface.position.set(300, 400, 0);
    const card = new Group();
    card.scale.y = -1;
    card.position.y = 800;
    card.add(surface, frame);

    const scene = new Scene();
    scene.add(card);
    const camera = new OrthographicCamera(-300, 300, 400, -400, 0.1, 2000);
    camera.position.set(300, 400, 1000);
    const key = new DirectionalLight('#fff4d6', 3.2);
    key.position.set(-300, 1100, 700);
    key.target.position.set(300, 400, 0);
    const fill = new DirectionalLight('#b8c8ff', 1.1);
    fill.position.set(950, 300, 500);
    fill.target.position.set(300, 400, 0);
    scene.add(key, key.target, fill, fill.target);

    renderer = new WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(1);
    renderer.setSize(600, 800, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
    const room = own(new RoomEnvironment());
    const pmrem = own(new PMREMGenerator(renderer));
    const environment = own(pmrem.fromScene(room, 0.04));
    scene.environment = environment.texture;
    renderer.render(scene, camera);
    if (renderer.getContext().isContextLost()) throw new Error('Contexto WebGL perdido.');
    // Concave ticket notches can intersect the scaled hole; keep the SVG silhouette exact.
    context.save();
    context.clip(new Path2D(outline));
    context.clearRect(0, 0, 600, 800);
    context.drawImage(renderer.domElement, 0, 0);
    context.restore();
    return output;
  } finally {
    for (const resource of resources.reverse()) resource.dispose();
    renderer?.dispose();
    // dispose releases GPU objects, but one-shot previews must also release their context slot.
    renderer?.forceContextLoss();
  }
}
