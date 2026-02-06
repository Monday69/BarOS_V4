import React, { useRef, useLayoutEffect } from 'react'
import { useGLTF } from '@react-three/drei'

// 👇 C'EST ICI QUE TU VAS FAIRE TA LOI !
// Note le nom exact qui s'affiche dans la console quand tu cliques, 
// et assigne-lui le numéro que tu veux (0 pour la 1ère, 1 pour la 2ème...).
const ORDRE_DES_CUVES = {
  // --- 🟢 LE CERCLE EXTÉRIEUR (Sens des aiguilles d'une montre) ---
  
  "cuve10": 0,  // Cuve #1  : Celle tout en haut (Midi)
  "cuve5": 1,  // Cuve #2  : Juste à droite (1h)
  "cuve7": 2,  // Cuve #3  : Diagonale droite
  "cuve6": 3,  // Cuve #4  : ...
  "cuve11": 4,  // Cuve #5  : ...
  "cuve4": 5,  // Cuve #6  : En bas (6h)
  "cuve9": 6,  // Cuve #7  : ...
  "cuve3": 7,  // Cuve #8  : ...
  "cuve2": 8,  // Cuve #9  : ...
  "cuve1": 9,  // Cuve #10 : En haut à gauche (11h)

  // --- 🔵 LES 2 DU MILIEU ---

  "cuve12": 10, // Cuve #11 : Milieu Gauche
  "cuve8": 11, // Cuve #12 : Milieu Droite
};

export default function Machine({ onBottleSelect, config, ...props }) {
  // Charge le modèle V3
  const gltf = useGLTF('/models/machine.gltf')
  const groupRef = useRef()

  // Cherche le parent "cuve..."
  const findCuveParent = (obj) => {
    let current = obj;
    while (current) {
      if (current.name && current.name.toLowerCase().startsWith('cuve')) {
        return current;
      }
      current = current.parent;
      if (current === groupRef.current || !current) break;
    }
    return null;
  };

  // Convertit le Nom en Index (via ta liste, ou par défaut le chiffre du nom)
  const getIndex = (name) => {
    // 1. D'abord, on regarde si tu as défini un ordre manuel
    if (ORDRE_DES_CUVES.hasOwnProperty(name)) {
        return ORDRE_DES_CUVES[name];
    }

    // 2. Sinon, on prend le chiffre dans le nom (l'ancien système)
    const numberPart = name.replace(/\D/g, ''); 
    const number = parseInt(numberPart, 10);
    return !isNaN(number) ? number - 1 : null;
  };

  // LE PEINTRE 🎨
  useLayoutEffect(() => {
    const scene = gltf.scene;
    scene.traverse((obj) => {
      if (obj.isMesh) {
         const cuve = findCuveParent(obj);
         if (cuve) {
            const index = getIndex(cuve.name);
            
            if (index !== null) {
                const commande = config ? config[index] : null;

                if (!obj.userData.originalMaterial) {
                   obj.userData.originalMaterial = obj.material.clone();
                }

                if (commande && commande.color) {
                   const peinture = obj.userData.originalMaterial.clone();
                   peinture.color.set(commande.color);
                   if (obj.userData.originalMaterial.metalness) {
                       peinture.metalness = obj.userData.originalMaterial.metalness;
                   }
                   obj.material = peinture;
                } else {
                   obj.material = obj.userData.originalMaterial;
                }
            }
         }
      }
    });
  }, [config, gltf.scene]); 

  // LE CLICKER 🎯
  const handleClick = (e) => {
    e.stopPropagation();
    const cuve = findCuveParent(e.object);

    if (cuve) {
        const index = getIndex(cuve.name);
        
        // C'est ici que tu vas choper les noms pour ton mapping !
        //console.log(`🔍 OBJET: "${cuve.name}" -> INDEX ACTUEL: ${index}`);
        
        if (index !== null && onBottleSelect) {
            onBottleSelect(index);
        }
    }
  };

  return (
    <group ref={groupRef} {...props} dispose={null} onClick={handleClick}>
        <primitive object={gltf.scene} rotation={[-Math.PI / 2, 0, 0]} />
    </group>
  )
}