const { setGlobalOptions } = require("firebase-functions/v2");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

setGlobalOptions({ region: "asia-south1", maxInstances: 5 });

// Data-free callable foundation: it never receives recovery state or writes data.
// App Check remains unenforced pending physical provider registration and review.
exports.firebaseFoundation = onCall({ enforceAppCheck: false }, (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "A Firebase Auth session is required.");
  }

  return {
    ok: true,
    acceptsRecoveryContent: false,
    projectRegion: "asia-south1"
  };
});
