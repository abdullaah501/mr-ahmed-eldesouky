export async function TextTaskExecutor(adapter, task) {
  const { messages, options, files, model } = task;
  return adapter.generateText({ messages, options, files, model });
}