// Ragdoll bodies and joints for the two humanoid rigs, in unscaled avatar-local rest coordinates (+Z forward, feet near y = 0).
// `node` names the rig group each body drives, `pivot` is that group's rest origin, `center`/`half` describe the box body,
// and `anchor` (defaults to `pivot`) is where the joint to `parent` sits. Revolute limits use the rig's rotation.x signs:
// negative swings a limb forward, positive swings it back.
const side = (name, x, parts) => parts.map(p => ({ ...p, name: p.name.replace('*', name), node: p.node.replace('*', name), parent: p.parent?.replace('*', name), pivot: [p.pivot[0] * x, p.pivot[1], p.pivot[2]], center: [p.center[0] * x, p.center[1], p.center[2]], anchor: p.anchor && [p.anchor[0] * x, p.anchor[1], p.anchor[2]] }));
const limbs = ({ shoulder, elbow, hand, hip, knee, foot, arm, leg }) => ['left', 'right'].flatMap(name => side(name, name === 'left' ? -1 : 1, [
  { name: '*-upper-arm', node: '*-shoulder', parent: 'torso', pivot: [arm, shoulder, 0], center: [arm, (shoulder + elbow) / 2, 0], half: [0.14, (shoulder - elbow) / 2, 0.16], joint: 'spherical' },
  { name: '*-forearm', node: '*-elbow', parent: '*-upper-arm', pivot: [arm, elbow, 0], center: [arm, (elbow + hand) / 2, 0], half: [0.13, (elbow - hand) / 2, 0.15], joint: 'revolute', limits: [-2.4, 0] },
  { name: '*-thigh', node: '*-hip', parent: 'torso', pivot: [leg, hip, 0], center: [leg, (hip + knee) / 2, 0], half: [0.17, (hip - knee) / 2, 0.2], joint: 'revolute', limits: [-1.8, 0.5] },
  { name: '*-shin', node: '*-knee', parent: '*-thigh', pivot: [leg, knee, 0], center: [leg, (knee + foot) / 2, 0.06], half: [0.19, (knee - foot) / 2, 0.24], joint: 'revolute', limits: [0, 2.4] },
]));

export const RAGDOLLS = {
  // src/streetNpc.js: the avatar root sits 0.15 above the ground.
  npc: {
    lift: 0.15,
    parts: [
      { name: 'torso', node: 'hips', pivot: [0, 1.35, 0], center: [0, 1.765, 0], half: [0.45, 0.535, 0.29] },
      { name: 'head', node: 'neck', parent: 'torso', pivot: [0, 2.3, 0], center: [0, 2.66, 0], half: [0.33, 0.34, 0.31], joint: 'revolute', limits: [-0.8, 0.8] },
      ...limbs({ arm: 0.6, shoulder: 2.15, elbow: 1.69, hand: 1.09, leg: 0.24, hip: 1.23, knee: 0.73, foot: 0.02 }),
    ],
  },
  // src/character.js (player): the avatar root sits 0.2 above the ground.
  player: {
    lift: 0.2,
    parts: [
      { name: 'torso', node: 'body', pivot: [0, 0, 0], center: [0, 1.835, 0], half: [0.44, 0.605, 0.27] },
      { name: 'head', node: 'head', parent: 'torso', pivot: [0, 2.65, 0], center: [0, 2.68, 0], anchor: [0, 2.42, 0], half: [0.31, 0.33, 0.3], joint: 'revolute', limits: [-0.8, 0.8] },
      ...limbs({ arm: 0.57, shoulder: 2.13, elbow: 1.73, hand: 1.14, leg: 0.23, hip: 1.25, knee: 0.72, foot: 0 }),
    ],
  },
};
