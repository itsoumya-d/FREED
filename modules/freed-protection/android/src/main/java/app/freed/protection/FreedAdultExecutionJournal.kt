package app.freed.protection

import android.content.Context
import android.util.AtomicFile
import android.system.Os
import android.system.OsConstants
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File

/** Separate no-backup namespace; never a protected-record key or independent authority. */
internal interface FreedAdultJournalIO {
  fun read(): ByteArray?
  fun write(value: ByteArray)
}
internal class FreedAdultJournalFile(context: Context) : FreedAdultJournalIO {
  // AtomicFile.openRead performs recovery. It must not run inside another
  // publisher's startWrite/finishWrite/readback/failure interval. This lock
  // never acquires an adult, grant, service or output lock; separate adapters
  // for this process's journal share the same I/O exclusion.
  private companion object { val ioLock = Any() }
  private val directory = File(context.noBackupFilesDir, "freed-adult-execution-v1")
  private val file = AtomicFile(File(directory, "execution"))
  override fun read(): ByteArray? = synchronized(ioLock) {
    if (!directory.exists()) return@synchronized null
    try { file.openRead().use { input ->
      val value = input.readBytes()
      check(value.size <= 16_777_216) { "adult-journal-too-large" }; value
    } } catch (failure: java.io.FileNotFoundException) {
      // A created namespace with no intact journal is never treated as a fresh install.
      throw IllegalStateException("adult-journal-missing", failure)
    }
  }
  override fun write(value: ByteArray): Unit = synchronized(ioLock) {
    check(value.size <= 16_777_216)
    check(directory.isDirectory || directory.mkdirs())
    val stream = file.startWrite()
    try {
      stream.write(value); stream.fd.sync(); file.finishWrite(stream)
      val descriptor = Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
      try { Os.fsync(descriptor) } finally { Os.close(descriptor) }
      check(file.openRead().use { it.readBytes() }.contentEquals(value)) { "adult-journal-readback" }
    } catch (failure: Exception) { file.failWrite(stream); throw failure }
  }
}
internal data class FreedAdultStep(val layer: String, val before: String, val desired: String)
internal enum class FreedAdultHostPhase { PREPARED, AUTHORIZED, CLAIM_RESERVED, CLAIMED, OUTCOME, COMPLETED, CANCELLED }
internal data class FreedAdultHostOperation(
  val action: FriendLockAction,
  val receipt: FriendLockReceipt,
  val steps: List<FreedAdultStep>,
  val phase: FreedAdultHostPhase,
  val dispatched: Set<String> = emptySet(),
  val observed: Map<String, String> = emptyMap(),
  val outcome: String? = null
) {
  fun change(): FriendLockAdultChange = FriendLockAdultChange(action, buildMap {
    put("scope", "native-adult-v1")
    put("layers", steps.joinToString(",") { it.layer })
    steps.forEach { step ->
      put("${step.layer}.before", digest(step.before)); put("${step.layer}.desired", digest(step.desired))
    }
  })
  companion object {
    fun digest(value: String) = java.security.MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).friendHex()
  }
}
internal data class FreedAdultCleanupReservation(val generation: Long, val phase: String, val lockRevision: Long = -1, val authorizationGeneration: Long = -1)
internal data class FreedAdultJournalSnapshot(
  val generation: Long = 1,
  val adultAccessibility: Boolean? = null,
  val uncertainty: Set<String> = emptySet(),
  val operations: Map<String, FreedAdultHostOperation> = emptyMap(),
  val cleanups: Map<String, FreedAdultCleanupReservation> = emptyMap()
)
internal class FreedAdultExecutionJournal(private val io: FreedAdultJournalIO) {
  fun initialize(): FreedAdultJournalSnapshot {
    val existing = io.read()
    if (existing != null) return decode(existing)
    return FreedAdultJournalSnapshot().also(::save)
  }
  fun read(): FreedAdultJournalSnapshot = decode(io.read() ?: error("adult-journal-unavailable"))
  fun validateCapacity(value: FreedAdultJournalSnapshot) { encode(value) }
  fun save(value: FreedAdultJournalSnapshot) {
    val encoded = encode(value); io.write(encoded)
    check(io.read()?.contentEquals(encoded) == true) { "adult-journal-save-unknown" }
    check(decode(encoded) == value)
  }
  private fun encode(value: FreedAdultJournalSnapshot): ByteArray {
    check(value.generation in 1..9_007_199_254_740_991L && value.operations.size <= 32 && value.uncertainty.size <= 128)
    val buffer = ByteArrayOutputStream()
    DataOutputStream(buffer).use { out ->
      fun string(s: String) { val bytes = s.toByteArray(Charsets.UTF_8); check(bytes.size <= 4_194_304); out.writeInt(bytes.size); out.write(bytes) }
      fun configuration(c: FriendLockConfiguration) { string(c.revision); string(c.mutationGeneration) }
      out.writeInt(0x46414532); out.writeLong(value.generation)
      out.writeByte(when (value.adultAccessibility) { null -> -1; false -> 0; true -> 1 })
      out.writeInt(value.uncertainty.size); value.uncertainty.sorted().forEach(::string)
      out.writeInt(value.operations.size)
      value.operations.toSortedMap().forEach { (id, host) ->
        check(id == host.receipt.operationID && host.receipt.valid() && host.steps.size in 1..8)
        val receipt = host.receipt
        string(id); string(host.action.name); string(receipt.deltaDigest); configuration(receipt.configuration)
        out.writeLong(receipt.lockRevision); out.writeLong(receipt.authorizationGeneration); string(receipt.state.name)
        out.writeBoolean(receipt.resultingConfiguration != null); receipt.resultingConfiguration?.let(::configuration)
        string(receipt.readbackDigest ?: ""); string(host.phase.name); string(host.outcome ?: "")
        out.writeInt(host.steps.size); host.steps.forEach { string(it.layer); string(it.before); string(it.desired) }
        out.writeInt(host.dispatched.size); host.dispatched.sorted().forEach(::string)
        out.writeInt(host.observed.size); host.observed.toSortedMap().forEach { (key, outcome) -> string(key); string(outcome) }
      }
      check(value.cleanups.size <= 32)
      out.writeInt(value.cleanups.size)
      value.cleanups.toSortedMap().forEach { (id, reservation) ->
        check(java.util.UUID.fromString(id).toString() == id && reservation.phase in setOf("requested", "reserved", "complete", "superseded"))
        string(id); out.writeLong(reservation.generation); string(reservation.phase)
        out.writeLong(reservation.lockRevision); out.writeLong(reservation.authorizationGeneration)
      }
    }
    return buffer.toByteArray().also { check(it.size <= 16_777_216) }
  }
  private fun decode(bytes: ByteArray): FreedAdultJournalSnapshot {
    check(bytes.size <= 16_777_216)
    DataInputStream(ByteArrayInputStream(bytes)).use { input ->
      fun count(max: Int): Int = input.readInt().also { check(it in 0..max) }
      fun string(): String { val size = count(4_194_304); check(size <= input.available()); return ByteArray(size).also(input::readFully).toString(Charsets.UTF_8) }
      fun configuration() = FriendLockConfiguration(string(), string())
      val schema = input.readInt(); check(schema in setOf(0x46414531, 0x46414532))
      val generation = input.readLong(); check(generation in 1..9_007_199_254_740_991L)
      val adult = when (input.readByte().toInt()) { -1 -> null; 0 -> false; 1 -> true; else -> error("adult-intent-corrupt") }
      val uncertainty = List(count(128)) { string() }.toSet()
      val operations = linkedMapOf<String, FreedAdultHostOperation>()
      repeat(count(32)) {
        val id = string(); val action = FriendLockAction.valueOf(string()); val digest = string(); val config = configuration()
        val revision = input.readLong(); val authorization = input.readLong(); val state = FriendLockOperationState.valueOf(string())
        val result = if (input.readBoolean()) configuration() else null
        val readback = string().ifEmpty { null }; val phase = FreedAdultHostPhase.valueOf(string()); val outcome = string().ifEmpty { null }
        val steps = List(count(8)) { FreedAdultStep(string(), string(), string()) }
        check(steps.isNotEmpty() && steps.map { it.layer }.toSet().size == steps.size)
        val dispatched = List(count(8)) { string() }.toSet()
        val observed = linkedMapOf<String, String>(); repeat(count(8)) { check(observed.put(string(), string()) == null) }
        check(dispatched.all { layer -> steps.any { it.layer == layer } } && observed.keys.all { it in dispatched })
        val receipt = FriendLockReceipt(id, digest, config, revision, authorization, state, result, readback)
        check(receipt.valid() && operations.put(id, FreedAdultHostOperation(action, receipt, steps, phase, dispatched, observed, outcome)) == null)
      }
      val cleanups = linkedMapOf<String, FreedAdultCleanupReservation>()
      if (schema == 0x46414532) repeat(count(32)) {
        val id = string(); check(java.util.UUID.fromString(id).toString() == id)
        val reservation = FreedAdultCleanupReservation(input.readLong(), string(), input.readLong(), input.readLong())
        check(reservation.generation > 0 && reservation.phase in setOf("requested", "reserved", "complete", "superseded"))
        check(cleanups.put(id, reservation) == null)
      }
      check(input.available() == 0)
      return FreedAdultJournalSnapshot(generation, adult, uncertainty, operations, cleanups)
    }
  }
}
