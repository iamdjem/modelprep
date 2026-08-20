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
    const alpha = 0.012 + ((noise >>> 24) / 255) * 0.026;
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

function makePlateGrid(THREE, profile) {
  const segments = buildPlateGridSegments(profile);
  const group = new THREE.Group();
  const add = (points, color, opacity) => {
    if (!points.length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', pointsAttribute(THREE, points));
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })));
  };
  add(segments.minor, '#A8ABB4', 0.14);
  add(segments.major, '#BFC2CA', 0.29);
  const border = [
    [-profile.printable.width / 2, -profile.printable.depth / 2], [profile.printable.width / 2, -profile.printable.depth / 2],
    [profile.printable.width / 2, -profile.printable.depth / 2], [profile.printable.width / 2, profile.printable.depth / 2],
    [profile.printable.width / 2, profile.printable.depth / 2], [-profile.printable.width / 2, profile.printable.depth / 2],
    [-profile.printable.width / 2, profile.printable.depth / 2], [-profile.printable.width / 2, -profile.printable.depth / 2],
  ];
  add(border, '#D0D2D7', 0.34);
  return group;
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

  const rail = canvasTexture(THREE, renderer, 1600, 128, (ctx, canvas) => {
    ctx.fillStyle = '#D8D9DB';
    ctx.fillRect(0, 8, canvas.width, canvas.height - 16);
    ctx.fillStyle = '#33353B';
    ctx.textBaseline = 'middle';
    ctx.font = '600 38px Inter, ui-sans-serif, -apple-system, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText('PLA / ABS / PETG', 48, canvas.height / 2);
    ctx.font = '700 33px Inter, ui-sans-serif, -apple-system, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('HOT SURFACE', canvas.width * 0.61, canvas.height / 2);
    ctx.textAlign = 'right'; ctx.fillText('MODELPREP', canvas.width - 48, canvas.height / 2);
  });
  group.add(decalPlane(THREE, rail, width * 0.72, depth * 0.042, width * 0.07, depth * 0.49));

  const patch = canvasTexture(THREE, renderer, 256, 320, (ctx, canvas) => {
    ctx.fillStyle = '#D6D7D9';
    ctx.beginPath(); ctx.roundRect(0, 0, canvas.width, canvas.height, [0, 80, 0, 0]); ctx.fill();
    ctx.strokeStyle = 'rgba(66,68,74,0.34)'; ctx.lineWidth = 3;
    for (let i = 1; i < 4; i += 1) { const x = (canvas.width / 4) * i; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke(); }
    for (let i = 1; i < 5; i += 1) { const y = (canvas.height / 5) * i; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  });
  group.add(decalPlane(THREE, patch, width * 0.075, depth * 0.12, -width * 0.462, depth * 0.425));
  return group;
}

function makePlateControlsTexture(THREE, renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 960;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(207,210,214,0.74)';
  ctx.fillStyle = 'rgba(207,210,214,0.78)';
  ctx.lineWidth = 8;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = ['×', 'AUTO', 'LAYOUT', 'LOCK', 'SET'];
  labels.forEach((label, index) => {
    const y = 12 + index * 184;
    ctx.strokeRect(22, y, 148, 148);
    ctx.font = `700 ${label === '×' ? 66 : label.length > 5 ? 22 : 28}px Inter, ui-sans-serif, -apple-system, sans-serif`;
    ctx.fillText(label, 96, y + 77);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
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

  const applyView = useCallback((view) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const preset = buildPlateCameraPreset(worldSize, modelHeightRef.current, view);
    camera.position.set(...preset.position);
    controls.target.set(...preset.target);
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
          renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false });
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
        renderer.shadowMap.type = THREE.PCFShadowMap;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#55565E');
        sceneRoot = new THREE.Group();
        scene.add(sceneRoot);

        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, Math.max(2000, worldSize * 20));
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
          if (live) { setActiveView('custom'); setRevision((value) => value + 1); }
        });

        const plateShape = makePlateShape(THREE, profile);
        const plateTexture = makeSurfaceTexture(THREE, renderer);
        const plateDepth = profile.physical.thickness;
        const plateGeometry = new THREE.ExtrudeGeometry(plateShape, { depth: plateDepth, bevelEnabled: false, curveSegments: 16 });
        normalizePlateUvs(plateGeometry);
        const plateBase = new THREE.Mesh(
          plateGeometry,
          [
            new THREE.MeshStandardMaterial({ map: plateTexture, roughness: 0.91, metalness: 0.035 }),
            new THREE.MeshStandardMaterial({ color: '#202126', roughness: 0.74, metalness: 0.24 }),
          ],
        );
        plateBase.rotation.x = -Math.PI / 2;
        plateBase.position.y = -plateDepth;
        plateBase.receiveShadow = true;
        sceneRoot.add(plateBase);
        sceneRoot.add(makePlateGrid(THREE, profile));
        sceneRoot.add(makePlateDecals(THREE, profile, renderer));

        const controlsTexture = makePlateControlsTexture(THREE, renderer);
        const plateControls = new THREE.Mesh(
          new THREE.PlaneGeometry(worldSize * 0.08, worldSize * 0.39),
          new THREE.MeshBasicMaterial({ map: controlsTexture, transparent: true, depthWrite: false, toneMapped: false }),
        );
        plateControls.rotation.x = -Math.PI / 2;
        plateControls.position.set(profile.physical.width * 0.58, 0.16, -profile.printable.depth * 0.20);
        sceneRoot.add(plateControls);

        const numberTexture = makePlateNumberTexture(THREE, renderer);
        const plateNumber = new THREE.Mesh(
          new THREE.PlaneGeometry(worldSize * 0.15, worldSize * 0.075),
          new THREE.MeshBasicMaterial({ map: numberTexture, transparent: true, depthWrite: false, toneMapped: false }),
        );
        plateNumber.rotation.x = -Math.PI / 2;
        plateNumber.position.set(profile.physical.width * 0.56, 0.17, profile.physical.depth * 0.55);
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
        keyLight.shadow.bias = -0.00025;
        keyLight.shadow.normalBias = 0.025;
        keyLight.target.position.set(0, 0, 0);
        scene.add(keyLight);
        scene.add(keyLight.target);
        const fillLight = new THREE.DirectionalLight('#AAB9D6', 1.25);
        fillLight.position.set(-worldSize, worldSize * 0.65, -worldSize * 0.6);
        scene.add(fillLight);

        const preset = buildPlateCameraPreset(worldSize, modelHeight, 'iso');
        camera.position.set(...preset.position);
        controls.target.set(...preset.target);
        controls.saveState();
        controls.update();

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
        <div className="absolute inset-0 flex items-center justify-center mp-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(237,233,222,0.72)', background: '#55565E' }}>
          Building 3D scene…
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: '#55565E' }}>
          {fallbackSrc && <img src={fallbackSrc} alt="" className="w-1/2 h-1/2 object-contain opacity-70" />}
          <span className="mp-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: '#EDE9DE' }}>3D preview unavailable</span>
          <span className="max-w-sm px-6 text-center text-[10px]" style={{ color: 'rgba(237,233,222,0.62)' }}>{errorMessage}</span>
        </div>
      )}

      <details className="absolute top-3 right-3" style={{ color: '#EDE9DE' }}>
        <summary className="min-h-[44px] px-3 flex items-center cursor-pointer list-none mp-mono text-xs uppercase" style={{ background: 'rgba(21,23,28,0.82)', border: '1px solid rgba(237,233,222,0.18)' }}>View</summary>
        <div className="absolute right-0 top-full mt-1 w-40 p-1" style={{ background: 'rgba(21,23,28,0.92)', border: '1px solid rgba(237,233,222,0.18)' }}>
        {['iso', 'top', 'front'].map((view) => (
          <button
            key={view}
            type="button"
            className="w-full min-h-[44px] text-left mp-mono px-3 text-xs uppercase tracking-[0.08em]"
            style={{ background: activeView === view ? '#EDE9DE' : 'transparent', color: activeView === view ? '#15171C' : '#EDE9DE' }}
            onClick={() => applyView(view)}
            aria-pressed={activeView === view}
          >
            {view}
          </button>
        ))}
        <button type="button" className="w-full min-h-[44px] px-3 flex items-center gap-2 text-sm" style={{ color: '#EDE9DE' }} onClick={() => applyView('iso')} aria-label="Reset and fit 3D view" title="Reset and fit view">
          <RotateCcw size={16} /> Reset &amp; fit
        </button>
        </div>
      </details>

      <div className="absolute left-3 bottom-3 px-2.5 py-1.5 mp-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'rgba(237,233,222,0.78)', background: 'rgba(21,23,28,0.70)' }}>
        Drag rotate · right-drag pan · scroll zoom
      </div>
    </div>
  );
}
