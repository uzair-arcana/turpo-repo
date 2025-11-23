const path = require('path');

module.exports = function (options, webpack) {
  const lazyImports = [
    '@nestjs/microservices/microservices-module',
    '@nestjs/websockets/socket-module',
  ];

  return {
    ...options,
    output: {
      ...options.output,
      libraryTarget: 'commonjs2',
    },
    plugins: [
      ...options.plugins,
      new webpack.IgnorePlugin({
        checkResource(resource) {
          if (lazyImports.includes(resource)) {
            try {
              require.resolve(resource);
            } catch (err) {
              return true;
            }
          }
          return false;
        },
      }),
      new webpack.IgnorePlugin({
        checkResource(resource) {
          const optionalDeps = [
            '@grpc/grpc-js',
            '@grpc/proto-loader',
            'kafkajs',
            'mqtt',
            'nats',
            'ioredis',
            'amqplib',
            'amqp-connection-manager',
          ];
          if (optionalDeps.includes(resource)) {
            try {
              require.resolve(resource);
            } catch (err) {
              return true;
            }
          }
          return false;
        },
      }),
    ],
    resolve: {
      ...options.resolve,
      alias: {
        ...(options.resolve?.alias || {}),
        '@shared': path.resolve(__dirname, '../../shared/src'),
      },
      extensions: [
        ...(options.resolve?.extensions || ['.js', '.json']),
        '.ts',
        '.tsx',
      ],
    },
  };
};
