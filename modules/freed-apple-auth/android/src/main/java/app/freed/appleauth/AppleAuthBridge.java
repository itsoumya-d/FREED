package app.freed.appleauth;

import android.app.Activity;
import com.google.android.gms.tasks.Task;
import com.google.firebase.auth.AuthResult;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseAuthException;
import com.google.firebase.auth.FirebaseUser;
import com.google.firebase.auth.OAuthCredential;
import com.google.firebase.auth.OAuthProvider;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/** Calls only the installed Firebase Java API; no tokens cross the Expo bridge. */
public final class AppleAuthBridge {
  private static final AtomicBoolean IN_FLIGHT = new AtomicBoolean(false);
  public interface Callback {
    void resolve(Map<String, Object> result);
    void reject(String code, String message);
  }

  public static void run(Activity activity, String action, String expectedUid, Callback callback) {
    if (!IN_FLIGHT.compareAndSet(false, true)) {
      callback.reject("auth/web-context-already-presented", "An Apple confirmation is already in progress.");
      return;
    }
    try {
      FirebaseAuth auth = FirebaseAuth.getInstance();
      FirebaseUser current = auth.getCurrentUser();
      AppleAuthIdentityPolicy.validateBefore(action, uid(current), expectedUid, current != null && current.isAnonymous());
      if (activity == null) throw new IllegalStateException("No foreground activity");
      OAuthProvider provider = OAuthProvider.newBuilder("apple.com", auth).setScopes(Arrays.asList("email", "name")).build();
      Task<AuthResult> pending = auth.getPendingAuthResult();
      // Recover Firebase's existing provider activity after process/activity
      // recreation instead of launching a duplicate OAuth authorization.
      Task<AuthResult> operation = pending != null ? pending
          : action.equals("sign-in") ? auth.startActivityForSignInWithProvider(activity, provider)
          : action.equals("link") ? current.startActivityForLinkWithProvider(activity, provider)
          : current.startActivityForReauthenticateWithProvider(activity, provider);
      operation.addOnCompleteListener(task -> {
        if (!task.isSuccessful()) { fail(task.getException(), callback); return; }
        try {
          AuthResult result = task.getResult();
          AppleAuthIdentityPolicy.validateAfter(expectedUid, uid(result.getUser()), uid(auth.getCurrentUser()));
          if (!(result.getCredential() instanceof OAuthCredential)
              || !"apple.com".equals(result.getCredential().getProvider())) {
            throw new IllegalStateException("Apple did not supply its provider credential");
          }
          if (!action.equals("reauthenticate-and-revoke")) {
            succeed(result.getUser(), false, callback);
            return;
          }
          // This fresh SDK-provided grant lives only in this callback and is
          // revoked through Firebase's authenticated Apple backend. It is never
          // logged, written to disk, or returned to JavaScript.
          String accessToken = ((OAuthCredential) result.getCredential()).getAccessToken();
          if (accessToken == null || accessToken.isEmpty()) throw new IllegalStateException("Apple did not supply a revocable access token");
          AppleAuthIdentityPolicy.validateAfter(expectedUid, uid(result.getUser()), uid(auth.getCurrentUser()));
          auth.revokeAccessToken(accessToken).addOnCompleteListener(revocation -> {
            if (!revocation.isSuccessful()) { failRevocation(revocation.getException(), callback); return; }
            try {
              AppleAuthIdentityPolicy.validateAfter(expectedUid, uid(result.getUser()), uid(auth.getCurrentUser()));
              succeed(result.getUser(), true, callback);
            } catch (Exception error) { fail(error, callback); }
          });
        } catch (Exception error) { fail(error, callback); }
      });
    } catch (Exception error) { fail(error, callback); }
  }

  private static String uid(FirebaseUser user) { return user == null ? null : user.getUid(); }

  private static void succeed(FirebaseUser user, boolean revoked, Callback callback) {
    Map<String, Object> result = new HashMap<>();
    result.put("uid", user.getUid());
    result.put("email", user.getEmail());
    result.put("revoked", revoked);
    IN_FLIGHT.set(false);
    callback.resolve(result);
  }

  private static String errorCode(Exception error) {
    if (error instanceof AppleAuthIdentityException) return ((AppleAuthIdentityException) error).getCode();
    if (error instanceof FirebaseAuthException) {
      return "auth/" + ((FirebaseAuthException) error).getErrorCode().replaceFirst("^ERROR_", "").toLowerCase(java.util.Locale.ROOT).replace('_', '-');
    }
    return "auth/operation-unavailable";
  }

  private static void fail(Exception error, Callback callback) {
    IN_FLIGHT.set(false);
    callback.reject(errorCode(error), "Apple confirmation could not be completed. Choose the Apple account connected to FREED and check your connection.");
  }

  private static void failRevocation(Exception error, Callback callback) {
    IN_FLIGHT.set(false);
    callback.reject(errorCode(error), "Apple authorization could not be revoked. Verify the Apple sign-in provider is fully configured, then try again.");
  }
}
