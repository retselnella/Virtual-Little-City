import * as THREE from 'three';
import { RAGDOLLS } from '../../models/worldTour/ragdollProfiles.js';

const bodyMatrix = new THREE.Matrix4(), partOffset = new THREE.Matrix4(), partWorld = new THREE.Matrix4(), partLocal = new THREE.Matrix4();
const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();

// Drives a rig's joint groups from simulated ragdoll bodies (src/physicsEngine.js).
// Per frame: call `before(person)` before the rig's animation update, then `after(person, dt)` after it.
export function createRagdollRig(avatar, profile) {
  // Rest transforms are kept because the walk cycle only sets some joint channels (e.g. the neck never, the hips'
  // x/z position and twist never); anything a ragdoll moved must be put back before animation resumes.
  const joints = RAGDOLLS[profile].parts.map(part => ({ part, node: avatar.getObjectByName(part.node) })).filter(({ node }) => node)
    .map(joint => ({ ...joint, rest: { position: joint.node.position.clone(), quaternion: joint.node.quaternion.clone() } }));
  let ragdolled = false, blend = 1, blendFrom = null;
  return {
    joints,
    before(person) {
      if (ragdolled && !person.ragdoll) {
        ragdolled = false;
        // Standing back up blends from the landed pose; a respawned pedestrian (or a new player) starts clean.
        const standing = person.getUp > 0 && person.health !== 0;
        blendFrom = standing ? joints.map(({ node }) => ({ position: node.position.clone(), quaternion: node.quaternion.clone() })) : null;
        blend = 0;
      } else if (!blendFrom) return;
      // Reset to rest so the animation update writes a clean pose (and, while blending, a clean blend target).
      for (const { node, rest } of joints) { node.position.copy(rest.position); node.quaternion.copy(rest.quaternion); node.scale.setScalar(1); }
    },
    after(person, dt) {
      const pose = person.ragdoll;
      if (pose) {
        avatar.updateMatrixWorld(true);
        for (const { part, node } of joints) {
          const p = pose.parts[part.name]; if (!p) continue;
          bodyMatrix.compose(position.set(p[0], p[1], p[2]), quaternion.set(p[3], p[4], p[5], p[6]), scale.setScalar(pose.scale));
          partWorld.multiplyMatrices(bodyMatrix, partOffset.makeTranslation(part.pivot[0] - part.center[0], part.pivot[1] - part.center[1], part.pivot[2] - part.center[2]));
          partLocal.copy(node.parent.matrixWorld).invert().multiply(partWorld).decompose(node.position, node.quaternion, node.scale);
          node.updateMatrixWorld(true);
        }
        ragdolled = true;
        return;
      }
      if (!blendFrom || blend >= 1) return;
      blend = Math.min(1, blend + dt / 0.45);
      const t = blend * blend * (3 - 2 * blend);
      joints.forEach(({ node }, i) => {
        node.quaternion.slerpQuaternions(blendFrom[i].quaternion, quaternion.copy(node.quaternion), t);
        node.position.lerpVectors(blendFrom[i].position, position.copy(node.position), t);
      });
      if (blend >= 1) blendFrom = null;
    },
  };
}
