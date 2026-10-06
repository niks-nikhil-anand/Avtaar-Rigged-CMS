import { defaultPoseId, findPose, type Euler3, type PoseDefinition } from "./poses";

export type PoseAxis = "pitch" | "yaw" | "roll";
const axisIndex: Record<PoseAxis, number> = { pitch: 0, yaw: 1, roll: 2 };
export const customPoseId = "custom";

/** Smoothly drives whole-body bone offsets and a root shift toward a target pose. Framework-independent. */
export class PoseController {
  private target = new Map<string, Euler3>();
  private current = new Map<string, Euler3>();
  private root = { x: 0, y: 0 };
  private rootTarget = { x: 0, y: 0 };
  private motion: NonNullable<PoseDefinition["motion"]> = [];
  private time = 0;
  id: string;
  version = 0;

  constructor(initial: string = defaultPoseId) {
    this.id = initial;
    this.apply(findPose(initial), true);
  }

  private apply(pose: PoseDefinition, snap: boolean): void {
    this.target = new Map(Object.entries(pose.bones).map(([name, value]) => [name, [...value] as Euler3]));
    this.rootTarget = { x: pose.root?.x ?? 0, y: pose.root?.y ?? 0 };
    this.motion = pose.motion ?? [];
    if (snap) {
      this.current = new Map([...this.target].map(([name, value]) => [name, [...value] as Euler3]));
      this.root = { ...this.rootTarget };
    }
    this.version++;
  }

  setPose(id: string): boolean {
    const pose = findPose(id);
    if (pose.id !== id) return false;
    this.id = id;
    this.apply(pose, false);
    return true;
  }

  /** Immediate return to a preset, with no transition. */
  reset(id: string = defaultPoseId): void {
    this.id = id;
    this.time = 0;
    this.apply(findPose(id), true);
  }

  setCustom(bone: string, axis: PoseAxis, value: number): void {
    if (!bone || !Number.isFinite(value)) return;
    const next = [...(this.target.get(bone) ?? [0, 0, 0])] as Euler3;
    next[axisIndex[axis]] = value;
    this.target.set(bone, next);
    // Moving a slider turns the active preset into an editable custom pose, and a custom pose has no scripted motion.
    this.id = customPoseId;
    this.motion = [];
    this.version++;
  }

  setRoot(axis: "x" | "y", value: number): void {
    if (!Number.isFinite(value)) return;
    this.rootTarget[axis] = value;
    this.id = customPoseId;
    this.version++;
  }

  /** Replace the whole target, e.g. when loading a saved custom pose. */
  load(bones: Record<string, Euler3>, root?: { x?: number; y?: number }, snap = false): void {
    this.apply({ id: customPoseId, label: "Custom", tests: "", bones, root }, snap);
    this.id = customPoseId;
  }

  snapshot(): { bones: Record<string, Euler3>; root: { x: number; y: number } } {
    return { bones: Object.fromEntries([...this.target].map(([name, value]) => [name, [...value] as Euler3])), root: { ...this.rootTarget } };
  }

  getTarget(bone: string, axis: PoseAxis): number { return this.target.get(bone)?.[axisIndex[axis]] ?? 0; }
  getRoot(): { x: number; y: number } { return { ...this.rootTarget }; }

  update(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.time += delta;
    const alpha = 1 - Math.exp(-7 * delta);
    for (const [name, goal] of this.target) {
      const now = this.current.get(name) ?? [0, 0, 0];
      for (let i = 0; i < 3; i++) now[i] += (goal[i] - now[i]) * alpha;
      this.current.set(name, now);
    }
    // Bones that left the target return to rest.
    for (const [name, now] of this.current) {
      if (this.target.has(name)) continue;
      for (let i = 0; i < 3; i++) now[i] += (0 - now[i]) * alpha;
      if (now.every((value) => Math.abs(value) < 1e-5)) this.current.delete(name);
    }
    for (const key of ["x", "y"] as const) this.root[key] += (this.rootTarget[key] - this.root[key]) * alpha;
  }

  /** Current offset for one bone axis in radians, including scripted motion such as a wave. */
  offset(bone: string, axis: PoseAxis): number {
    const base = this.current.get(bone)?.[axisIndex[axis]] ?? 0;
    let extra = 0;
    for (const item of this.motion) if (item.bone === bone && item.axis === axis) extra += Math.sin(this.time * item.speed * Math.PI * 2) * item.amplitude;
    return base + extra;
  }

  get rootOffset(): { x: number; y: number } { return this.root; }
}
