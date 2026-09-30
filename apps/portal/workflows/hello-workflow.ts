import { FatalError, sleep } from 'workflow';

export async function handleHelloWorkflow(name: string) {
  'use workflow';

  const result = await sayHello(name);
  await sleep('5s');
  await processHello(result);

  console.log("Workflow is complete! Run 'npx workflow web' to inspect your run");
  return { name, status: 'completed' };
}

async function sayHello(name: string) {
  'use step';
  console.log(`Step 1: Saying hello to ${name}`);
  return { id: crypto.randomUUID(), name };
}

async function processHello(user: { id: string; name: string }) {
  'use step';
  console.log(`Step 2: Processing hello for ${user.id}`);

  if (user.name === 'error') {
    throw new FatalError('Intentional FatalError for testing');
  }
}
