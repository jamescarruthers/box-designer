/**
 * §23 The kernel, mocked to sit still.
 *
 * OpenCASCADE is the default engine now, so every test that mounts the app asks
 * for it — and none of them wants to fetch ten megabytes of wasm into jsdom to
 * find out whether a button works. This answers the call and then never
 * resolves, which leaves the app exactly where it was before the default
 * changed: drawing the analytic ring stacks, with the kernel still on its way.
 *
 * Jobs are collected so a test can drive one to an answer, or check it was
 * abandoned, without reaching for the real client.
 */
export function stubKernel() {
  const calls = [];
  return {
    calls,
    module: {
      callKernel: (op, payload, opts) => {
        const job = { op, payload, opts, signal: opts?.signal };
        calls.push(job);
        return new Promise((resolve, reject) => { job.resolve = resolve; job.reject = reject; });
      },
      inSafeMode: () => false,
      pendingJobs: () => calls.length,
      terminateKernel: () => {},
    },
  };
}
