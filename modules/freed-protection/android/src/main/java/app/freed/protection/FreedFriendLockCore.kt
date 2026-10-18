package app.freed.protection

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.Future
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec

// Standalone Package A. No DNS/VPN, app lease, account, private-history or bridge mutation.
internal enum class FriendLockError { INVALID_PIN, PIN_MISMATCH, INVALID_SCOPE, BASELINE_UNAVAILABLE, ALREADY_ENROLLED, NOT_ENROLLED, MISSING_ENROLLED, CORRUPT, STORAGE_UNAVAILABLE, COMMIT_OUTCOME_UNKNOWN, STORAGE_CONFLICT, INCORRECT_SECRET, THROTTLED, SCOPE_MISMATCH, UNKNOWN_OPERATION, CANCELLED, AUTHORIZATION_CAPACITY, INVALID_TRANSITION, CRYPTO_UNAVAILABLE }
internal class FriendLockException(val reason: FriendLockError) : Exception(reason.name)
internal enum class FriendLockStatus { NOT_ENROLLED, ENROLLED, MISSING_ENROLLED, CORRUPT, UNAVAILABLE }
internal enum class FriendLockAction(val wire: String) {
    DISABLE_ADULT_FILTER("disableAdultFilter"), DISABLE_ENCRYPTED_DNS("disableEncryptedDNS"), REMOVE_ADULT_DOMAINS("removeAdultDomains"), ADD_ADULT_EXCEPTIONS("addAdultExceptions"), RESET_ADULT_PROTECTION("resetAdultProtection"), REDUCE_ADULT_SCHEDULE("reduceAdultSchedule"), REPLACE_DNS_PROVIDER("dnsReplace")
}
internal enum class FriendLockOperationState { AWAITING_SECRET, AUTHORIZED, IN_FLIGHT, COMPLETED, CANCELLED }
internal data class FriendLockConfiguration(val revision: String, val mutationGeneration: String) {
    init { if (!validScopePart(revision) || !validScopePart(mutationGeneration)) fail(FriendLockError.INVALID_SCOPE) }
}
private fun validScopePart(value: String) = value.isNotEmpty() && value.length <= 128 && value.all { it.code in 33..126 }
internal fun fail(reason: FriendLockError): Nothing = throw FriendLockException(reason)
internal fun ByteArray.friendHex(): String = joinToString("") { "%02x".format(it.toInt() and 0xff) }
internal fun validHex(value: String, length: Int) = value.length == length && value.all { it in '0'..'9' || it in 'a'..'f' }

// Native integrations construct exact before/desired fields; incoming JS hashes never authorize.
internal class FriendLockAdultChange(val action: FriendLockAction, fields: Map<String, String>) {
    private val canonical: ByteArray
    init {
        if (fields.isEmpty() || fields.size > 128) fail(FriendLockError.INVALID_SCOPE)
        val buffer = ByteArrayOutputStream()
        DataOutputStream(buffer).use { out ->
            fun append(value: String) {
                val bytes = value.toByteArray(Charsets.UTF_8)
                if (bytes.size > 4096) fail(FriendLockError.INVALID_SCOPE)
                out.writeInt(bytes.size); out.write(bytes)
            }
            append("freed-device-adult-change-v1"); append(action.wire)
            fields.toSortedMap().forEach { (key, value) ->
                if (!validScopePart(key)) fail(FriendLockError.INVALID_SCOPE)
                append(key); append(value)
            }
        }
        canonical = buffer.toByteArray()
        if (canonical.size > 32_768) fail(FriendLockError.INVALID_SCOPE)
    }
    fun digest(crypto: FriendLockCrypto) = crypto.digest(canonical).friendHex()
}
internal class FriendLockBaseline(val configuration: FriendLockConfiguration, val adultProtectionInstalled: Boolean, nativeReadback: ByteArray) {
    val nativeReadback = nativeReadback.clone()
}
internal class FriendLockEnrollment(val lockRevision: Long, val recoveryKey: String) {
    override fun toString() = "FriendLockEnrollment(revision=$lockRevision, recoveryKey=<redacted>)"
}
internal sealed interface FriendLockSecret {
    class Pin(val value: String) : FriendLockSecret { override fun toString() = "FriendLockSecret.Pin(<redacted>)" }
    class Recovery(val value: String) : FriendLockSecret { override fun toString() = "FriendLockSecret.Recovery(<redacted>)" }
}
internal data class FriendLockInstant(val session: String, val milliseconds: Long)
internal fun interface FriendLockClock { fun now(): FriendLockInstant }
internal class FriendLockElapsedClock : FriendLockClock {
    private val session = UUID.randomUUID().toString()
    private val origin = System.nanoTime()
    override fun now() = FriendLockInstant(session, (System.nanoTime() - origin) / 1_000_000L)
}
internal interface FriendLockCrypto {
    fun random(count: Int): ByteArray
    fun digest(data: ByteArray): ByteArray
    fun derive(secret: String, salt: ByteArray): ByteArray
}
internal class FriendLockNativeCrypto(private val keyFactory: () -> SecretKeyFactory = { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256") }) : FriendLockCrypto {
    companion object {
        fun available(): Boolean = try { SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256"); true } catch (_: Exception) { false }
    }
    private val random = SecureRandom()
    override fun random(count: Int) = ByteArray(count).also { random.nextBytes(it) }
    override fun digest(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)
    override fun derive(secret: String, salt: ByteArray): ByteArray {
        val characters = secret.toCharArray()
        val spec = PBEKeySpec(characters, salt, 600_000, 256)
        return try {
            // Android provider support is required. No lower-cost or plaintext fallback on API 24/25.
            keyFactory().generateSecret(spec).encoded
        } catch (_: Exception) { fail(FriendLockError.CRYPTO_UNAVAILABLE) }
        finally { spec.clearPassword(); characters.fill('\u0000') }
    }
}
internal class FriendLockVerifier(val salt: ByteArray, val derived: ByteArray) {
    fun valid() = salt.size == 16 && derived.size == 32
    override fun toString() = "FriendLockVerifier(<protected>)"
}
internal data class FriendLockThrottle(val failures: Int = 0, val remainingMilliseconds: Long = 0, val session: String = "", val lastMilliseconds: Long = 0) {
    fun valid() = failures in 0..1_000_000 && remainingMilliseconds in 0..3_600_000 && session.length <= 128 && lastMilliseconds >= 0
    fun advance(instant: FriendLockInstant): FriendLockThrottle {
        val elapsed = if (session == instant.session && instant.milliseconds >= lastMilliseconds) minOf(remainingMilliseconds, instant.milliseconds - lastMilliseconds) else 0L
        // Process recreation/reboot/elapsed rollback conservatively retains the stored remainder.
        return copy(remainingMilliseconds = remainingMilliseconds - elapsed, session = instant.session, lastMilliseconds = maxOf(0, instant.milliseconds))
    }
    fun reserve(instant: FriendLockInstant): FriendLockThrottle {
        val next = minOf(1_000_000, failures + 1)
        val delay = when { next < 5 -> 0L; next == 5 -> 60_000L; next == 6 -> 300_000L; next == 7 -> 900_000L; else -> 3_600_000L }
        return FriendLockThrottle(next, delay, instant.session, maxOf(0, instant.milliseconds))
    }
}
internal data class FriendLockReceipt(
    val operationID: String, val deltaDigest: String, val configuration: FriendLockConfiguration,
    val lockRevision: Long, val authorizationGeneration: Long, val state: FriendLockOperationState,
    val resultingConfiguration: FriendLockConfiguration? = null, val readbackDigest: String? = null
) {
    fun valid() = validHex(operationID, 32) && validHex(deltaDigest, 64) && lockRevision > 0 && authorizationGeneration >= 0 &&
        (readbackDigest == null || validHex(readbackDigest, 64)) &&
        if (state == FriendLockOperationState.COMPLETED) resultingConfiguration != null && readbackDigest != null else resultingConfiguration == null && readbackDigest == null
}
internal data class FriendLockRecord(
    val enrollmentBaselineDigest: String, val pin: FriendLockVerifier, val recovery: FriendLockVerifier,
    val schema: Int = 1, val lockRevision: Long = 1, val authorizationGeneration: Long = 0,
    val pinThrottle: FriendLockThrottle = FriendLockThrottle(), val recoveryThrottle: FriendLockThrottle = FriendLockThrottle(),
    val operations: List<FriendLockReceipt> = emptyList()
) {
    fun valid() = schema == 1 && lockRevision in 1..9_007_199_254_740_991L && authorizationGeneration in 0..9_007_199_254_740_991L && validHex(enrollmentBaselineDigest, 64) && pin.valid() && recovery.valid() &&
        pinThrottle.valid() && recoveryThrottle.valid() && operations.size <= 32 && operations.map { it.operationID }.toSet().size == operations.size &&
        operations.all { it.valid() && it.lockRevision == lockRevision && it.authorizationGeneration == authorizationGeneration }
    override fun toString() = "FriendLockRecord(<protected>)"
}

// Integrations call this worker, never the core on UI/service-enforcement locks. Only one KDF at a time.
internal class FriendLockWorker(private val core: FriendLockCore) : AutoCloseable {
    companion object { private val executor: ExecutorService = Executors.newSingleThreadExecutor { job -> Thread(job, "freed-device-adult-friend-lock").apply { isDaemon = true } } }
    @Volatile private var closed = false
    fun <T> submit(operation: (FriendLockCore) -> T): Future<T> {
        check(!closed) { "Friend lock worker is closed" }; return executor.submit(Callable { operation(core) })
    }
    override fun close() { closed = true }
}
internal class FriendLockCore(private val store: FriendLockRecordStore, private val crypto: FriendLockCrypto, private val clock: FriendLockClock = FriendLockElapsedClock()) {
    companion object { private val verificationGate = Any() }
    private val enrollmentIssuer = Any()
    @Synchronized fun status(): FriendLockStatus = try { if (store.load() == null) FriendLockStatus.NOT_ENROLLED else FriendLockStatus.ENROLLED }
    catch (failure: FriendLockException) { when (failure.reason) { FriendLockError.MISSING_ENROLLED -> FriendLockStatus.MISSING_ENROLLED; FriendLockError.CORRUPT -> FriendLockStatus.CORRUPT; else -> FriendLockStatus.UNAVAILABLE } }
    internal class EnrollmentCandidate private constructor(
        private val issuer: Any, private val record: FriendLockRecord, private val key: String
    ) {
        private var consumed = false
        internal companion object {
            fun derive(issuer: Any, record: FriendLockRecord, key: String) = EnrollmentCandidate(issuer, record, key)
        }
        internal fun publish(issuer: Any, store: FriendLockRecordStore, publication: (() -> Unit) -> Unit): FriendLockEnrollment {
            synchronized(this) {
                if (this.issuer !== issuer || consumed) fail(FriendLockError.STORAGE_CONFLICT)
                consumed = true
            }
            val thread = Thread.currentThread()
            var active = true; var committed = false
            try {
                publication {
                    if (!active || committed || Thread.currentThread() !== thread) fail(FriendLockError.STORAGE_CONFLICT)
                    store.publish(record, null); committed = true
                }
                if (!committed) fail(FriendLockError.INVALID_TRANSITION)
            } finally { active = false }
            return FriendLockEnrollment(record.lockRevision, key)
        }
        override fun toString() = "EnrollmentCandidate(<redacted>)"
    }
    fun deriveEnrollment(pin: String, confirmation: String, baseline: FriendLockBaseline): EnrollmentCandidate {
        synchronized(this) {
            validatePIN(pin, confirmation)
            if (!baseline.adultProtectionInstalled || baseline.nativeReadback.isEmpty() || baseline.nativeReadback.size > 32_768) fail(FriendLockError.BASELINE_UNAVAILABLE)
            if (store.load() != null) fail(FriendLockError.ALREADY_ENROLLED)
        }
        // The singleton worker/logical enrollment owner fences competing mutations.
        // Both KDFs run without the Core monitor; publication still uses expected-nil CAS.
        val key = crypto.random(32).friendHex()
        val record = FriendLockRecord(crypto.digest(baseline.nativeReadback).friendHex(), verifier(pin), verifier(key))
        return EnrollmentCandidate.derive(enrollmentIssuer, record, key)
    }
    // Deliberately outside the Core monitor: production takes guard -> protected store.
    fun publishEnrollment(candidate: EnrollmentCandidate, publication: (() -> Unit) -> Unit = { it() }): FriendLockEnrollment =
        candidate.publish(enrollmentIssuer, store, publication)
    fun enroll(pin: String, confirmation: String, baseline: FriendLockBaseline): FriendLockEnrollment =
        publishEnrollment(deriveEnrollment(pin, confirmation, baseline))
    @Synchronized fun prepare(change: FriendLockAdultChange, configuration: FriendLockConfiguration): FriendLockReceipt {
        val record = requiredRecord()
        if (record.operations.size >= 32) fail(FriendLockError.AUTHORIZATION_CAPACITY)
        val receipt = FriendLockReceipt(crypto.random(16).friendHex(), change.digest(crypto), configuration, record.lockRevision, record.authorizationGeneration, FriendLockOperationState.AWAITING_SECRET)
        if (record.operations.any { it.operationID == receipt.operationID }) fail(FriendLockError.CRYPTO_UNAVAILABLE)
        store.publish(record.copy(operations = record.operations + receipt), record); return receipt
    }
    @Synchronized fun authorize(pin: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration, operationID: String? = null): FriendLockReceipt {
        val current = requiredRecord()
        val prepared = operationID?.let { scoped(current, it, change, configuration) }
        if (prepared != null && prepared.state != FriendLockOperationState.AWAITING_SECRET) return prepared
        if (prepared == null && current.operations.size >= 32) fail(FriendLockError.AUTHORIZATION_CAPACITY)
        val reserved = verify(FriendLockSecret.Pin(pin), current)
        val receipt = prepared?.copy(state = FriendLockOperationState.AUTHORIZED) ?: FriendLockReceipt(crypto.random(16).friendHex(), change.digest(crypto), configuration, reserved.lockRevision, reserved.authorizationGeneration, FriendLockOperationState.AUTHORIZED)
        if (prepared == null && reserved.operations.any { it.operationID == receipt.operationID }) fail(FriendLockError.CRYPTO_UNAVAILABLE)
        val operations = if (prepared == null) reserved.operations + receipt else reserved.operations.map { if (it.operationID == operationID) receipt else it }
        store.publish(reserved.copy(operations = operations, pinThrottle = FriendLockThrottle()), reserved)
        return receipt
    }
    @Synchronized fun retry(operationID: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration) = scoped(requiredRecord(), operationID, change, configuration)
    @Synchronized fun claim(operationID: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration): FriendLockReceipt {
        val record = requiredRecord(); val receipt = scoped(record, operationID, change, configuration)
        if (receipt.state == FriendLockOperationState.AWAITING_SECRET) fail(FriendLockError.INVALID_TRANSITION)
        if (receipt.state != FriendLockOperationState.AUTHORIZED) return receipt // COMPLETED is an exact receipt, never permission to repeat.
        val claimed = receipt.copy(state = FriendLockOperationState.IN_FLIGHT)
        store.publish(record.copy(operations = record.operations.map { if (it.operationID == operationID) claimed else it }), record)
        return claimed
    }
    @Synchronized fun complete(operationID: String, change: FriendLockAdultChange, originalConfiguration: FriendLockConfiguration, resultingConfiguration: FriendLockConfiguration, nativeReadback: ByteArray): FriendLockReceipt {
        if (nativeReadback.isEmpty() || nativeReadback.size > 32_768) fail(FriendLockError.BASELINE_UNAVAILABLE)
        val record = requiredRecord(); val receipt = record.operations.firstOrNull { it.operationID == operationID } ?: fail(FriendLockError.UNKNOWN_OPERATION)
        if (receipt.deltaDigest != change.digest(crypto) || receipt.configuration != originalConfiguration) fail(FriendLockError.SCOPE_MISMATCH)
        val digest = crypto.digest(nativeReadback).friendHex()
        if (receipt.state == FriendLockOperationState.COMPLETED) {
            if (receipt.resultingConfiguration != resultingConfiguration || receipt.readbackDigest != digest) fail(FriendLockError.SCOPE_MISMATCH)
            return receipt
        }
        if (receipt.state != FriendLockOperationState.IN_FLIGHT) fail(if (receipt.state == FriendLockOperationState.CANCELLED) FriendLockError.CANCELLED else FriendLockError.INVALID_TRANSITION)
        val completed = receipt.copy(state = FriendLockOperationState.COMPLETED, resultingConfiguration = resultingConfiguration, readbackDigest = digest)
        store.publish(record.copy(operations = record.operations.map { if (it.operationID == operationID) completed else it }), record)
        return completed
    }
    @Synchronized fun cancel(operationID: String): FriendLockReceipt {
        val record = requiredRecord(); val receipt = record.operations.firstOrNull { it.operationID == operationID } ?: fail(FriendLockError.UNKNOWN_OPERATION)
        if (receipt.state == FriendLockOperationState.COMPLETED) fail(FriendLockError.INVALID_TRANSITION)
        val cancelled = receipt.copy(state = FriendLockOperationState.CANCELLED)
        store.publish(record.copy(operations = record.operations.map { if (it.operationID == operationID) cancelled else it }), record)
        return cancelled
    }
    @Synchronized fun invalidateAuthorizations() {
        val record = requiredRecord()
        if (record.authorizationGeneration == 9_007_199_254_740_991L) fail(FriendLockError.CORRUPT)
        store.publish(record.copy(authorizationGeneration = record.authorizationGeneration + 1, operations = emptyList()), record)
    }
    @Synchronized fun rotate(secret: FriendLockSecret, newPIN: String, confirmation: String): FriendLockEnrollment {
        validatePIN(newPIN, confirmation)
        val reserved = verify(secret, requiredRecord())
        if (reserved.lockRevision == 9_007_199_254_740_991L || reserved.authorizationGeneration == 9_007_199_254_740_991L) fail(FriendLockError.CORRUPT)
        if (MessageDigest.isEqual(crypto.derive(newPIN, reserved.pin.salt), reserved.pin.derived)) fail(FriendLockError.INVALID_PIN)
        val key = crypto.random(32).friendHex()
        val candidate = reserved.copy(pin = verifier(newPIN), recovery = verifier(key), lockRevision = reserved.lockRevision + 1,
            authorizationGeneration = reserved.authorizationGeneration + 1, operations = emptyList(),
            pinThrottle = if (secret is FriendLockSecret.Pin) FriendLockThrottle() else reserved.pinThrottle,
            recoveryThrottle = if (secret is FriendLockSecret.Recovery) FriendLockThrottle() else reserved.recoveryThrottle)
        store.publish(candidate, reserved); return FriendLockEnrollment(candidate.lockRevision, key)
    }
    private fun validatePIN(pin: String, confirmation: String) {
        if (pin.length != 6 || !pin.all { it in '0'..'9' }) fail(FriendLockError.INVALID_PIN)
        if (pin != confirmation) fail(FriendLockError.PIN_MISMATCH)
    }
    private fun verifier(value: String): FriendLockVerifier { val salt = crypto.random(16); return FriendLockVerifier(salt, crypto.derive(value, salt)) }
    private fun requiredRecord() = store.load() ?: fail(FriendLockError.NOT_ENROLLED)
    private fun verify(secret: FriendLockSecret, record: FriendLockRecord): FriendLockRecord = synchronized(verificationGate) {
        val isPIN = secret is FriendLockSecret.Pin
        val input = when (secret) { is FriendLockSecret.Pin -> secret.value; is FriendLockSecret.Recovery -> secret.value }
        val verifier = if (isPIN) record.pin else record.recovery
        val now = clock.now()
        val advanced = (if (isPIN) record.pinThrottle else record.recoveryThrottle).advance(now)
        if (advanced.remainingMilliseconds > 0) {
            store.publish(if (isPIN) record.copy(pinThrottle = advanced) else record.copy(recoveryThrottle = advanced), record)
            fail(FriendLockError.THROTTLED)
        }
        val throttle = advanced.reserve(now)
        val reserved = if (isPIN) record.copy(pinThrottle = throttle) else record.copy(recoveryThrottle = throttle)
        store.publish(reserved, record) // Reservation is durable before KDF; interruptions consume the attempt.
        val valid = if (isPIN) input.length == 6 && input.all { it in '0'..'9' } else validHex(input, 64)
        if (!valid || !MessageDigest.isEqual(crypto.derive(input, verifier.salt), verifier.derived)) fail(FriendLockError.INCORRECT_SECRET)
        reserved // Clear only with the durable authorization/rotation transaction.
    }
    private fun scoped(record: FriendLockRecord, operationID: String, change: FriendLockAdultChange, configuration: FriendLockConfiguration): FriendLockReceipt {
        val receipt = record.operations.firstOrNull { it.operationID == operationID } ?: fail(FriendLockError.UNKNOWN_OPERATION)
        if (receipt.state == FriendLockOperationState.CANCELLED) fail(FriendLockError.CANCELLED)
        val expected = if (receipt.state == FriendLockOperationState.COMPLETED) receipt.resultingConfiguration else receipt.configuration
        if (receipt.deltaDigest != change.digest(crypto) || expected != configuration || receipt.lockRevision != record.lockRevision || receipt.authorizationGeneration != record.authorizationGeneration) fail(FriendLockError.SCOPE_MISMATCH)
        return receipt
    }
}
