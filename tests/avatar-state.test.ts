import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { AvatarEngine } from "../avatar/engine/AvatarEngine";
import { resolveBindings } from "../avatar/model/resolveBindings";
import { applyAvatarState, captureAvatarState, manualFaceSource, parseAvatarState, savedFaceSource, type AvatarState } from "../avatar/state/avatarState";
import { cloneTheme, findTheme } from "../components/avatar/sceneThemes";

function makeEngine() {
  const root = new Group();
  const names = ["jawOpen", "mouthSmileLeft", "mouthSmileRight", "eyeBlinkLeft", "eyeBlinkRight", "browInnerUp"];
  const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  mesh.morphTargetDictionary = Object.fromEntries(names.map((name, i) => [name, i]));
  mesh.morphTargetInfluences = names.map(() => 0);
  root.add(mesh);
  for (const name of ["CC_Base_Head", "CC_Base_L_Upperarm", "CC_Base_R_Upperarm", "CC_Base_L_Eye", "CC_Base_R_Eye"]) { const bone = new Bone(); bone.name = name; root.add(bone); }
  return { engine: new AvatarEngine(resolveBindings(root)), mesh, names };
}
const settle = (engine: AvatarEngine) => { for (let i = 0; i < 100; i++) engine.update(0.1); };
const extras = { scene: { themeId: "night", custom: null }, closeUp: true };

test("capture records pose, face, behavior, scene and camera", () => {
  const { engine } = makeEngine();
  engine.pose.setPose("arms-up"); engine.behavior.setEmotion("happy", 0.8); engine.behavior.setLookAt(1, -0.5); engine.behavior.setReducedMotion(true);
  engine.setExpression({ mouthSmileLeft: 0.6 }, manualFaceSource, 110);
  const state = captureAvatarState(engine, extras, new Date("2026-01-02T03:04:05Z"));
  assert.equal(state.pose.id, "arms-up");
  assert.deepEqual(state.face, { emotion: "happy", intensity: 0.8, morphs: { mouthSmileLeft: 0.6 }, gaze: { x: 1, y: -0.5 } });
  assert.equal(state.behavior.reducedMotion, true);
  assert.deepEqual(state.scene, extras.scene); assert.equal(state.camera.closeUp, true);
  assert.equal(state.savedAt, "2026-01-02T03:04:05.000Z");
});

test("a capture survives JSON and restores the same look on a fresh studio engine", () => {
  const source = makeEngine();
  source.engine.pose.setPose("elbows-90"); source.engine.behavior.setEmotion("sad", 0.4); source.engine.behavior.setLookAt(-1, 0);
  source.engine.setExpression({ browInnerUp: 0.7 }, manualFaceSource, 110);
  const parsed = parseAvatarState(JSON.stringify(captureAvatarState(source.engine, extras)));
  assert.ok(parsed);
  const target = makeEngine();
  applyAvatarState(target.engine, parsed, "studio");
  settle(target.engine);
  assert.equal(target.engine.pose.id, "elbows-90");
  assert.ok(Math.abs(target.engine.pose.offset("LeftForearm", "pitch") - 1.57) < 1e-6);
  assert.equal(target.engine.behavior.emotion.emotion, "sad");
  assert.deepEqual(target.engine.behavior.getLookAt(), { x: -1, y: 0 });
  assert.equal(target.engine.face.getExpression(manualFaceSource).browInnerUp, 0.7);
});

test("a custom pose restores exactly, with no transition", () => {
  const source = makeEngine();
  source.engine.pose.setCustom("Head", "yaw", 0.4); source.engine.pose.setRoot("y", -0.3);
  const parsed = parseAvatarState(JSON.stringify(captureAvatarState(source.engine, extras)))!;
  const target = makeEngine();
  applyAvatarState(target.engine, parsed, "studio");
  assert.equal(target.engine.pose.offset("Head", "yaw"), 0.4);
  assert.equal(target.engine.pose.rootOffset.y, -0.3);
});

test("connected mode keeps saved face weights below speech so lip-sync still works", () => {
  const { engine, mesh, names } = makeEngine();
  const state = parseAvatarState(JSON.stringify({ ...captureAvatarState(makeEngine().engine, extras), face: { emotion: "happy", intensity: 0.7, morphs: { jawOpen: 1 }, gaze: null } }))!;
  applyAvatarState(engine, state, "connected");
  assert.deepEqual(engine.face.getExpression(savedFaceSource), { jawOpen: 1 });
  assert.deepEqual(engine.face.getExpression(manualFaceSource), {});
  const jaw = () => mesh.morphTargetInfluences![names.indexOf("jawOpen")];
  engine.start(); engine.behavior.enable(); engine.behavior.setState("listening");
  settle(engine);
  assert.ok(jaw() > 0.95, "saved weight shows while the avatar is not speaking");
  engine.behavior.setState("speaking"); engine.behavior.lips.setAmplitude(0.4);
  settle(engine);
  assert.ok(Math.abs(jaw() - 0.3) < 0.02, `speech takes over the jaw (0.4 * 0.75), got ${jaw()}`);
  assert.equal(engine.behavior.emotion.emotion, "neutral", "emotion is left to the conversation coordinator");
});

test("invalid or corrupt saves are rejected instead of half applied", () => {
  const good = captureAvatarState(makeEngine().engine, extras);
  assert.ok(parseAvatarState(JSON.stringify(good)));
  const bad = (change: (state: AvatarState & Record<string, unknown>) => void) => { const copy = JSON.parse(JSON.stringify(good)); change(copy); return parseAvatarState(JSON.stringify(copy)); };
  assert.equal(parseAvatarState(null), null);
  assert.equal(parseAvatarState("not json"), null);
  assert.equal(parseAvatarState("[]"), null);
  assert.equal(bad((s) => { s.version = 2 as never; }), null);
  assert.equal(bad((s) => { s.pose.bones.Head = [0, "x", 0] as never; }), null);
  assert.equal(bad((s) => { s.face.emotion = "furious" as never; }), null);
  assert.equal(bad((s) => { s.face.morphs.jawOpen = Number.NaN; }), null);
  assert.equal(bad((s) => { s.scene.custom = { top: "red" } as never; }), null);
  assert.equal(bad((s) => { delete (s as Record<string, unknown>).camera; }), null);
});

test("saved values are clamped to safe ranges and a valid custom theme is kept", () => {
  const custom = cloneTheme(findTheme("night"));
  const state = captureAvatarState(makeEngine().engine, { scene: { themeId: "custom", custom }, closeUp: false });
  state.pose.bones.Head = [99, -99, 0]; state.face.morphs.jawOpen = 5; state.face.gaze = { x: 9, y: -9 };
  const parsed = parseAvatarState(JSON.stringify(state))!;
  assert.ok(Math.abs(parsed.pose.bones.Head[0] - Math.PI) < 1e-9);
  assert.equal(parsed.face.morphs.jawOpen, 1);
  assert.deepEqual(parsed.face.gaze, { x: 1, y: -1 });
  assert.equal(parsed.scene.custom?.label, "Custom");
});
