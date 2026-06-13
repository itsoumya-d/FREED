const { isAbsolute, relative } = require("node:path");

function isPathInsideOrSame(parent, child) {
  const exactRelative = relative(parent, child);
  if (exactRelative === "" || (!exactRelative.startsWith("..") && !isAbsolute(exactRelative))) {
    return true;
  }

  const foldedRelative = relative(parent.toLowerCase(), child.toLowerCase());
  return foldedRelative === "" || (!foldedRelative.startsWith("..") && !isAbsolute(foldedRelative));
}

module.exports = {
  isPathInsideOrSame,
};
