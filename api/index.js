import { app, ensureReady } from '../server/index.js';

export default async function handler(req, res) {
  await ensureReady();
  return app(req, res);
}
