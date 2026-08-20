import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  buildPlateCameraPreset,
  buildPlateGridSegments,
  orientStlForBuildPlate,
  resolveBuildPlateProfile,
} from '../lib/interactive-build-plate.js';

function makePlateShape(THREE, profile) {
  const shape = new THREE.Shape();
  profile.outline.forEach(([x, y], index) => {
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  if (profile.rearSlot) {
    const { width, depth, x, y } = profile.rearSlot;
    const slot = new THREE.Path();
    slot.moveTo(x - width / 2, y - depth / 2);
    slot.lineTo(x + width / 2, y - depth / 2);
    slot.lineTo(x + width / 2, y + depth / 2);
    slot.lineTo(x - width / 2, y + depth / 2);
    slot.closePath();
    shape.holes.push(slot);
  }
  return shape;
}

function normalizePlateUvs(geometry) {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  const width = Math.max(1e-6, box.max.x - box.min.x);
  const depth = Math.max(1e-6, box.max.y - box.min.y);
  for (let i = 0; i < position.count; i += 1) {
    uv.setXY(i, (position.getX(i) - box.min.x) / width, (position.getY(i) - box.min.y) / depth);
  }
  uv.needsUpdate = true;
}

function makeSurfaceTexture(THREE, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  ctx.fillStyle = '#292A31';
  ctx.fillRect(0, 0, size, size);
  let noise = 0x4d50504c;
  for (let i = 0; i < 5200; i += 1) {
    noise = (noise * 1664525 + 1013904223) >>> 0;
    const x = noise % size;
    noise = (noise * 1664525 + 1013904223) >>> 0;
    const y = noise % size;
    const alpha = 0.008 + ((noise >>> 24) / 255) * 0.016;
    ctx.fillStyle = `rgba(222,224,230,${alpha})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function pointsAttribute(THREE, points, y = 0.11) {
  const values = new Float32Array(points.flatMap(([x, z]) => [x, y, -z]));
  return new THREE.BufferAttribute(values, 3);
}

// The grid used to be hairline GL lines, which cannot anti-alias at grazing
// angles: they break into dashes and z-fight with the plate as the camera
// moves. Baking the same 10 mm/50 mm grid into a mipmapped, anisotropically
// filtered texture gives smooth lines from every angle and replaces hundreds
// of line segments with one quad.
function makePlateGrid(THREE, profile, renderer) {
  const width = profile.printable.width;
  const depth = profile.printable.depth;
  const size = 2048;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const sx = size / width;
  const sy = size / depth;
  const line = (x1, y1, x2, y2, cssWidth, style) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = cssWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  const minorPx = Math.max(1.5, sx * 0.28);
  const majorPx = Math.max(2.5, sx * 0.5);
  // The outermost gridlines are the border's job: stroking them centred on the
  // canvas edge clipped half the line and doubled up with the frame, which read
  // as a ragged plate rim. Interior lines only, then one inset frame.
  const borderPx = majorPx * 1.2;
  for (let index = 0, x = 0; x <= width + 1e-6; index += 1, x += 10) {
    if (x <= 1e-6 || x >= width - 1e-6) continue;
    line(x * sx, borderPx, x * sx, size - borderPx, index % 5 === 0 ? majorPx : minorPx, index % 5 === 0 ? 'rgba(191,194,202,0.55)' : 'rgba(168,171,180,0.30)');
  }
  for (let index = 0, y = 0; y <= depth + 1e-6; index += 1, y += 10) {
    if (y <= 1e-6 || y >= depth - 1e-6) continue;
    line(borderPx, y * sy, size - borderPx, y * sy, index % 5 === 0 ? majorPx : minorPx, index % 5 === 0 ? 'rgba(191,194,202,0.55)' : 'rgba(168,171,180,0.30)');
  }
  ctx.strokeStyle = 'rgba(208,210,215,0.7)';
  ctx.lineWidth = borderPx;
  ctx.strokeRect(borderPx, borderPx, size - borderPx * 2, size - borderPx * 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.12;
  mesh.renderOrder = 1;
  return mesh;
}

function canvasTexture(THREE, renderer, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, canvas);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function decalPlane(THREE, texture, width, height, x, z) {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.14, z);
  mesh.renderOrder = 2;
  return mesh;
}

function makePlateDecals(THREE, profile, renderer) {
  const group = new THREE.Group();
  const width = profile.printable.width;
  const depth = profile.printable.depth;
  const label = canvasTexture(THREE, renderer, 1024, 96, (ctx, canvas) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(232,233,235,0.84)';
    ctx.font = '600 42px Inter, ui-sans-serif, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('ModelPrep Textured PEI Plate', 18, canvas.height / 2);
  });
  const labelMesh = decalPlane(THREE, label, depth * 0.62, width * 0.055, -width * 0.455, 0);
  labelMesh.rotation.z = Math.PI / 2;
  group.add(labelMesh);

  // Real plates carry pale silkscreen print on the dark sheet. The old bright
  // white band hugged the front edge and read as a thick plate rim.
  const rail = canvasTexture(THREE, renderer, 1600, 128, (ctx, canvas) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(214,216,222,0.5)';
    ctx.textBaseline = 'middle';
    ctx.font = '600 38px Inter, ui-sans-serif, -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('PLA / ABS / PETG', 48, canvas.height / 2);
    ctx.font = '700 33px Inter, ui-sans-serif, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('HOT SURFACE', canvas.width * 0.61, canvas.height / 2);
    ctx.textAlign = 'right'; ctx.fillText('MODELPREP', canvas.width - 48, canvas.height / 2);
  });
  group.add(decalPlane(THREE, rail, width * 0.72, depth * 0.042, width * 0.07, depth * 0.462));

  const patch = canvasTexture(THREE, renderer, 256, 320, (ctx, canvas) => {
    ctx.fillStyle = 'rgba(210,212,216,0.55)';
    ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, [0, 80, 0, 0]); ctx.fill();
    ctx.strokeStyle = 'rgba(66,68,74,0.3)'; ctx.lineWidth = 3;
    for (let i = 1; i < 4; i += 1) { const x = (canvas.width / 4) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let i = 1; i < 5; i += 1) { const y = (canvas.height / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  });
  group.add(decalPlane(THREE, patch, width * 0.075, depth * 0.12, -width * 0.44, depth * 0.4));
  return group;
}

function makePlateNumberTexture(THREE, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00C853';
  ctx.font = '800 94px Inter, ui-sans-serif, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('01', canvas.width / 2, canvas.height / 2 + 5);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function disposeObject(root) {
  root?.traverse?.((node) => {
    node.geometry?.dispose?.();
    const disposeMaterial = (material) => {
      material?.map?.dispose?.();
      material?.dispose?.();
    };
    if (Array.isArray(node.material)) node.material.forEach(disposeMaterial);
    else disposeMaterial(node.material);
  });
}

export default function InteractiveBuildPlate({
  triangles, sourceFile, format, plateSize, fallbackSrc, name, printer = '',
  displayMode = 'solid', sectionEnabled = false, selectedPart = null, selectedPlate = null, onPartsDiscovered = null,
}) {
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const modelRootRef = useRef(null);
  const threeRef = useRef(null);
  const modelHeightRef = useRef(0);
  const requestRenderRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [revision, setRevision] = useState(0);
  const [activeView, setActiveView] = useState('iso');
  const profile = useMemo(() => resolveBuildPlateProfile({ printer, fallbackSize: plateSize }), [plateSize, printer]);
  const worldSize = Math.max(profile.physical.width, profile.physical.depth);

  const modelRadiusRef = useRef(0);
  const [hintSeen, setHintSeen] = useState(false);
  const applyView = useCallback((view) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const preset = buildPlateCameraPreset(worldSize, modelHeightRef.current, view);
    const radius = modelRadiusRef.current;
    if (radius > 0) {
      // Frame the model, not the plate: a 30 mm part on a 256 mm sheet used to
      // reset to a speck. Distance follows the model's bounding sphere, with
      // the plate as the floor and ceiling of the zoom.
      const target = [0, Math.min(modelHeightRef.current * 0.45, radius), 0];
      const dir = [
        preset.position[0] - preset.target[0],
        preset.position[1] - preset.target[1],
        preset.position[2] - preset.target[2],
      ];
      const len = Math.hypot(...dir) || 1;
      const distance = Math.min(worldSize * 2.4, Math.max(radius * 3.4, worldSize * 0.34));
      camera.position.set(
        target[0] + (dir[0] / len) * distance,
        target[1] + (dir[1] / len) * distance,
        target[2] + (dir[2] / len) * distance,
      );
      controls.target.set(...target);
    } else {
      camera.position.set(...preset.position);
      controls.target.set(...preset.target);
    }
    controls.update();
    requestRenderRef.current?.();
    setActiveView(view);
    setRevision((value) => value + 1);
  }, [worldSize]);

  useEffect(() => {
    const root = modelRootRef.current;
    const renderer = rendererRef.current;
    const THREE = threeRef.current;
    if (!root || !THREE) return;
    if (renderer) renderer.localClippingEnabled = sectionEnabled;
    const clippingPlane = sectionEnabled ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), modelHeightRef.current * 0.52)] : [];
    root.traverse((node) => {
      if (!node.isMesh) return;
      const partVisible = !selectedPart || node.userData.modelprepPartId === selectedPart;
      const plateVisible = !selectedPlate || !node.userData.modelprepPlate || node.userData.modelprepPlate === selectedPlate;
      node.visible = partVisible && plateVisible;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.filter(Boolean).forEach((material) => {
        if (!material.userData.modelprepOriginal) material.userData.modelprepOriginal = {
          transparent: material.transparent,
          opacity: material.opacity,
          depthWrite: material.depthWrite,
          wireframe: material.wireframe,
        };
        const original = material.userData.modelprepOriginal;
        material.wireframe = displayMode === 'wireframe';
        material.transparent = displayMode === 'xray' ? true : original.transparent;
        material.opacity = displayMode === 'xray' ? 0.28 : original.opacity;
        material.depthWrite = displayMode === 'xray' ? false : original.depthWrite;
        material.clippingPlanes = clippingPlane;
        material.clipShadows = sectionEnabled;
        material.needsUpdate = true;
      });
    });
    requestRenderRef.current?.();
  }, [displayMode, sectionEnabled, selectedPart, selectedPlate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || (!triangles?.length && !(format === '3mf' && sourceFile?.blob))) return undefined;
    let live = true;
    let animationFrame = 0;
    let resizeObserver = null;
    let sceneRoot = null;
    let renderer = null;
    let controls = null;
    const preventMenu = (event) => event.preventDefault();
    canvas.addEventListener('contextmenu', preventMenu);
    setStatus('loading');
    setErrorMessage('');
    const threeMfSource = !triangles?.length && format === '3mf'
      ? Promise.all([import('three/addons/loaders/3MFLoader.js'), sourceFile.blob.arrayBuffer()])
      : null;

    (async () => {
      try {
        const [THREE, { OrbitControls }] = await Promise.all([
          import('three'),
          import('three/addons/controls/OrbitControls.js'),
        ]);
        if (!live) return;
        threeRef.current = THREE;

        try {
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false });
        } catch {
          // Electron intentionally disables hardware acceleration for stability.
          // A few Macs reject a high-performance context before SwiftShader is
          // selected, so retry explicitly with the least demanding context.
          renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
        }
        rendererRef.current = renderer;
        // The desktop app deliberately runs without GPU acceleration (see
        // desktop/main.js), so WebGL lands on SwiftShader: every pixel is CPU
        // work. Detect that and trade retina resolution and shadows, which are
        // barely visible at this scene scale, for a smooth orbit.
        const gpuName = (() => {
          try {
            const gl = renderer.getContext();
            const info = gl.getExtension('WEBGL_debug_renderer_info');
            return info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
          } catch { return ''; }
        })();
        const softwareGL = /swiftshader|software|llvmpipe|mesa/i.test(gpuName);
        renderer.localClippingEnabled = sectionEnabled;
        renderer.setPixelRatio(softwareGL ? 1 : Math.min(window.devicePixelRatio || 1, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.12;
        renderer.shadowMap.enabled = !softwareGL;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#55565E');
        sceneRoot = new THREE.Group();
        scene.add(sceneRoot);

        // Depth precision is the whole ballgame for a plate whose grid and
        // decals sit fractions of a millimetre above the surface: a 0.1..2000
        // range spent almost all its bits far away and let coplanar layers
        // z-fight at grazing angles. Size the range to the scene instead.
        const camera = new THREE.PerspectiveCamera(38, 1, Math.max(1, worldSize * 0.02), worldSize * 8);
        camera.up.set(0, 1, 0);
        cameraRef.current = camera;
        controls = new OrbitControls(camera, canvas);
        controlsRef.current = controls;
        controls.enableDamping = true;
        controls.dampingFactor = 0.075;
        controls.rotateSpeed = 0.72;
        controls.panSpeed = 0.8;
        controls.zoomSpeed = 0.9;
        controls.zoomToCursor = true;
        controls.screenSpacePanning = true;
        controls.minDistance = worldSize * 0.38;
        controls.maxDistance = worldSize * 4.5;
        controls.maxPolarAngle = Math.PI * 0.94;
        controls.touches.ONE = THREE.TOUCH.ROTATE;
        controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
        controls.listenToKeyEvents(canvas);
        controls.addEventListener('end', () => {
          if (live) { setActiveView('custom'); setRevision((value) => value + 1); setHintSeen(true); }
        });

        const plateShape = makePlateShape(THREE, profile);
        const plateTexture = makeSurfaceTexture(THREE, renderer);
        const plateDepth = profile.physical.thickness;
        // A rounded rim instead of a hard 90-degree edge: half the thickness is
        // the straight wall, the other half the bevel, so the total stays true.
        const plateGeometry = new THREE.ExtrudeGeometry(plateShape, {
          depth: plateDepth * 0.5,
          bevelEnabled: true,
          bevelThickness: plateDepth * 0.25,
          bevelSize: plateDepth * 0.5,
          bevelOffset: -plateDepth * 0.5,
          bevelSegments: 2,
          curveSegments: 16,
        });
        normalizePlateUvs(plateGeometry);
        const plateBase = new THREE.Mesh(
          plateGeometry,
          [
            new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.91, metalness: 0.035 }),
            new THREE.MeshStandardMaterial({ color: '#26272C', roughness: 0.6, metalness: 0.05 }),
          ],
        );
        plateBase.rotation.x = -Math.PI / 2;
        plateBase.position.y = -plateDepth;
        plateBase.receiveShadow = true;
        sceneRoot.add(plateBase);

        // A baked radial gradient under the sheet grounds it even where shadow
        // maps are off (software GL). Cheaper than a ShadowMaterial and stable
        // from every angle.
        const contactCanvas = document.createElement('canvas');
        contactCanvas.width = 256; contactCanvas.height = 256;
        const contactCtx = contactCanvas.getContext('2d');
        const contactGradient = contactCtx.createRadialGradient(128, 128, 30, 128, 128, 128);
        contactGradient.addColorStop(0, 'rgba(10,11,14,0.42)');
        contactGradient.addColorStop(0.72, 'rgba(10,11,14,0.16)');
        contactGradient.addColorStop(1, 'rgba(10,11,14,0)');
        contactCtx.fillStyle = contactGradient;
        contactCtx.fillRect(0, 0, 256, 256);
        const contactTexture = new THREE.CanvasTexture(contactCanvas);
        const contactShadow = new THREE.Mesh(
          new THREE.PlaneGeometry(profile.physical.width * 1.35, profile.physical.depth * 1.35),
          new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, toneMapped: false }),
        );
        contactShadow.rotation.x = -Math.PI / 2;
        contactShadow.position.y = -plateDepth - 0.35;
        contactShadow.renderOrder = -1;
        sceneRoot.add(contactShadow);
        sceneRoot.add(makePlateGrid(THREE, profile, renderer));
        sceneRoot.add(makePlateDecals(THREE, profile, renderer));

        // The skeuomorphic AUTO/LAYOUT/LOCK tiles floated in space beside the
        // sheet and imitated Bambu Studio's *interactive* handles, inviting
        // dead clicks. Gone. The plate number stays, painted on the sheet
        // corner like the real plates.
        const numberTexture = makePlateNumberTexture(THREE, renderer);
        const plateNumber = new THREE.Mesh(
          new THREE.PlaneGeometry(worldSize * 0.11, worldSize * 0.055),
          new THREE.MeshBasicMaterial({ map: numberTexture, transparent: true, depthWrite: false, toneMapped: false }),
        );
        plateNumber.rotation.x = -Math.PI / 2;
        plateNumber.position.set(profile.printable.width * 0.4, 0.17, profile.printable.depth * 0.43);
        plateNumber.renderOrder = 2;
        sceneRoot.add(plateNumber);

        let modelRoot;
        let modelHeight = 0;
        if (triangles?.length) {
          const oriented = orientStlForBuildPlate(triangles);
          if (!oriented) throw new Error('The STL contains no renderable triangles.');
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(oriented.positions, 3));
          geometry.computeVertexNormals();
          modelRoot = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: '#D8D4C9', roughness: 0.64, metalness: 0.04, side: THREE.DoubleSide }),
          );
          modelRoot.position.y = 0.12;
          modelRoot.castShadow = true;
          modelRoot.receiveShadow = false;
          modelHeight = oriented.height;
        } else {
          const [{ ThreeMFLoader }, buffer] = await threeMfSource;
          if (!live) return;
          modelRoot = new ThreeMFLoader().parse(buffer);
          modelRoot.rotation.x = -Math.PI / 2;
          modelRoot.updateMatrixWorld(true);
          let box = new THREE.Box3().setFromObject(modelRoot);
          const centre = box.getCenter(new THREE.Vector3());
          modelRoot.position.x -= centre.x;
          modelRoot.position.z -= centre.z;
          modelRoot.position.y += 0.12 - box.min.y;
          modelRoot.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(modelRoot);
          modelHeight = box.max.y - box.min.y;
          modelRoot.traverse((node) => {
            if (!node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = false;
            if (node.material) node.material.side = THREE.DoubleSide;
          });
        }
        modelRoot.castShadow = true;
        modelRoot.receiveShadow = false;
        modelRootRef.current = modelRoot;
        {
          const modelBox = new THREE.Box3().setFromObject(modelRoot);
          const sphere = modelBox.getBoundingSphere(new THREE.Sphere());
          modelRadiusRef.current = Number.isFinite(sphere.radius) ? sphere.radius : 0;
          // Let the user actually get close to a small part: the old floor was
          // 38% of the plate size regardless of the model.
          controls.minDistance = Math.max(3, Math.min(worldSize * 0.38, modelRadiusRef.current * 0.6));
        }
        const discoveredParts = [];
        let partIndex = 0;
        modelRoot.traverse((node) => {
          if (!node.isMesh) return;
          partIndex += 1;
          const parsedParts = sourceFile?.threemf?.parts || [];
          const parsedPart = parsedParts[Math.min(partIndex - 1, Math.max(0, parsedParts.length - 1))] || null;
          const partId = parsedPart?.id ? `object-${parsedPart.id}` : `part-${partIndex}`;
          const objectPlate = sourceFile?.threemf?.plateDetails?.find((plate) => plate.objectIds?.includes(String(parsedPart?.id)))?.index || null;
          node.userData.modelprepPartId = partId;
          node.userData.modelprepPlate = objectPlate;
          if (!discoveredParts.some((part) => part.id === partId)) discoveredParts.push({ id: partId, name: parsedPart?.name || node.name || (partIndex === 1 ? name : `${name} · Part ${partIndex}`), plate: objectPlate });
          node.visible = (!selectedPart || partId === selectedPart) && (!selectedPlate || !objectPlate || objectPlate === selectedPlate);
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          materials.filter(Boolean).forEach((material) => {
            material.userData.modelprepOriginal = {
              transparent: material.transparent,
              opacity: material.opacity,
              depthWrite: material.depthWrite,
              wireframe: material.wireframe,
            };
            material.wireframe = displayMode === 'wireframe';
            if (displayMode === 'xray') { material.transparent = true; material.opacity = 0.28; material.depthWrite = false; }
            material.clippingPlanes = sectionEnabled ? [new THREE.Plane(new THREE.Vector3(0, -1, 0), modelHeight * 0.52)] : [];
            material.clipShadows = sectionEnabled;
          });
        });
        onPartsDiscovered?.(discoveredParts);
        sceneRoot.add(modelRoot);
        modelHeightRef.current = modelHeight;

        const axes = new THREE.AxesHelper(Math.max(6, worldSize * 0.13));
        axes.position.set(-profile.printable.width * 0.43, 0.32, profile.printable.depth * 0.42);
        sceneRoot.add(axes);

        scene.add(new THREE.HemisphereLight('#E7ECFF', '#30323A', 1.85));
        const keyLight = new THREE.DirectionalLight('#FFF5E8', 3.2);
        keyLight.position.set(worldSize * 0.7, worldSize * 1.5, worldSize * 0.9);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(2048, 2048);
        // Three.js defaults to a roughly 10-unit shadow camera. On a real
        // 180–256 mm printer bed that clipped the shadow map into rectangular
        // bands and a diagonal wedge. Frame the complete physical plate and
        // its floating controls so every camera preset sees one stable map.
        const shadowExtent = worldSize * 0.82;
        keyLight.shadow.camera.left = -shadowExtent;
        keyLight.shadow.camera.right = shadowExtent;
        keyLight.shadow.camera.top = shadowExtent;
        keyLight.shadow.camera.bottom = -shadowExtent;
        keyLight.shadow.camera.near = worldSize * 0.08;
        keyLight.shadow.camera.far = worldSize * 4;
        keyLight.shadow.camera.updateProjectionMatrix();
        keyLight.shadow.bias = -0.00005;
        keyLight.shadow.normalBias = worldSize * 0.002;
        keyLight.target.position.set(0, 0, 0);
        scene.add(keyLight);
        scene.add(keyLight.target);
        const fillLight = new THREE.DirectionalLight('#AAB9D6', 1.25);
        fillLight.position.set(-worldSize, worldSize * 0.65, -worldSize * 0.6);
        scene.add(fillLight);

        {
          const preset = buildPlateCameraPreset(worldSize, modelHeight, 'iso');
          const radius = modelRadiusRef.current;
          if (radius > 0) {
            const target = [0, Math.min(modelHeight * 0.45, radius), 0];
            const dir = [preset.position[0] - preset.target[0], preset.position[1] - preset.target[1], preset.position[2] - preset.target[2]];
            const len = Math.hypot(...dir) || 1;
            const distance = Math.min(worldSize * 2.4, Math.max(radius * 3.4, worldSize * 0.34));
            camera.position.set(target[0] + (dir[0] / len) * distance, target[1] + (dir[1] / len) * distance, target[2] + (dir[2] / len) * distance);
            controls.target.set(...target);
          } else {
            camera.position.set(...preset.position);
            controls.target.set(...preset.target);
          }
          controls.saveState();
          controls.update();
        }

        const resize = () => {
          const rect = canvas.getBoundingClientRect();
          const width = Math.max(1, Math.round(rect.width));
          const height = Math.max(1, Math.round(rect.height));
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          requestRenderRef.current?.();
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        resize();

        // Render on demand, not on a permanent loop. On software WebGL a
        // continuous loop burns a CPU core doing nothing while idle; with
        // damping enabled, frames keep flowing during and briefly after an
        // interaction because controls.update() reports residual motion.
        const renderFrame = () => {
          animationFrame = 0;
          if (!live) return;
          const stillMoving = controls.update();
          renderer.render(scene, camera);
          if (stillMoving) requestRender();
        };
        const requestRender = () => {
          if (!live || animationFrame) return;
          animationFrame = requestAnimationFrame(renderFrame);
        };
        requestRenderRef.current = requestRender;
        controls.addEventListener('change', requestRender);
        requestRender();
        setStatus('ready');
      } catch (error) {
        if (live) {
          console.error('Interactive 3D preview failed', error);
          setErrorMessage(error?.message || 'The 3D renderer could not start.');
          setStatus('error');
        }
      }
    })();

    return () => {
      live = false;
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      controls?.stopListenToKeyEvents?.();
      controls?.dispose?.();
      renderer?.dispose?.();
      disposeObject(sceneRoot);
      canvas.removeEventListener('contextmenu', preventMenu);
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      requestRenderRef.current = null;
      modelRootRef.current = null;
      threeRef.current = null;
    };
  }, [format, name, onPartsDiscovered, profile, sourceFile, triangles, worldSize]);

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      data-testid="interactive-build-plate"
      data-preview-status={status}
      data-orbit-revision={revision}
      data-plate-profile={profile.id}
      data-printer={profile.printer}
      data-preview-error={errorMessage}
      style={{ background: '#55565E' }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full touch-none cursor-grab active:cursor-grabbing"
        tabIndex={0}
        aria-label={`${name} interactive 3D ${profile.plate}. Drag to rotate, right-drag to pan, and scroll to zoom.`}
      />
      <p className="sr-only" aria-live="polite">{status === 'ready' ? `${name} 3D preview ready on ${profile.printer || 'generic'} build plate. Use the view controls or keyboard to inspect it.` : status === 'error' ? `${name} 3D preview failed: ${errorMessage}` : `${name} 3D preview is loading.`}</p>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: 'rgba(255,255,255,0.75)', background: '#55565E' }}>
          Building 3D scene…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#55565E' }}>
          {fallbackSrc && <img src={fallbackSrc} alt="" className="w-1/2 h-1/2 object-contain opacity-70" />}
          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>3D preview unavailable</span>
          <span className="max-w-sm px-6 text-center text-[11px]" style={{ color: 'rgba(255,255,255,0.65)' }}>{errorMessage}</span>
        </div>
      )}

      <details className="absolute top-3 right-3">
        <summary className="min-h-[36px] px-3 flex items-center cursor-pointer list-none rounded-md text-xs font-medium" style={{ background: 'rgba(20,22,18,0.72)', color: 'rgba(255,255,255,0.92)' }}>View</summary>
        <div className="absolute right-0 top-full mt-1 w-40 p-1 rounded-lg border" style={{ background: '#FFFFFF', borderColor: 'var(--border)', boxShadow: 'var(--shadow-2)' }}>
        {[['iso', 'Isometric'], ['top', 'Top'], ['front', 'Front']].map(([view, label]) => (
          <button
            key={view}
            type="button"
            className="w-full min-h-[36px] text-left px-2.5 text-sm rounded-md transition-colors hover:bg-[var(--surface-hover)]"
            style={{ background: activeView === view ? 'var(--primary-tint)' : 'transparent', color: activeView === view ? 'var(--primary-ink)' : 'var(--ink)', fontWeight: activeView === view ? 600 : 400 }}
            onClick={() => applyView(view)}
            aria-pressed={activeView === view}
          >
            {label}
          </button>
        ))}
        <button type="button" className="w-full min-h-[36px] px-2.5 flex items-center gap-2 text-sm rounded-md transition-colors hover:bg-[var(--surface-hover)]" style={{ color: 'var(--ink)' }} onClick={() => applyView('iso')} aria-label="Reset and fit 3D view" title="Reset and fit view">
          <RotateCcw size={15} /> Reset &amp; fit
        </button>
        </div>
      </details>

      <div
        className="absolute left-3 bottom-3 px-3 py-1.5 rounded-full text-[11px] transition-opacity duration-500"
        style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(20,22,18,0.66)', opacity: hintSeen ? 0 : 1, pointerEvents: 'none' }}
        aria-hidden={hintSeen}
      >
        Drag rotate · right-drag pan · scroll zoom
      </div>
    </div>
  );
}
