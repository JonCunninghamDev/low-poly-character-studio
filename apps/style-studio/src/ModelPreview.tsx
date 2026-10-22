import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function ModelPreview({
  url,
  clip,
  paused,
  onClips,
}: {
  url: string;
  clip: string | null;
  paused: boolean;
  onClips: (names: string[]) => void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const playback = useRef({ clip, paused });
  playback.current = { clip, paused };
  const [error, setError] = useState("");
  useEffect(() => {
    const host = mount.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError(
        "The 3D preview needs WebGL. You can still download your validated model.",
      );
      return;
    }
    setError("");
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(0, 0.15, 3.3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x536277, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 4, 5);
    scene.add(light);
    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let disposed = false,
      frame = 0;
    let mixer: THREE.AnimationMixer | null = null;
    let active: THREE.AnimationAction | null = null;
    let previous: string | null | undefined;
    const actions = new Map<string, THREE.AnimationAction>();
    const release = (model: THREE.Object3D) =>
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = mesh.material
          ? Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material]
          : [];
        materials.forEach((material) => {
          Object.values(material).forEach((value) => {
            if (value instanceof THREE.Texture) value.dispose();
          });
          material.dispose();
        });
      });
    new GLTFLoader().load(
      url,
      (gltf) => {
        if (disposed) {
          release(gltf.scene);
          return;
        }
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const center = box.getCenter(new THREE.Vector3()),
          size = box.getSize(new THREE.Vector3());
        const scale = 1.8 / (Math.max(size.x, size.y, size.z) || 1);
        gltf.scene.scale.setScalar(scale);
        gltf.scene.position.copy(center.multiplyScalar(-scale));
        scene.add(gltf.scene);
        mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((item) =>
          actions.set(item.name, mixer!.clipAction(item)),
        );
        onClips([...actions.keys()]);
      },
      undefined,
      () => {
        if (!disposed)
          setError(
            "The model preview could not load. Try converting again or download the validated file.",
          );
      },
    );
    const clock = new THREE.Clock();
    const render = () => {
      frame = requestAnimationFrame(render);
      const current = playback.current;
      if (previous !== current.clip && mixer) {
        active?.stop();
        active = current.clip ? (actions.get(current.clip) ?? null) : null;
        active?.reset().play();
        previous = current.clip;
      }
      const delta = clock.getDelta();
      if (!current.paused) mixer?.update(delta);
      controls.update();
      renderer.render(scene, camera);
    };
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      mixer?.stopAllAction();
      release(scene);
      renderer.dispose();
      host.replaceChildren();
    };
  }, [url, onClips]);
  return (
    <div
      className="minimalModelPreview"
      ref={mount}
      aria-label="Generated 3D model"
    >
      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
