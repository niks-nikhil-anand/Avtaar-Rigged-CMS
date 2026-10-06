import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { EyeEngine } from "../avatar/engine/EyeEngine";
import { IdleEngine } from "../avatar/engine/IdleEngine";
import { EmotionEngine } from "../avatar/engine/EmotionEngine";
import { LipSyncEngine } from "../avatar/engine/LipSyncEngine";
import { AvatarEngine } from "../avatar/engine/AvatarEngine";
import { resolveBindings } from "../avatar/model/resolveBindings";
import { emotions, boneLimit } from "../avatar/engine/behaviorConfig";

function fixture() {
  const root = new Group();
  const names = ["jawOpen", "eyeBlinkLeft", "eyeBlinkRight", "mouthSmileLeft", "mouthSmileRight", "mouthFrownLeft", "mouthFrownRight", "browInnerUp", "browDownLeft", "browDownRight", "eyeWideLeft", "eyeWideRight", "aa", "oh", "sil"];
  const meshes = ["face", "teeth"].map((name) => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.name = name;
    mesh.morphTargetDictionary = Object.fromEntries(names.map((name, index) => [name, index]));
    mesh.morphTargetInfluences = names.map(() => 0); root.add(mesh); return mesh;
  });
  for (const name of ["Head", "Neck", "LeftEye", "RightEye", "LeftArm", "RightArm", "Spine1", "Spine2"]) {
    const bone = new Bone(); bone.name = name; root.add(bone);
  }
  const bindings = resolveBindings(root); const engine = new AvatarEngine(bindings); engine.start();
  const weight = (name: string) => meshes[0].morphTargetInfluences![names.indexOf(name)];
  return { engine, bindings, meshes, weight };
}
function advance(engine: AvatarEngine, seconds = 2, fps = 60) { for (let i = 0; i < seconds * fps; i++) engine.update(1 / fps); }

test("deterministic blink closes, holds, opens, and schedules the next blink", () => {
  const eyes = new EyeEngine(() => 0);
  eyes.update(2.8, "idle", false);
  const half = eyes.update(0.045, "idle", false).blink["morph:eyeBlinkLeft"]!;
  assert.ok(Math.abs(half - 0.5) < 1e-10);
  assert.ok(eyes.update(0.045, "idle", false).blink["morph:eyeBlinkLeft"]! > 0.999);
  assert.equal(eyes.update(0.04, "idle", false).blink["morph:eyeBlinkLeft"], 1);
  eyes.update(0.19, "idle", false);
  assert.equal(eyes.update(0.02, "idle", false).blink["morph:eyeBlinkLeft"], 0);
});

test("gaze clamps targets, matches both eyes, and centers while listening/reduced motion", () => {
  const eyes = new EyeEngine(() => 0.9); eyes.setLookAt(10, -10);
  const gaze = eyes.update(0.1, "idle", false).gaze;
  assert.equal(gaze["bone:LeftEye:yaw"], 0.17); assert.equal(gaze["bone:RightEye:yaw"], 0.17);
  assert.equal(gaze["bone:LeftEye:pitch"], 0.12);
  eyes.releaseLookAt();
  assert.equal(eyes.update(0.1, "listening", false).gaze["bone:LeftEye:yaw"], 0);
  assert.equal(eyes.update(0.1, "idle", true).gaze["bone:LeftEye:yaw"], 0);
});

test("idle strength transitions smoothly and reduced motion suppresses procedural movement", () => {
  const idle = new IdleEngine(); const channels = idle.update(1, "idle", false);
  assert.ok(Math.abs(channels["bone:Head:yaw"]!) <= 0.025);
  const settling = idle.update(0.01, "listening", false);
  assert.ok(Math.abs(settling["bone:Head:yaw"]!) > 0);
  for (let i = 0; i < 300; i++) idle.update(1 / 60, "idle", true);
  const reduced = idle.update(1 / 60, "idle", true);
  assert.ok(Math.abs(reduced["bone:Head:yaw"]!) < 1e-10);
  assert.equal(idle.relaxedPose()["bone:LeftArm:pitch"], 1.1);
});

test("all emotion profiles stay bounded, neutral releases, and missing morphs are omitted", () => {
  const supported = new Set(["mouthSmileLeft", "mouthFrownLeft", "browDownLeft", "eyeWideLeft", "browInnerUp"]);
  const emotion = new EmotionEngine(supported);
  for (const name of emotions) {
    emotion.setEmotion(name, 2);
    for (const [channel, value] of Object.entries(emotion.update())) {
      assert.ok(supported.has(channel.slice(6))); assert.ok(value! >= 0 && value! <= 1);
    }
  }
  emotion.setEmotion("neutral", 0.7); assert.deepEqual(emotion.update(), {});
  assert.ok(Object.keys(emotion.update(true)).length > 0);
});

test("speaking without input stays silent, amplitude smooths, and stop releases mouth channels", () => {
  const lips = new LipSyncEngine(new Set(["jawOpen", "aa", "oh"])); lips.startSpeaking();
  assert.equal(lips.update(1 / 60)["morph:jawOpen"], 0);
  lips.setAmplitude(10); const weight = lips.update(1 / 60)["morph:jawOpen"]!;
  assert.ok(weight > 0 && weight < 0.75);
  lips.stopSpeaking(); assert.deepEqual(lips.update(1 / 60), {});
  lips.startSpeaking(); assert.equal(lips.update(1 / 60)["morph:jawOpen"], 0);
});

test("viseme mixtures are normalized and do not double the amplitude jaw opening", () => {
  const lips = new LipSyncEngine(new Set(["jawOpen", "aa", "oh"]));
  lips.startSpeaking(); lips.setAmplitude(1); lips.setViseme("aa", 1); lips.setViseme("oh", 1);
  const channels = lips.update(0.1);
  assert.equal(channels["morph:aa"], 0.5); assert.equal(channels["morph:oh"], 0.5);
  // Amplitude jaw is fully consumed by the mixture, so the jaw is just the weighted viseme opening (0.5 * 0.55 + 0.5 * 0.4), not added on top.
  assert.ok(Math.abs((channels["morph:jawOpen"] ?? NaN) - 0.475) < 1e-9);
  lips.clearVisemes(); assert.equal(lips.update(0.1)["morph:aa"], 0);
});

test("natural behavior relaxes the arms and preserves the exact original pose on reset", () => {
  const { engine, bindings } = fixture(); engine.behavior.enable(); advance(engine);
  assert.ok(bindings.bones.get("LeftArm")!.bone.rotation.x > 1);
  assert.ok(bindings.bones.get("RightArm")!.bone.rotation.x > 1);
  engine.reset(); advance(engine);
  assert.equal(engine.behavior.enabled, false); assert.equal(engine.systemCount, 0); assert.equal(engine.mixer.size, 0);
  for (const binding of bindings.bones.values()) assert.ok(binding.bone.quaternion.angleTo(binding.quaternion) < 1e-7);
  engine.behavior.enable(); advance(engine); assert.ok(bindings.bones.get("LeftArm")!.bone.rotation.x > 1);
});

test("emotion, gaze, blink, and mouth input coexist across matching facial meshes", () => {
  const { engine, weight, meshes } = fixture(); engine.behavior.enable();
  engine.behavior.setEmotion("happy", 1); engine.behavior.setState("speaking"); engine.behavior.lips.setAmplitude(0.8);
  engine.behavior.setLookAt(1, 0); advance(engine);
  assert.ok(weight("jawOpen") > 0.5); assert.ok(weight("mouthSmileLeft") > 0.69);
  assert.deepEqual(meshes[0].morphTargetInfluences, meshes[1].morphTargetInfluences);
  engine.behavior.setState("listening"); advance(engine);
  assert.equal(weight("jawOpen"), 0); assert.ok(weight("mouthSmileLeft") > 0.69);
});

test("rapid state changes clear speech and remain stable through pause and disposal", () => {
  const { engine, weight } = fixture(); engine.behavior.enable();
  for (let i = 0; i < 20; i++) {
    engine.behavior.setState("speaking"); engine.behavior.lips.setAmplitude(1); engine.update(1 / 60);
    engine.behavior.setState("thinking"); engine.update(1 / 60);
  }
  engine.behavior.setState("idle"); advance(engine);
  assert.equal(weight("jawOpen"), 0);
  engine.stop(); const time = engine.time; engine.update(0.1); assert.equal(engine.time, time);
  engine.start(); engine.dispose(); engine.behavior.enable(); assert.equal(engine.systemCount, 0);
});

test("roll offsets restore correctly and upper-arm limits do not widen head limits", () => {
  const { engine, bindings } = fixture();
  engine.setLayer("roll", { priority: 20, channels: { "bone:Head:roll": 1, "bone:LeftArm:pitch": 2 } }); advance(engine);
  assert.ok(Math.abs(bindings.bones.get("Head")!.bone.rotation.z - 0.25) < 1e-6);
  assert.ok(Math.abs(bindings.bones.get("LeftArm")!.bone.rotation.x - 1.25) < 1e-6);
  assert.equal(boneLimit("Head"), 0.25); assert.equal(boneLimit("LeftEye"), 0.18);
  engine.reset(); assert.ok(Math.abs(bindings.bones.get("Head")!.bone.rotation.z) < 1e-12);
});

test("five simulated minutes of natural behavior stay finite and within bone/morph bounds", () => {
  const { engine, bindings, meshes } = fixture(); engine.behavior.enable(); advance(engine, 300, 30);
  for (const mesh of meshes) for (const value of mesh.morphTargetInfluences!) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
  for (const [name, entry] of bindings.bones) {
    for (const [axis, value] of [["pitch", entry.bone.rotation.x], ["yaw", entry.bone.rotation.y], ["roll", entry.bone.rotation.z]] as const) assert.ok(Math.abs(value) <= boneLimit(name, axis) + 1e-6);
  }
});

test("relaxed pose and expression transitions agree at 30 and 120 frames per second", () => {
  const slow = fixture(); const fast = fixture();
  for (const item of [slow, fast]) { item.engine.behavior.enable(); item.engine.behavior.setEmotion("sad", 0.7); item.engine.behavior.setReducedMotion(true); }
  advance(slow.engine, 1, 30); advance(fast.engine, 1, 120);
  assert.ok(Math.abs(slow.weight("mouthFrownLeft") - fast.weight("mouthFrownLeft")) < 1e-12);
  assert.ok(slow.bindings.bones.get("LeftArm")!.bone.quaternion.angleTo(fast.bindings.bones.get("LeftArm")!.bone.quaternion) < 1e-7);
});
