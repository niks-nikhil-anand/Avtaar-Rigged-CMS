import { test } from "node:test";
import assert from "node:assert/strict";
import { Bone, BoxGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Euler } from "three";
import { resolveBindings } from "../avatar/model/resolveBindings";
import { inspectModel } from "../avatar/model/inspectModel";

function fixture() {
  const root = new Group();
  const meshes = ["Face", "Teeth"].map((name) => {
    const mesh = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    mesh.name = name;
    mesh.morphTargetDictionary = { jawOpen: 0, eyeBlinkLeft: 1 };
    mesh.morphTargetInfluences = [0.15, 0];
    root.add(mesh);
    return mesh;
  });
  const head = new Bone(); head.name = "Head"; head.rotation.set(0.2, -0.1, 0.05); root.add(head);
  return { root, meshes, head };
}

test("a named morph drives every facial part, clamps weights, and ignores invalid input", () => {
  const { root, meshes } = fixture(); const bindings = resolveBindings(root);
  assert.equal(bindings.morphs.get("jawOpen")?.length, 2);
  bindings.setMorph("jawOpen", 0.6);
  for (const mesh of meshes) assert.equal(mesh.morphTargetInfluences![0], 0.6);
  bindings.setMorph("jawOpen", 8);
  for (const mesh of meshes) assert.equal(mesh.morphTargetInfluences![0], 1);
  bindings.setMorph("jawOpen", NaN);
  assert.equal(meshes[0].morphTargetInfluences![0], 1);
  bindings.setMorph("jawOpen", -1);
  assert.equal(meshes[0].morphTargetInfluences![0], 0);
  assert.doesNotThrow(() => bindings.setMorph("missing", 1));
});

test("reset restores original nonzero weights and complete bone transforms", () => {
  const { root, meshes, head } = fixture(); const rest = head.quaternion.clone(); const bindings = resolveBindings(root);
  bindings.setMorph("jawOpen", 0.9); bindings.setBoneRotation("Head", 0.2, 0.1);
  head.position.set(1, 2, 3); head.scale.setScalar(2);
  bindings.reset();
  for (const mesh of meshes) assert.equal(mesh.morphTargetInfluences![0], 0.15);
  assert.ok(head.quaternion.angleTo(rest) < 1e-7);
  assert.deepEqual(head.position.toArray(), [0, 0, 0]);
  assert.deepEqual(head.scale.toArray(), [1, 1, 1]);
});

test("bone offsets respect limits, preserve rest orientation, and do not accumulate", () => {
  const { root, head } = fixture(); const rest = head.quaternion.clone(); const bindings = resolveBindings(root);
  bindings.setBoneRotation("Head", 10, -10);
  const expected = rest.clone().multiply(new Quaternion().setFromEuler(new Euler(0.25, -0.25, 0)));
  assert.ok(head.quaternion.angleTo(expected) < 1e-7);
  bindings.setBoneRotation("Head", 10, -10);
  assert.ok(head.quaternion.angleTo(expected) < 1e-7);
  assert.doesNotThrow(() => bindings.setBoneRotation("missing", 1, 1));
});

test("inspection lists meshes, controls, bones, bounds, and unavailable capabilities", () => {
  const { root } = fixture(); const report = inspectModel(root); const bindings = resolveBindings(root);
  assert.equal(report.meshes.length, 2);
  assert.deepEqual(report.bones, ["Head"]);
  assert.deepEqual(report.meshes[0].morphs, ["jawOpen", "eyeBlinkLeft"]);
  assert.deepEqual(report.bounds, [1, 1, 1]);
  assert.deepEqual(report.animations, []);
  assert.ok(bindings.unsupported.includes("RightEye"));
});
