package app.freed.protection

// Only platform bytes are injected. Policy, KDF, codec and transaction adapter are real.
private class MemoryBytes : FriendLockProtectedBytes {
    val values = mutableMapOf<String, ByteArray>()
    var failWriteKey: String? = null
    var failReadAfterRecordWrite = false
    var recordWrites = 0
    var failReadOnRecordWrite: Int? = null
    var failRecordWrites = emptySet<Int>()
    var journalWrites = 0
    var failAfterJournalWrite: Int? = null
    var unavailable = false
    var failEndAccess = false
    override fun endAccess() { if (failEndAccess) fail(FriendLockError.STORAGE_UNAVAILABLE) }
    private var readFailureArmed = false
    override fun read(key: String): ByteArray? {
        if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE)
        if (key == "record" && readFailureArmed) { readFailureArmed = false; throw FriendLockException(FriendLockError.STORAGE_UNAVAILABLE) }
        return values[key]?.clone()
    }
    override fun write(key: String, value: ByteArray) {
        if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE)
        if (key == failWriteKey) { failWriteKey = null; throw FriendLockException(FriendLockError.STORAGE_UNAVAILABLE) }
        if (key == "record") { recordWrites++; if (recordWrites in failRecordWrites) fail(FriendLockError.STORAGE_UNAVAILABLE) }
        values[key] = value.clone()
        if (key == "journal") { journalWrites++; if (failAfterJournalWrite == journalWrites) unavailable = true }
        if (key == "record" && (failReadAfterRecordWrite || failReadOnRecordWrite == recordWrites)) { failReadAfterRecordWrite = false; readFailureArmed = true }
    }
    override fun remove(key: String) {
        if (unavailable) fail(FriendLockError.STORAGE_UNAVAILABLE)
        values.remove(key)
    }
}
private class TestClock : FriendLockClock {
    var milliseconds = 1_000L
    var session = "fixture-process-1"
    override fun now() = FriendLockInstant(session, milliseconds)
}
private fun rejects(expected: FriendLockError, operation: () -> Unit) {
    try { operation(); error("Expected $expected") }
    catch (failure: FriendLockException) { check(failure.reason == expected) { "Expected $expected; got ${failure.reason}" } }
}
fun main() {
    friendLockAdapterCases()
    check(FriendLockNativeCrypto().derive("123456", ByteArray(16) { 7 }).friendHex() == "0be74e7558e56becceb023ea559588f19bcffe4e9e5ef85d75e02917f383522d")
    val bytes = MemoryBytes()
    val clock = TestClock()
    val core = FriendLockCore(FriendLockRecordStore(bytes), FriendLockNativeCrypto(), clock)
    val context = FriendLockConfiguration("adult-7", "generation-12")
    val change = FriendLockAdultChange(FriendLockAction.DISABLE_ENCRYPTED_DNS, mapOf("provider" to "cloudflare-families", "enabled" to "false"))
    val baseline = FriendLockBaseline(context, true, "native-filter-installed".toByteArray())
    check(core.status() == FriendLockStatus.NOT_ENROLLED)
    rejects(FriendLockError.INVALID_PIN) { core.enroll("１２３４５６", "１２３４５６", baseline) }
    rejects(FriendLockError.PIN_MISMATCH) { core.enroll("123456", "123457", baseline) }
    check(bytes.values.isEmpty())
    val enrolled = core.enroll("123456", "123456", baseline)
    check(enrolled.recoveryKey.length == 64 && enrolled.lockRevision == 1L)
    check(!bytes.values.getValue("record").toString(Charsets.ISO_8859_1).contains("123456"))
    check(!bytes.values.getValue("record").toString(Charsets.ISO_8859_1).contains(enrolled.recoveryKey))
    val request = core.prepare(change, context)
    rejects(FriendLockError.INVALID_TRANSITION) { core.claim(request.operationID, change, context) }
    repeat(5) { rejects(FriendLockError.INCORRECT_SECRET) { core.authorize("000000", change, context, request.operationID) } }
    rejects(FriendLockError.THROTTLED) { core.authorize("123456", change, context) }
    clock.session = "fixture-process-2"; clock.milliseconds = 0L
    val reopened = FriendLockCore(FriendLockRecordStore(bytes), FriendLockNativeCrypto(), clock)
    rejects(FriendLockError.THROTTLED) { reopened.authorize("123456", change, context) }
    clock.milliseconds = 59_999L
    rejects(FriendLockError.THROTTLED) { reopened.authorize("123456", change, context) }
    clock.milliseconds = 60_000L
    val receipt = reopened.authorize("123456", change, context, request.operationID)
    check(reopened.authorize("000000", change, context, request.operationID) == receipt)
    val claimed = reopened.claim(receipt.operationID, change, context)
    check(claimed.state == FriendLockOperationState.IN_FLIGHT)
    check(reopened.retry(receipt.operationID, change, context) == claimed)
    val other = FriendLockAdultChange(FriendLockAction.DISABLE_ENCRYPTED_DNS, mapOf("enabled" to "true", "provider" to "cloudflare-families"))
    rejects(FriendLockError.SCOPE_MISMATCH) { reopened.retry(receipt.operationID, other, context) }
    val result = FriendLockConfiguration("adult-8", "generation-13")
    val completed = reopened.complete(receipt.operationID, change, context, result, "native-exact-off-readback".toByteArray())
    check(reopened.retry(receipt.operationID, change, result) == completed)
    rejects(FriendLockError.SCOPE_MISMATCH) { reopened.retry(receipt.operationID, change, context) }
    bytes.failReadOnRecordWrite = bytes.recordWrites + 2 // fail rotated credential readback after durable reservation
    rejects(FriendLockError.STORAGE_UNAVAILABLE) { reopened.rotate(FriendLockSecret.Recovery(enrolled.recoveryKey), "654321", "654321") }
    val afterFailure = reopened.authorize("123456", change, result)
    reopened.cancel(afterFailure.operationID)
    val rotated = reopened.rotate(FriendLockSecret.Recovery(enrolled.recoveryKey), "654321", "654321")
    check(rotated.lockRevision == 2L && rotated.recoveryKey != enrolled.recoveryKey)
    rejects(FriendLockError.INCORRECT_SECRET) { reopened.authorize("123456", change, result) }
    rejects(FriendLockError.INCORRECT_SECRET) { reopened.rotate(FriendLockSecret.Recovery(enrolled.recoveryKey), "888888", "888888") }
    rejects(FriendLockError.UNKNOWN_OPERATION) { reopened.retry(receipt.operationID, change, result) }
    val fresh = reopened.authorize("654321", change, result)
    reopened.invalidateAuthorizations()
    rejects(FriendLockError.UNKNOWN_OPERATION) { reopened.claim(fresh.operationID, change, result) }
    val saved = bytes.values.getValue("record")
    bytes.values.remove("record")
    check(reopened.status() == FriendLockStatus.MISSING_ENROLLED)
    rejects(FriendLockError.MISSING_ENROLLED) { reopened.authorize("654321", change, result) }
    bytes.values["record"] = byteArrayOf(0, 1, 2)
    check(reopened.status() == FriendLockStatus.CORRUPT)
    bytes.values["record"] = saved
    bytes.failWriteKey = "record"
    rejects(FriendLockError.STORAGE_UNAVAILABLE) { reopened.authorize("654321", change, result) }
    val afterStoreFailure = reopened.authorize("654321", change, result)
    reopened.cancel(afterStoreFailure.operationID)
    rejects(FriendLockError.CANCELLED) { reopened.claim(afterStoreFailure.operationID, change, result) }
    val beforeInterrupted = FriendLockRecordStore(bytes).load()!!
    bytes.failReadOnRecordWrite = bytes.recordWrites + 1
    bytes.failRecordWrites = setOf(bytes.recordWrites + 2)
    rejects(FriendLockError.STORAGE_UNAVAILABLE) { reopened.authorize("654321", change, result) }
    val recovered = FriendLockRecordStore(bytes).load()!!
    check(recovered.lockRevision == beforeInterrupted.lockRevision && recovered.pinThrottle.failures == beforeInterrupted.pinThrottle.failures)
    val setupBytes = MemoryBytes().apply { failWriteKey = "record" }
    val interruptedSetup = FriendLockCore(FriendLockRecordStore(setupBytes), FriendLockNativeCrypto(), clock)
    rejects(FriendLockError.STORAGE_UNAVAILABLE) { interruptedSetup.enroll("123456", "123456", baseline) }
    check(interruptedSetup.status() == FriendLockStatus.MISSING_ENROLLED)
    supplementalCases(baseline, change, context)
    commitOutageCases(baseline, change, context)
    println("PASS friend-lock Kotlin policy/store failure fixtures (source only; no device or native mutation enforcement)")
}
private fun supplementalCases(baseline: FriendLockBaseline, change: FriendLockAdultChange, context: FriendLockConfiguration) {
    val bytes = MemoryBytes(); val clock = TestClock(); val store = FriendLockRecordStore(bytes)
    val core = FriendLockCore(store, FriendLockNativeCrypto(), clock)
    rejects(FriendLockError.BASELINE_UNAVAILABLE) { core.enroll("123456", "123456", FriendLockBaseline(context, false, byteArrayOf(1))) }
    val enrollment = core.enroll("123456", "123456", baseline)
    rejects(FriendLockError.INVALID_PIN) { core.rotate(FriendLockSecret.Recovery(enrollment.recoveryKey), "123456", "123456") }
    val request = core.prepare(change, context)
    rejects(FriendLockError.SCOPE_MISMATCH) { core.authorize("123456", change, FriendLockConfiguration("adult-repair-8", "repair-generation-13"), request.operationID) }
    val delays = listOf(0L, 0L, 0L, 0L, 60_000L, 300_000L, 900_000L, 3_600_000L, 3_600_000L)
    delays.forEach { delay ->
        rejects(FriendLockError.INCORRECT_SECRET) { core.authorize("bad", change, context, request.operationID) }
        check(store.load()!!.pinThrottle.remainingMilliseconds == delay)
        if (delay > 0) rejects(FriendLockError.THROTTLED) { core.authorize("123456", change, context, request.operationID) }
        clock.milliseconds += delay
    }
    FriendLockWorker(core).use { worker ->
        val first = worker.submit { it.authorize("123456", change, context, request.operationID) }
        val second = worker.submit { it.authorize("000000", change, context, request.operationID) }
        check(first.get() == second.get())
    }
    repeat(4) { rejects(FriendLockError.INCORRECT_SECRET) { core.rotate(FriendLockSecret.Recovery("0".repeat(64)), "654321", "654321") } }
    rejects(FriendLockError.THROTTLED) { core.rotate(FriendLockSecret.Recovery(enrollment.recoveryKey), "654321", "654321") }
    clock.milliseconds += 60_000
    core.rotate(FriendLockSecret.Recovery(enrollment.recoveryKey), "654321", "654321")
    repeat(32) { core.prepare(change, context) }
    rejects(FriendLockError.AUTHORIZATION_CAPACITY) { core.prepare(change, context) }
    core.invalidateAuthorizations(); check(store.load()!!.operations.isEmpty())
    bytes.unavailable = true; check(core.status() == FriendLockStatus.UNAVAILABLE)
    rejects(FriendLockError.STORAGE_UNAVAILABLE) { core.authorize("654321", change, context) }
    bytes.unavailable = false
    val saved = bytes.values.getValue("record"); bytes.values["record"] = ByteArray(65_537)
    check(core.status() == FriendLockStatus.CORRUPT); bytes.values["record"] = saved
    bytes.failEndAccess = true
    val verified = core.prepare(change, context)
    check(verified.state == FriendLockOperationState.AWAITING_SECRET)
    check(core.retry(verified.operationID, change, context) == verified)
    bytes.failEndAccess = false
    val missingProvider = FriendLockNativeCrypto { throw java.security.NoSuchAlgorithmException("fixture-unavailable-provider") }
    val unsupported = FriendLockCore(FriendLockRecordStore(bytes), missingProvider, clock)
    val pending = unsupported.prepare(change, context)
    rejects(FriendLockError.CRYPTO_UNAVAILABLE) { unsupported.authorize("654321", change, context, pending.operationID) }
    check(store.load()!!.pinThrottle.failures == 1)
    rejects(FriendLockError.INVALID_TRANSITION) { unsupported.claim(pending.operationID, change, context) }
}
private fun commitOutageCases(baseline: FriendLockBaseline, change: FriendLockAdultChange, context: FriendLockConfiguration) {
    val bytes = MemoryBytes(); val clock = TestClock(); val core = FriendLockCore(FriendLockRecordStore(bytes), FriendLockNativeCrypto(), clock)
    val first = core.enroll("123456", "123456", baseline)
    val previous = FriendLockRecordCodec.decode(bytes.values.getValue("record"))
    bytes.failAfterJournalWrite = bytes.journalWrites + 4
    rejects(FriendLockError.COMMIT_OUTCOME_UNKNOWN) { core.rotate(FriendLockSecret.Recovery(first.recoveryKey), "654321", "654321") }
    check(core.status() == FriendLockStatus.UNAVAILABLE)
    bytes.unavailable = false
    val retained = FriendLockRecordCodec.decodeJournal(bytes.values.getValue("journal"))
    check(retained.committed && FriendLockRecordCodec.decode(retained.previous!!).pin.derived.contentEquals(previous.pin.derived))
    val reopened = FriendLockCore(FriendLockRecordStore(bytes), FriendLockNativeCrypto(), clock)
    check(reopened.status() == FriendLockStatus.ENROLLED)
    rejects(FriendLockError.INCORRECT_SECRET) { reopened.authorize("123456", change, context) }
    reopened.authorize("654321", change, context)
    val recovered = reopened.rotate(FriendLockSecret.Pin("654321"), "777777", "777777")
    check(recovered.lockRevision == 3L && recovered.recoveryKey.length == 64)
}
