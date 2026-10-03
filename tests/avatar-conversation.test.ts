import { test } from "node:test";
import assert from "node:assert/strict";
import { Group, Mesh, BoxGeometry, MeshBasicMaterial, Bone } from "three";
import { ConversationCoordinator } from "../avatar/conversation/ConversationCoordinator";
import { AvatarEngine } from "../avatar/engine/AvatarEngine";
import { LipSyncEngine } from "../avatar/engine/LipSyncEngine";
import { resolveBindings } from "../avatar/model/resolveBindings";

function fixture(rest = 0) {
  const root = new Group();
  const names = ["jawOpen", "aa", "oh", "eyeBlinkLeft", "eyeBlinkRight", "mouthSmileLeft", "mouthSmileRight", "eyeWideLeft", "browInnerUp"];
  const meshes = ["face", "teeth"].map((name, index) => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial()); mesh.name = name;
    mesh.morphTargetDictionary = Object.fromEntries(names.map((name, i) => [name, i]));
    mesh.morphTargetInfluences = names.map((name) => name === "jawOpen" ? rest * (index + 1) : 0);
    root.add(mesh); return mesh;
  });
  for (const name of ["Head", "LeftEye", "RightEye", "LeftArm", "RightArm"]) { const bone = new Bone(); bone.name = name; root.add(bone); }
  const engine = new AvatarEngine(resolveBindings(root));
  const coordinator = new ConversationCoordinator(); coordinator.attach(engine);
  const advance = (seconds = 0.5, fps = 60) => { for (let i = 0; i < seconds * fps; i++) engine.update(1 / fps); };
  const weight = (name: string, mesh = 0) => meshes[mesh].morphTargetInfluences![names.indexOf(name)];
  return { engine, coordinator, advance, weight, meshes };
}

test("conversation follows actual playback rather than queued audio or turn completion", () => {
  const f = fixture(); assert.equal(f.coordinator.state, "idle");
  f.coordinator.setConnection("connected"); assert.equal(f.coordinator.state, "listening");
  f.coordinator.beginTurn(); assert.equal(f.coordinator.state, "thinking");
  f.coordinator.updatePlayback({ playing: false, amplitude: 0.8, queuedSeconds: 2 }); f.advance();
  assert.equal(f.coordinator.state, "thinking"); assert.equal(f.weight("jawOpen"), 0);
  f.coordinator.updatePlayback({ playing: true, amplitude: 0.6, queuedSeconds: 1 }); f.advance();
  assert.equal(f.coordinator.state, "speaking"); assert.ok(f.weight("jawOpen") > 0.4);
  f.coordinator.completeTurn(); assert.equal(f.coordinator.state, "speaking");
  f.coordinator.updatePlayback({ playing: false, amplitude: 0, queuedSeconds: 0 });
  assert.equal(f.coordinator.state, "listening"); assert.equal(f.weight("jawOpen"), 0);
});

test("interruption closes every speech mesh immediately without another animation frame", () => {
  const f = fixture(0.03); f.coordinator.setConnection("connected"); f.coordinator.setEmotion("happy");
  f.coordinator.updatePlayback({ playing: true, amplitude: 0.9, queuedSeconds: 5 }); f.advance();
  assert.ok(f.weight("jawOpen") > 0.5); const smile = f.weight("mouthSmileLeft");
  f.coordinator.interrupt();
  assert.equal(f.weight("jawOpen", 0), 0.03); assert.equal(f.weight("jawOpen", 1), 0.06);
  assert.equal(f.weight("aa"), 0); assert.equal(f.weight("mouthSmileLeft"), smile);
  f.advance(); assert.equal(f.weight("jawOpen", 1), 0.06); assert.equal(f.coordinator.state, "listening");
});

test("silent/muted playback stays closed even with a jaw-opening emotion", () => {
  const f = fixture(); f.coordinator.setConnection("connected"); f.coordinator.setEmotion("surprised");
  f.coordinator.updatePlayback({ playing: true, amplitude: 0.7, queuedSeconds: 1 }); f.advance();
  assert.ok(f.weight("jawOpen") > 0.4); assert.ok(f.weight("eyeWideLeft") > 0.3);
  f.coordinator.updatePlayback({ playing: true, amplitude: 0.01, queuedSeconds: 1 });
  assert.equal(f.weight("jawOpen"), 0); assert.equal(f.coordinator.state, "speaking");
  f.advance(); assert.equal(f.weight("jawOpen"), 0); assert.ok(f.weight("eyeWideLeft") > 0.3);
  f.coordinator.updatePlayback({ playing: true, amplitude: 0.5, queuedSeconds: 0.5 }); f.advance(); assert.ok(f.weight("jawOpen") > 0.3);
});

test("user speech, reconnect, neutral fallback, and teardown coordinate without stale speech", () => {
  const f = fixture(); f.coordinator.setConnection("connected"); f.coordinator.updatePlayback({ playing: true, amplitude: 1, queuedSeconds: 5 }); f.advance();
  f.coordinator.userActivity(true); assert.equal(f.coordinator.state, "listening"); assert.equal(f.weight("jawOpen"), 0);
  f.coordinator.beginTurn(); assert.equal(f.coordinator.state, "listening");
  f.coordinator.userActivity(false); assert.equal(f.coordinator.state, "thinking");
  f.coordinator.setConnection("reconnecting"); assert.equal(f.coordinator.state, "idle");
  f.coordinator.setConnection("connected"); assert.equal(f.coordinator.state, "listening");
  assert.equal(f.coordinator.setEmotion("unsupported", NaN), "neutral"); assert.equal(f.coordinator.intensity, 0.7);
  f.coordinator.setEmotion("happy", 20); assert.equal(f.coordinator.intensity, 1);
  f.coordinator.setConnection("disconnected"); assert.equal(f.coordinator.emotion, "neutral"); assert.equal(f.coordinator.state, "idle");
  f.coordinator.dispose(); f.engine.dispose(); assert.doesNotThrow(() => f.coordinator.updatePlayback({ playing: true, amplitude: 1, queuedSeconds: 2 }));
});

test("amplitude smoothing is bounded and stable across frame rates, and silence settles exactly", () => {
  const simulate = (fps: number) => {
    const lips = new LipSyncEngine(new Set(["jawOpen"])); lips.startSpeaking(); lips.setAmplitude(0.8);
    let jaw = 0;
    for (let i = 0; i < fps / 2; i++) jaw = lips.update(1 / fps)["morph:jawOpen"]!;
    lips.setAmplitude(0.01);
    for (let i = 0; i < fps / 2; i++) assert.ok(lips.update(1 / fps)["morph:jawOpen"]! >= 0);
    assert.equal(lips.update(1 / fps)["morph:jawOpen"], 0);
    assert.deepEqual(lips.update(NaN), {});
    return jaw;
  };
  assert.ok(Math.abs(simulate(30) - simulate(120)) < 1e-7);
});
