module.exports = {
  apps: [
    {
      name: 're-save',
      script: 'server/index.js',
      cwd: process.env.RE_SAVE_DIR || process.cwd(),
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
