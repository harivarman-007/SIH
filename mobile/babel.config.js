module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./src"],
          alias: {
            "@db": "./src/db",
            "@api": "./src/api",
            "@store": "./src/store",
            "@sync": "./src/sync",
            "@screens": "./src/screens",
            "@navigation": "./src/navigation",
            "@models": "./src/models",
          },
        },
      ],
    ],
  };
};
