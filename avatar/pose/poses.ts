/** Bone-local euler offsets in radians: [pitch (x), yaw (y), roll (z)]. */
export type Euler3 = [number, number, number];

export interface PoseDefinition {
  id: string;
  label: string;
  /** What the pose is meant to exercise on the rig. */
  tests: string;
  bones: Record<string, Euler3>;
  /** Shifts the whole body in model units (about 1.7 tall): y lowers a squat, x shifts weight. */
  root?: { x?: number; y?: number };
  /** Looping sinusoidal motion added on top of the pose, e.g. a wave. speed is in cycles per second. */
  motion?: { bone: string; axis: "pitch" | "yaw" | "roll"; amplitude: number; speed: number }[];
}

export const defaultPoseId = "a-pose";

// Rig conventions (bones run along local +Y): arm roll lowers (left -, right +) or raises (left +, right -); pitch swings forward.
// Thigh/forearm pitch bends forward; calf pitch is negative to bend the knee.
const armsDown = (angle: number): Record<string, Euler3> => ({ LeftUpperarm: [0, 0, -angle], RightUpperarm: [0, 0, angle] });
const armsUp = (angle: number): Record<string, Euler3> => ({ LeftUpperarm: [0, 0, angle], RightUpperarm: [0, 0, -angle] });

export const poses: PoseDefinition[] = [
  { id: "t-pose", label: "T-Pose", tests: "Full body bone alignment", bones: {} },
  { id: "a-pose", label: "A-Pose", tests: "Shoulder deformation", bones: armsDown(0.78) },
  { id: "arms-up", label: "Arms Straight Up", tests: "Shoulders, clavicles, elbows", bones: armsUp(1.45) },
  { id: "one-up-one-down", label: "One Arm Up + One Down", tests: "Asymmetrical shoulder deformation", bones: { LeftUpperarm: [0, 0, 1.45], RightUpperarm: [0, 0, 1.35] } },
  { id: "elbows-90", label: "Both Elbows Bent 90°", tests: "Elbow joints and forearms", bones: { ...armsDown(1.25), LeftForearm: [1.57, 0, 0], RightForearm: [1.57, 0, 0] } },
  { id: "hands-behind-head", label: "Hands Behind Head", tests: "Shoulders, elbows, wrists", bones: {
    LeftUpperarm: [-0.45, 0, 0.8], RightUpperarm: [-0.45, 0, -0.8], LeftForearm: [0, 0, 2.6], RightForearm: [0, 0, -2.6], LeftHand: [0, 0, 0.2], RightHand: [0, 0, -0.2],
  } },
  { id: "deep-squat", label: "Deep Squat", tests: "Hips, knees, pelvis, clothing deformation", root: { y: -0.62 }, bones: {
    LeftThigh: [1.75, 0, 0.15], RightThigh: [1.75, 0, -0.15], LeftCalf: [-2.3, 0, 0], RightCalf: [-2.3, 0, 0], LeftFoot: [0.55, 0, 0], RightFoot: [0.55, 0, 0],
    Waist: [0.25, 0, 0], Spine1: [0.2, 0, 0], LeftUpperarm: [1.4, 0, 0], RightUpperarm: [1.4, 0, 0],
  } },
  { id: "one-leg-balance", label: "One-Leg Balance", tests: "Hip, knee, ankle, weight distribution", bones: {
    ...armsUp(0.35), RightThigh: [1.55, 0, 0.1], RightCalf: [-1.9, 0, 0], Waist: [0, 0, 0.06],
  } },
  { id: "twist-head-turn", label: "Torso Twist + Head Turn", tests: "Spine, neck, head", bones: {
    ...armsDown(0.78), Waist: [0, 0.3, 0], Spine1: [0, 0.3, 0], Spine2: [0, 0.25, 0], Neck: [0, 0.3, 0], Head: [0, 0.45, 0],
  } },
  // Right hand raised in front of the body with the forearm upright, swinging side to side toward the viewer.
  { id: "wave", label: "Wave / Hand Gesture", tests: "Shoulder, elbow, wrist, fingers", bones: {
    LeftUpperarm: [0, 0, -0.78], RightUpperarm: [0.7, 0, 0.7], RightForearm: [0, 0, -2.2],
  }, motion: [{ bone: "RightForearm", axis: "roll", amplitude: 0.4, speed: 2.2 }, { bone: "RightHand", axis: "roll", amplitude: 0.25, speed: 2.2 }] },
];

export function findPose(id: string): PoseDefinition {
  return poses.find((pose) => pose.id === id) ?? poses.find((pose) => pose.id === defaultPoseId)!;
}
