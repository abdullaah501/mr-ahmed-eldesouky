export async function ExtractionTaskExecutor(adapter, task) {
  const { messages, schema, options, files, model } = task;
  return adapter.extract({ messages, schema, options, files, model });
}