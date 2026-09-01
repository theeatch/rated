export const nowMs = () => Date.now();

export const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Inclusive list of the last `count` epoch seconds, oldest first. */
export const recentSeconds = (count, end = nowSeconds()) =>
  Array.from({ length: count }, (_, i) => end - (count - 1 - i));

export const msToSeconds = (ms) => Math.ceil(ms / 1000);

export default { nowMs, nowSeconds, recentSeconds, msToSeconds };
