package app.freed.protection

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.security.MessageDigest

internal interface FriendLockProtectedBytes {
    fun beginAccess() {}
    fun endAccess() {}
    fun read(key: String): ByteArray?
    fun write(key: String, value: ByteArray)
    fun remove(key: String)
}
internal object FriendLockRecordCodec {
    const val MAX_BYTES = 65_536
    private fun DataOutputStream.text(value: String) { val data = value.toByteArray(Charsets.UTF_8); writeInt(data.size); write(data) }
    private fun DataInputStream.text(maximum: Int): String = bytes(maximum).toString(Charsets.UTF_8)
    private fun DataOutputStream.bytes(value: ByteArray) { writeInt(value.size); write(value) }
    private fun DataInputStream.bytes(maximum: Int): ByteArray {
        val count = readInt(); if (count < 0 || count > maximum || count > available()) fail(FriendLockError.CORRUPT)
        return ByteArray(count).also { readFully(it) }
    }
    private fun DataOutputStream.configuration(value: FriendLockConfiguration) { text(value.revision); text(value.mutationGeneration) }
    private fun DataInputStream.configuration() = FriendLockConfiguration(text(128), text(128))
    private fun DataOutputStream.throttle(value: FriendLockThrottle) { writeInt(value.failures); writeLong(value.remainingMilliseconds); text(value.session); writeLong(value.lastMilliseconds) }
    private fun DataInputStream.throttle() = FriendLockThrottle(readInt(), readLong(), text(128), readLong())
    fun encode(record: FriendLockRecord): ByteArray {
        if (!record.valid()) fail(FriendLockError.CORRUPT)
        val buffer = ByteArrayOutputStream()
        DataOutputStream(buffer).use { out ->
            out.writeInt(record.schema); out.writeLong(record.lockRevision); out.writeLong(record.authorizationGeneration); out.text(record.enrollmentBaselineDigest)
            out.bytes(record.pin.salt); out.bytes(record.pin.derived); out.bytes(record.recovery.salt); out.bytes(record.recovery.derived)
            out.throttle(record.pinThrottle); out.throttle(record.recoveryThrottle); out.writeInt(record.operations.size)
            record.operations.forEach { receipt ->
                out.text(receipt.operationID); out.text(receipt.deltaDigest); out.configuration(receipt.configuration)
                out.writeLong(receipt.lockRevision); out.writeLong(receipt.authorizationGeneration); out.writeInt(receipt.state.ordinal)
                out.writeBoolean(receipt.resultingConfiguration != null)
                receipt.resultingConfiguration?.let { out.configuration(it) }
                out.writeBoolean(receipt.readbackDigest != null); receipt.readbackDigest?.let { out.text(it) }
            }
        }
        return buffer.toByteArray().also { if (it.size > MAX_BYTES) fail(FriendLockError.CORRUPT) }
    }
    fun decode(bytes: ByteArray): FriendLockRecord = try {
        if (bytes.size > MAX_BYTES) fail(FriendLockError.CORRUPT)
        DataInputStream(ByteArrayInputStream(bytes)).use { input ->
            val schema = input.readInt(); val revision = input.readLong(); val generation = input.readLong(); val baseline = input.text(64)
            val pin = FriendLockVerifier(input.bytes(16), input.bytes(32)); val recovery = FriendLockVerifier(input.bytes(16), input.bytes(32))
            val pinThrottle = input.throttle(); val recoveryThrottle = input.throttle(); val count = input.readInt()
            if (count !in 0..32) fail(FriendLockError.CORRUPT)
            val receipts = List(count) {
                val id = input.text(32); val digest = input.text(64); val config = input.configuration()
                val lockRevision = input.readLong(); val authorizationGeneration = input.readLong(); val state = input.readInt()
                if (state !in FriendLockOperationState.entries.indices) fail(FriendLockError.CORRUPT)
                val result = if (input.readBoolean()) input.configuration() else null
                val readback = if (input.readBoolean()) input.text(64) else null
                FriendLockReceipt(id, digest, config, lockRevision, authorizationGeneration, FriendLockOperationState.entries[state], result, readback)
            }
            val record = FriendLockRecord(baseline, pin, recovery, schema, revision, generation, pinThrottle, recoveryThrottle, receipts)
            if (input.available() != 0 || !record.valid()) fail(FriendLockError.CORRUPT)
            record
        }
    } catch (_: Exception) { fail(FriendLockError.CORRUPT) }
    const val MAX_JOURNAL_BYTES = MAX_BYTES * 2 + 32
    fun journal(value: FriendLockJournal): ByteArray {
        val buffer = ByteArrayOutputStream()
        DataOutputStream(buffer).use {
            it.writeInt(2); it.writeInt(if (value.committed) 1 else 0); it.writeBoolean(value.previous != null)
            value.previous?.let { previous -> it.bytes(previous) }; it.bytes(value.candidate)
        }
        return buffer.toByteArray().also { if (it.size > MAX_JOURNAL_BYTES) fail(FriendLockError.CORRUPT) }
    }
    fun decodeJournal(journal: ByteArray): FriendLockJournal = try {
        if (journal.size > MAX_JOURNAL_BYTES) fail(FriendLockError.CORRUPT)
        DataInputStream(ByteArrayInputStream(journal)).use {
            if (it.readInt() != 2) fail(FriendLockError.CORRUPT)
            val phase = it.readInt(); if (phase !in 0..1) fail(FriendLockError.CORRUPT)
            val previous = if (it.readBoolean()) it.bytes(MAX_BYTES) else null
            val candidate = it.bytes(MAX_BYTES)
            if (it.available() != 0) fail(FriendLockError.CORRUPT)
            previous?.let { bytes -> decode(bytes) }; decode(candidate)
            FriendLockJournal(phase == 1, previous, candidate)
        }
    } catch (_: Exception) { fail(FriendLockError.CORRUPT) }
}
internal class FriendLockJournal(val committed: Boolean, val previous: ByteArray?, val candidate: ByteArray)

// A successful transaction retains previous/current protected generations. No journal deletion.
internal class FriendLockRecordStore(private val bytes: FriendLockProtectedBytes) {
    companion object { private val processLock = Any() }
    private fun <T> exclusive(operation: () -> T): T = synchronized(processLock) {
        try { bytes.beginAccess() } catch (_: Exception) { fail(FriendLockError.STORAGE_UNAVAILABLE) }
        try { operation() } catch (failure: FriendLockException) { throw failure } catch (_: Exception) { fail(FriendLockError.STORAGE_UNAVAILABLE) }
        finally { try { bytes.endAccess() } catch (_: Exception) { /* Closing a lock must not retroactively fail a verified commit. */ } }
    }
    private fun same(left: ByteArray?, right: ByteArray?) = if (left == null || right == null) left == null && right == null else MessageDigest.isEqual(left, right)
    private fun rollback(journal: FriendLockJournal): ByteArray {
        val previous = journal.previous ?: fail(FriendLockError.MISSING_ENROLLED)
        if (journal.committed) fail(FriendLockError.CORRUPT)
        bytes.write("record", previous)
        if (!same(bytes.read("record"), previous)) fail(FriendLockError.STORAGE_UNAVAILABLE)
        val rolledBack = FriendLockRecordCodec.journal(FriendLockJournal(true, null, previous))
        bytes.write("journal", rolledBack)
        if (!same(bytes.read("journal"), rolledBack)) fail(FriendLockError.STORAGE_UNAVAILABLE)
        return previous
    }
    private fun raw(): ByteArray? {
        val witness = bytes.read("witness"); val record = bytes.read("record"); val encoded = bytes.read("journal")
        if (witness == null) { if (record != null || encoded != null) fail(FriendLockError.CORRUPT); return null }
        if (!witness.contentEquals(byteArrayOf(1))) fail(FriendLockError.CORRUPT)
        if (encoded == null) fail(FriendLockError.MISSING_ENROLLED)
        val journal = FriendLockRecordCodec.decodeJournal(encoded)
        if (!journal.committed) return rollback(journal)
        if (record == null) fail(FriendLockError.MISSING_ENROLLED)
        if (!same(record, journal.candidate)) fail(FriendLockError.CORRUPT)
        return journal.candidate
    }
    fun load(): FriendLockRecord? = exclusive { raw()?.let { FriendLockRecordCodec.decode(it) } }
    fun publish(candidate: FriendLockRecord, expected: FriendLockRecord?) = exclusive {
        val previous = raw(); val expectedBytes = expected?.let { FriendLockRecordCodec.encode(it) }; val next = FriendLockRecordCodec.encode(candidate)
        if (!same(previous, expectedBytes)) fail(FriendLockError.STORAGE_CONFLICT)
        if (previous == null) { bytes.write("witness", byteArrayOf(1)); if (!same(bytes.read("witness"), byteArrayOf(1))) fail(FriendLockError.STORAGE_UNAVAILABLE) }
        val prepared = FriendLockJournal(false, previous, next)
        val pending = FriendLockRecordCodec.journal(prepared)
        try {
            bytes.write("journal", pending); if (!same(bytes.read("journal"), pending)) fail(FriendLockError.STORAGE_UNAVAILABLE)
            bytes.write("record", next); if (!same(bytes.read("record"), next)) fail(FriendLockError.STORAGE_UNAVAILABLE)
        } catch (_: Exception) {
            if (previous != null) try { if (same(bytes.read("journal"), pending)) rollback(prepared) } catch (_: Exception) { }
            fail(FriendLockError.STORAGE_UNAVAILABLE)
        }
        val committed = FriendLockRecordCodec.journal(FriendLockJournal(true, previous, next))
        var commitWriteReturned = false
        try {
            bytes.write("journal", committed); commitWriteReturned = true
            if (!same(bytes.read("journal"), committed)) fail(FriendLockError.STORAGE_UNAVAILABLE)
            // Completion ends here; optional cleanup cannot retroactively fail a verified commit.
        } catch (_: Exception) {
            val observed = try { bytes.read("journal") } catch (_: Exception) { fail(FriendLockError.COMMIT_OUTCOME_UNKNOWN) }
            if (same(observed, committed) && !commitWriteReturned) fail(FriendLockError.COMMIT_OUTCOME_UNKNOWN)
            if (!same(observed, committed)) {
                if (same(observed, pending)) {
                    if (previous != null) try { rollback(prepared) } catch (_: Exception) { }
                    fail(FriendLockError.STORAGE_UNAVAILABLE)
                }
                fail(FriendLockError.CORRUPT)
            }
            // A second read has now confirmed the committed phase, so this is native success.
        }
    }
}
