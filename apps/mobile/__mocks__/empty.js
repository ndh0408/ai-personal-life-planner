// Catch-all mock for native-only modules in unit tests.
// Anything imported from a stubbed module returns an empty object/function.
module.exports = new Proxy(
  {},
  {
    get: () => () => null,
  },
);
