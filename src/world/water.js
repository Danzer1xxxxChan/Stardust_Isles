import * as THREE from 'three';
import { LAKE, WORLD_HALF } from './layout.js';

function waterMaterial(color, deep) {
  const mat = new THREE.MeshStandardMaterial({
    color, transparent: true, opacity: 0.82, roughness: 0.15, metalness: 0.05, flatShading: true,
  });
  mat.userData.uniforms = { uTime: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = mat.userData.uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(position, 1.0);
        transformed.y += sin(wp.x * 0.15 + uTime * 1.3) * 0.18 + cos(wp.z * 0.12 + uTime * 1.1) * 0.18;`);
  };
  return mat;
}

export function createWater(scene) {
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_HALF * 4, WORLD_HALF * 4, 160, 160).rotateX(-Math.PI / 2), waterMaterial(0x2f9fc2));
  sea.position.y = -0.05;
  sea.receiveShadow = true;
  scene.add(sea);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 14, 48).rotateX(-Math.PI / 2), waterMaterial(0x3fb8c8));
  lake.position.set(LAKE.x, LAKE.level - 0.05, LAKE.z);
  lake.receiveShadow = true;
  scene.add(lake);
  return {
    update(t) {
      sea.material.userData.uniforms.uTime.value = t;
      lake.material.userData.uniforms.uTime.value = t;
    },
  };
}
