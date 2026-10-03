import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { resolveBindings } from "../avatar/model/resolveBindings";
import { AnimationMixer } from "../avatar/engine/AnimationMixer";
import { AvatarEngine } from "../avatar/engine/AvatarEngine";

function fixture() {
  const root = new Group();
  const meshes = [0.1, 0.25].map((initial, index) => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = `face-part-${index}`;
    mesh.morphTargetDictionary = { jawOpen: 0, mouthSmileLeft: 1, eyeBlinkLeft: 2 };
    mesh.morphTargetInfluences = [initial, 0, 0];
    root.add(mesh);
    return mesh;
  });
  const head = new Bone(); head.name = "Head"; head.rotation.set(0.1, -0.2, 0.05); head.position.set(0, 2, 0); root.add(head);
  const bindings = resolveBindings(root);
  const engine = new AvatarEngine(bindings); engine.start();
  return { engine, bindings, meshes, head };
}

function advance(engine: AvatarEngine, frames = 120, fps = 60) {
  for (let frame = 0; frame < frames; frame++) engine.update(1 / fps);
}

test("priority only overrides the channels a source supplies", () => {
  const mixer = new AnimationMixer();
  mixer.setLayer("emotion", { priority: 70, channels: { "morph:mouthSmileLeft": 0.8, "morph:jawOpen": 0.2 } });
  mixer.setLayer("speech", { priority: 90, channels: { "morph:jawOpen": 0.6 } });
  mixer.setLayer("blink", { priority: 100, channels: { "morph:eyeBlinkLeft": 1 } });
  assert.equal(mixer.resolve("morph:jawOpen"), 0.6);
  assert.equal(mixer.resolve("morph:mouthSmileLeft"), 0.8);
  assert.equal(mixer.resolve("morph:eyeBlinkLeft"), 1);
  mixer.removeLayer("speech");
  assert.equal(mixer.resolve("morph:jawOpen"), 0.2);
  assert.equal(mixer.resolve("morph:missing", 0.15), 0.15);
});

test("weighted priorities and equal-priority sources blend predictably", () => {
  const mixer = new AnimationMixer();
  mixer.setLayer("low", { priority: 20, channels: { "morph:jawOpen": 0.2 } });
  mixer.setLayer("high", { priority: 90, weight: 0.5, channels: { "morph:jawOpen": 0.8 } });
  assert.ok(Math.abs(mixer.resolve("morph:jawOpen") - 0.5) < 1e-12);
  mixer.setLayer("other", { priority: 90, weight: 0.5, channels: { "morph:jawOpen": 0.4 } });
  assert.ok(Math.abs(mixer.resolve("morph:jawOpen") - 0.6) < 1e-12);
  mixer.setLayer("zero", { priority: 100, weight: 0, channels: { "morph:jawOpen": 1 } });
  assert.ok(Math.abs(mixer.resolve("morph:jawOpen") - 0.6) < 1e-12);
  mixer.setLayer("over-range", { priority: 110, weight: 0.5, channels: { "morph:jawOpen": 100 } });
  assert.ok(Math.abs(mixer.resolve("morph:jawOpen") - 0.8) < 1e-12);
});

test("invalid inputs are ignored and replacement drops stale channels", () => {
  const mixer = new AnimationMixer();
  mixer.setLayer("source", { priority: 1, channels: { "morph:jawOpen": NaN, "morph:eyeBlinkLeft": 1 } });
  assert.equal(mixer.resolve("morph:jawOpen", 0.2), 0.2);
  mixer.setLayer("source", { priority: 1, channels: { "morph:jawOpen": 0.5 } });
  assert.equal(mixer.resolve("morph:eyeBlinkLeft"), 0);
  mixer.setLayer("bad", { priority: Infinity, channels: { "morph:jawOpen": 1 } });
  assert.equal(mixer.size, 1);
});

test("expressions damp instead of snapping and converge on every matching mesh", () => {
  const { engine, meshes } = fixture();
  engine.setExpression({ jawOpen: 0.8, mouthSmileLeft: 0.6, missing: 1 });
  engine.update(1 / 60);
  assert.ok(meshes[0].morphTargetInfluences![0] > 0.1 && meshes[0].morphTargetInfluences![0] < 0.8);
  advance(engine);
  for (const mesh of meshes) {
    assert.ok(Math.abs(mesh.morphTargetInfluences![0] - 0.8) < 1e-6);
    assert.ok(Math.abs(mesh.morphTargetInfluences![1] - 0.6) < 1e-6);
  }
});

test("blending is frame-rate independent for the same elapsed time", () => {
  const slow = fixture(); const fast = fixture();
  slow.engine.setMorph("jawOpen", 0.9); fast.engine.setMorph("jawOpen", 0.9);
  advance(slow.engine, 15, 30); advance(fast.engine, 60, 120);
  assert.ok(Math.abs(slow.meshes[0].morphTargetInfluences![0] - fast.meshes[0].morphTargetInfluences![0]) < 1e-12);
});

test("releasing an expression smoothly restores each mesh's own nonzero rest weight", () => {
  const { engine, meshes } = fixture(); engine.setExpression({ jawOpen: 0.8 }); advance(engine);
  engine.resetExpression(); engine.update(1 / 60);
  assert.ok(meshes[0].morphTargetInfluences![0] > 0.1 && meshes[0].morphTargetInfluences![0] < 0.8);
  advance(engine);
  assert.equal(meshes[0].morphTargetInfluences![0], 0.1);
  assert.equal(meshes[1].morphTargetInfluences![0], 0.25);
});

test("multiple systems update once per frame without suppressing unrelated controls", () => {
  const { engine, meshes } = fixture(); let calls = 0;
  engine.setExpression({ mouthSmileLeft: 0.7, jawOpen: 0.1 });
  engine.addSystem("voice", { priority: 90, update: () => { calls++; return { "morph:jawOpen": 0.65 }; } });
  engine.addSystem("blink", { priority: 100, update: () => ({ "morph:eyeBlinkLeft": 1 }) });
  advance(engine);
  assert.equal(calls, 120);
  assert.deepEqual(meshes[0].morphTargetInfluences, [0.65, 0.7, 1]);
  engine.removeSystem("voice"); advance(engine);
  assert.equal(meshes[0].morphTargetInfluences![0], 0.1);
  assert.equal(meshes[0].morphTargetInfluences![1], 0.7);
});

test("pause, invalid deltas, and resumed frames obey lifecycle timing", () => {
  const { engine, meshes } = fixture(); engine.setMorph("jawOpen", 1); engine.stop();
  engine.update(1); assert.equal(engine.time, 0); assert.equal(meshes[0].morphTargetInfluences![0], 0.1);
  engine.start();
  for (const delta of [NaN, Infinity, -1, 0]) engine.update(delta);
  assert.equal(engine.time, 0);
  engine.update(10); assert.equal(engine.time, 0.1);
  assert.ok(meshes[0].morphTargetInfluences![0] > 0.1);
});

test("reset clears sources, restores exact transforms, and remains neutral on subsequent frames", () => {
  const { engine, meshes, head } = fixture(); const rest = head.quaternion.clone(); let disposed = 0;
  engine.addSystem("motion", { priority: 20, update: () => ({ "bone:Head:yaw": 0.2 }), dispose: () => { disposed++; } });
  engine.setMorph("jawOpen", 1); advance(engine);
  head.position.set(8, 8, 8); head.scale.setScalar(3);
  engine.reset(); engine.update(1 / 60);
  assert.equal(disposed, 1); assert.equal(engine.systemCount, 0); assert.equal(engine.mixer.size, 0);
  assert.equal(meshes[0].morphTargetInfluences![0], 0.1); assert.equal(meshes[1].morphTargetInfluences![0], 0.25);
  assert.ok(head.quaternion.angleTo(rest) < 1e-7);
  assert.deepEqual(head.position.toArray(), [0, 2, 0]); assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
});

test("dispose is idempotent and commands cannot restart model writes", () => {
  const { engine, meshes } = fixture(); let disposed = 0;
  engine.addSystem("motion", { priority: 1, update: () => ({}), dispose: () => { disposed++; } });
  engine.dispose(); engine.dispose(); engine.start(); engine.setMorph("jawOpen", 1); engine.update(1);
  assert.equal(engine.status, "disposed"); assert.equal(disposed, 1); assert.equal(engine.systemCount, 0);
  assert.equal(meshes[0].morphTargetInfluences![0], 0.1);
});

test("a failing system and cleanup callback do not break other animation sources", () => {
  const { engine, meshes } = fixture();
  engine.addSystem("bad", { priority: 100, update: () => { throw new Error("source failed"); }, dispose: () => { throw new Error("cleanup failed"); } });
  engine.addSystem("good", { priority: 70, update: () => ({ "morph:mouthSmileLeft": 0.8 }) });
  assert.doesNotThrow(() => engine.update(1 / 60));
  assert.equal(engine.errors.get("bad"), "source failed"); assert.equal(engine.systemCount, 1);
  advance(engine); assert.equal(meshes[0].morphTargetInfluences![1], 0.8);
  assert.doesNotThrow(() => engine.dispose());
});

test("engine clamps raw layer weights and safely ignores unsupported controls", () => {
  const { engine, meshes } = fixture();
  engine.setLayer("raw", { priority: 100, channels: { "morph:jawOpen": 100, "morph:mouthSmileLeft": -100, "morph:missing": 1 } });
  assert.doesNotThrow(() => engine.setBoneRotation("missing", 1, 1));
  engine.setMorph("missing", 1); engine.setMorph("eyeBlinkLeft", NaN);
  advance(engine);
  assert.deepEqual(meshes[0].morphTargetInfluences, [1, 0, 0]);
});

test("bone axes compose independently and replacing a system cleans up its predecessor", () => {
  const { engine, bindings } = fixture(); let disposed = 0;
  engine.addSystem("idle", { priority: 20, update: () => ({ "bone:Head:yaw": 0.1 }), dispose: () => { disposed++; } });
  engine.addSystem("idle", { priority: 20, update: () => ({ "bone:Head:yaw": -0.1 }) });
  engine.setLayer("gaze", { priority: 90, channels: { "bone:Head:pitch": 0.15 } });
  let pitch = 0; let yaw = 0;
  const original = bindings.setBoneRotation;
  bindings.setBoneRotation = (name, x, y) => { if (name === "Head") { pitch = x; yaw = y; } original(name, x, y); };
  advance(engine);
  assert.equal(disposed, 1);
  assert.ok(Math.abs(pitch - 0.15) < 1e-8);
  assert.ok(Math.abs(yaw + 0.1) < 1e-8);
});
