export async function StreamTaskExecutor(adapter, task) {
  const { messages, options, files, model } = task;
  const generator = adapter.streamText({ messages, options, files, model });
  // Eagerly start the provider request so connection-level failures
  // (404/429/5xx/network) are thrown inside taskRunner's retry/fallback/
  // breaker boundary instead of surfacing later in the consumer's iteration.
  // Failures AFTER the first chunk are intentionally NOT retried/fallbacked
  // here: the consumer already received output, so switching providers now
  // would duplicate or corrupt the answer.
  const first = await generator.next();
  if (first.done) return (async function* () {})();
  return (async function* () {
    yield first.value;
    yield* generator;
  })();
}
