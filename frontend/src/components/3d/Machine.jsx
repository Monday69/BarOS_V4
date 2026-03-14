import React, { useRef, useLayoutEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const ORDRE_DES_CUVES = {
  "cuve10": 0,
  "cuve5":  1,
  "cuve7":  2,
  "cuve6":  3,
  "cuve11": 4,
  "cuve4":  5,
  "cuve9":  6,
  "cuve3":  7,
  "cuve2":  8,
  "cuve1":  9,
  "cuve12": 10,
  "cuve8":  11,
};

// hoveredSlot : index (0-11) de la cuve à faire briller, ou null
export default function Machine({ onBottleSelect, config, hoveredSlot = null, ...props }) {
  const gltf     = useGLTF('/models/machine.gltf')
  const groupRef = useRef()

  const findCuveParent = (obj) => {
    let current = obj;
    while (current) {
      if (current.name && current.name.toLowerCase().startsWith('cuve')) return current;
      current = current.parent;
      if (current === groupRef.current || !current) break;
    }
    return null;
  };

  const getIndex = (name) => {
    if (Object.prototype.hasOwnProperty.call(ORDRE_DES_CUVES, name)) return ORDRE_DES_CUVES[name];
    const n = parseInt(name.replace(/\D/g, ''), 10);
    return !isNaN(n) ? n - 1 : null;
  };

  // ── Peinture + émissivité ────────────────────────────────────────────────
  useLayoutEffect(() => {
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const cuve = findCuveParent(obj);
      if (!cuve) return;

      const index = getIndex(cuve.name);
      if (index === null) return;

      // Mémoriser le matériau original une seule fois
      if (!obj.userData.originalMaterial) {
        obj.userData.originalMaterial = obj.material.clone();
      }

      const commande   = config?.[index];
      const isHovered  = hoveredSlot === index;
      const isSelected = commande && commande.color;

      // Construit le matériau final
      const mat = obj.userData.originalMaterial.clone();

      if (isSelected) {
        mat.color.set(commande.color);
        if (obj.userData.originalMaterial.metalness != null) {
          mat.metalness = obj.userData.originalMaterial.metalness;
        }
      }

      // Émissivité orange si survolé
      if (isHovered) {
        mat.emissive    = new THREE.Color('#ff6600');
        mat.emissiveIntensity = 0.55;
      } else {
        mat.emissive          = new THREE.Color('#000000');
        mat.emissiveIntensity = 0;
      }

      obj.material = mat;
    });
  }, [config, hoveredSlot, gltf.scene]);

  // ── Click ────────────────────────────────────────────────────────────────
  const handleClick = (e) => {
    e.stopPropagation();
    const cuve = findCuveParent(e.object);
    if (!cuve) return;
    const index = getIndex(cuve.name);
    if (index !== null && onBottleSelect) onBottleSelect(index);
  };

  return (
    <group ref={groupRef} {...props} dispose={null} onClick={handleClick}>
      <primitive object={gltf.scene} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  );
}