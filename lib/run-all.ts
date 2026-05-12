// Bounded-concurrency runner. Drives N tasks with a cap on in-flight count
// and reports progress via callbacks. Used by Overview's "Run all audits".

export type RunAllTask<T> = {
  key: string;
  run: () => Promise<T>;
};

export type RunAllEvent<T> =
  | { type: "start"; key: string; inFlight: number; queued: number; done: number; total: number }
  | { type: "ok"; key: string; value: T; inFlight: number; queued: number; done: number; total: number }
  | { type: "err"; key: string; error: unknown; inFlight: number; queued: number; done: number; total: number };

export async function runAll<T>(
  tasks: RunAllTask<T>[],
  concurrency: number,
  onEvent: (e: RunAllEvent<T>) => void,
): Promise<void> {
  const total = tasks.length;
  let cursor = 0;
  let inFlight = 0;
  let done = 0;
  const queued = () => Math.max(0, total - done - inFlight);

  return new Promise<void>((resolve) => {
    if (total === 0) {
      resolve();
      return;
    }

    const launch = () => {
      while (inFlight < concurrency && cursor < total) {
        const task = tasks[cursor++];
        inFlight++;
        onEvent({ type: "start", key: task.key, inFlight, queued: queued(), done, total });
        task
          .run()
          .then((value) => {
            inFlight--;
            done++;
            onEvent({ type: "ok", key: task.key, value, inFlight, queued: queued(), done, total });
          })
          .catch((error) => {
            inFlight--;
            done++;
            onEvent({ type: "err", key: task.key, error, inFlight, queued: queued(), done, total });
          })
          .finally(() => {
            if (done === total) resolve();
            else launch();
          });
      }
    };

    launch();
  });
}
