import type { AvatarEngine } from "./AvatarEngine";
import { animationPriorities } from "./AnimationMixer";

/** Synthetic signals for inspecting composition; not audio-driven lip-sync or natural idle. */
export function createBlendDemo(engine: AvatarEngine): void {
  engine.reset();
  engine.start();
  engine.setExpression({ mouthSmileLeft: 0.55, mouthSmileRight: 0.55, jawOpen: 0.1 }, "demo:emotion");
  engine.addSystem("demo:idle", { priority: animationPriorities.idle, update: (_, time) => ({ "bone:Head:yaw": Math.sin(time * 0.8) * 0.08, "morph:jawOpen": 0.04 }) });
  engine.addSystem("demo:speech", { priority: animationPriorities.speech, update: (_, time) => ({ "morph:jawOpen": 0.15 + (Math.sin(time * 8) + 1) * 0.2 }) });
  engine.addSystem("demo:blink", { priority: animationPriorities.blink, update: (_, time) => {
    const pulse = Math.max(0, 1 - Math.abs((time % 3) - 1.5) / 0.12);
    return { "morph:eyeBlinkLeft": pulse, "morph:eyeBlinkRight": pulse };
  } });
}
