// Serialises every storage write. Two LinkedIn tabs confirming actions at the
// same moment would otherwise both read the same event log and the second
// `set` would silently drop the first append. Everything the background does
// to storage runs through one of these, one task at a time, in arrival order.

export class WriterQueue {
  private tail: Promise<unknown> = Promise.resolve();

  /** Runs `task` after every previously queued task has settled. Rejections don't block the queue. */
  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task, task);
    this.tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
