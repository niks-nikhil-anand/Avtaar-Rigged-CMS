import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { PoseController, customPoseId } from "../avatar/pose/PoseController";
import { defaultPoseId, poses } from "../avatar/pose/poses";
import { AvatarEngine } from "../avatar/engine/AvatarEngine";
import { resolveBindings } from "../avatar/model/resolveBindings";

test("every preset has a unique id and the default exists", () => {
  assert.equal(new Set(poses.map((pose) => pose.id)).size, poses.length);
  assert.ok(poses.some((pose) => pose.id === defaultPoseId));
  assert.equal(poses.length, 10);
});

test("a new controller starts on the default pose without a transition", () => {
  const pose = new PoseController();
  assert.equal(pose.id, defaultPoseId);
  assert.ok(Math.abs(pose.offset("LeftUpperarm", "roll") + 0.78) < 1e-9);
  assert.ok(Math.abs(pose.offset("RightUpperarm", "roll") - 0.78) < 1e-9);
});

test("switching poses eases toward the target and then settles on it", () => {
  const pose = new PoseController();
  assert.ok(pose.setPose("arms-up"));
  pose.update(0.05);
  const early = pose.offset("LeftUpperarm", "roll");
  assert.ok(early < 0 || early > -0.78, "moved away from the old value");
  assert.ok(early < 1.45, "has not arrived yet");
  for (let i = 0; i < 200; i++) pose.update(0.1);
  assert.ok(Math.abs(pose.offset("LeftUpperarm", "roll") - 1.45) < 1e-3);
  assert.equal(pose.setPose("does-not-exist"), false);
  assert.equal(pose.id, "arms-up");
});

test("bones that leave the pose return to rest", () => {
  const pose = new PoseController("deep-squat");
  assert.ok(pose.offset("LeftThigh", "pitch") > 1);
  pose.setPose("t-pose");
  for (let i = 0; i < 200; i++) pose.update(0.1);
  assert.equal(pose.offset("LeftThigh", "pitch"), 0);
});

test("root offset follows the squat and resets immediately", () => {
  const pose = new PoseController("deep-squat");
  assert.ok(pose.rootOffset.y < -0.5);
  pose.reset();
  assert.equal(pose.id, defaultPoseId);
  assert.equal(pose.rootOffset.y, 0);
});

test("editing a slider switches to a custom pose and ignores bad input", () => {
  const pose = new PoseController();
  pose.setCustom("Head", "yaw", 0.5);
  assert.equal(pose.id, customPoseId);
  assert.equal(pose.getTarget("Head", "yaw"), 0.5);
  pose.setCustom("Head", "yaw", Number.NaN);
  assert.equal(pose.getTarget("Head", "yaw"), 0.5);
  const saved = pose.snapshot();
  const other = new PoseController("t-pose");
  other.load(saved.bones, saved.root);
  assert.equal(other.getTarget("Head", "yaw"), 0.5);
});

test("the wave oscillates around its resting angle", () => {
  const pose = new PoseController("wave");
  for (let i = 0; i < 100; i++) pose.update(0.1);
  const samples: number[] = [];
  for (let i = 0; i < 20; i++) { pose.update(0.05); samples.push(pose.offset("RightForearm", "roll")); }
  assert.ok(Math.max(...samples) - Math.min(...samples) > 0.3);
});

function bonesFixture(names: string[]) {
  const root = new Group();
  const bones = names.map((name) => { const bone = new Bone(); bone.name = name; root.add(bone); return bone; });
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  mesh.morphTargetDictionary = { jawOpen: 0 }; mesh.morphTargetInfluences = [0];
  root.add(mesh);
  return { bones, bindings: resolveBindings(root) };
}

test("the engine applies pose angles beyond the small behavior limit", () => {
  const { bones, bindings } = bonesFixture(["CC_Base_L_Upperarm"]);
  const engine = new AvatarEngine(bindings);
  engine.start(); engine.pose.setPose("arms-up");
  for (let i = 0; i < 100; i++) engine.update(0.1);
  assert.ok(Math.abs(bones[0].rotation.z - 1.45) < 0.01, `got ${bones[0].rotation.z}`);
  engine.reset();
  assert.equal(engine.pose.id, defaultPoseId);
});

test("jawOpen drives the jaw bone on rigs that open the mouth with a bone", () => {
  const { bones, bindings } = bonesFixture(["CC_Base_JawRoot"]);
  const engine = new AvatarEngine(bindings);
  engine.start(); engine.setExpression({ jawOpen: 1 }, "test", 110);
  for (let i = 0; i < 100; i++) engine.update(0.1);
  assert.ok(bones[0].rotation.z > 0.3, `jaw bone barely moved: ${bones[0].rotation.z}`);
});
