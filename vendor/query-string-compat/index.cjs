// Expo's supported Node 20.19+ can synchronously require this upstream ESM package.
// Metro also resolves its ESM dependency and preserves the default-object shape.
module.exports = require("query-string-upstream").default;
