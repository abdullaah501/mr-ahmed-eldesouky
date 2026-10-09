export async function ObjectTaskExecutor(adapter, task) {
  const { messages, schema, options, files, model } = task;
  return adapter.generateObject({ messages, schema, options, files, model });
}