const { PHASE_DEVELOPMENT_SERVER } = require('next/constants');

module.exports = (phase) => {
  const isDev = phase === PHASE_DEVELOPMENT_SERVER;

  if (!isDev) {
    return { output: 'export', trailingSlash: true };
  }

  // Em produção o Go serve API e SPA na mesma origem; no dev o proxy imita isso.
  const apiUrl = process.env.DBCLIENT_API_URL || 'http://localhost:8080';
  return {
    async rewrites() {
      return [
        { source: '/api/:path*', destination: `${apiUrl}/api/:path*` },
        { source: '/healthz', destination: `${apiUrl}/healthz` },
      ];
    },
  };
};
