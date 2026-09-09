// Approach a target velocity continuously; never clamp away air momentum.
export function horizontalVelocity(velocity, direction, grounded, dt) {
  const target = direction * 250;
  const overspeed = direction && Math.sign(velocity) === direction && Math.abs(velocity) > 250;
  const acceleration = grounded ? 1800 : overspeed ? 260 : direction ? 950 : 180;
  const difference = target - velocity;
  return velocity + Math.sign(difference) * Math.min(Math.abs(difference), acceleration * dt);
}
export function doubleJumpVelocity(velocity, facing) {
  return facing * Math.min(560, Math.max(460, velocity * facing + 240));
}
