package app.freed.protection

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream

/** The entire candidate, including opaque metadata, is inside one authenticated ciphertext. */
internal object FreedRecoveryDnsPilotRecord {
  const val MAX_CANDIDATES = 8
  data class Operation(val id: String, val reference: String, val ownerScopeDigest: String,
    val before: String, val desired: String, val baselineRevision: String, val adultGeneration: String,
    val networkEpoch: String, val phase: String, val friendOperationID: String? = null, val activation: Boolean = false) {
    init {
      require(FreedRecoveryDnsPilotPolicy.validReference(id) && FreedRecoveryDnsPilotPolicy.validReference(reference))
      require(FreedRecoveryDnsPilotPolicy.validDigest(ownerScopeDigest) && FreedRecoveryDnsPilotPolicy.validDigest(baselineRevision))
      require(before.length in 1..256 && desired.length in 1..256 && networkEpoch.length in 1..128)
      require(adultGeneration.matches(Regex("^[1-9][0-9]{0,15}$")))
      require(phase in setOf("prepared", "authorized", "applying", "completed", "failed", "cancelled"))
      require(friendOperationID == null || FreedRecoveryDnsPilotPolicy.validReference(friendOperationID))
    }
  }
  data class State(val candidates: List<FreedRecoveryDnsPilotPolicy.Candidate> = emptyList(),
    val activeReference: String? = null, val operations: List<Operation> = emptyList()) {
    init {
      require(activeReference == null || candidates.any { it.reference == activeReference })
      require(operations.size <= 32 && operations.map { it.id }.toSet().size == operations.size)
      require(operations.all { op -> candidates.any { it.reference == op.reference } })
    }
  }
  /** A staged reference is the retry identity. A retry never creates fresh native authority. */
  fun originalOperation(state: State, candidate: FreedRecoveryDnsPilotPolicy.Candidate,
    activation: Boolean): Operation? = state.operations.singleOrNull {
      it.reference == candidate.reference && it.ownerScopeDigest == candidate.ownerScopeDigest &&
        it.adultGeneration == candidate.adultGeneration && it.activation == activation
    }.also {
      check(state.operations.count { operation -> operation.reference == candidate.reference &&
        operation.ownerScopeDigest == candidate.ownerScopeDigest && operation.adultGeneration == candidate.adultGeneration &&
        operation.activation == activation } <= 1) { "recovery-dns-operation-identity-ambiguous" }
    }
  /** Renew only ephemeral admission; preserve installed identity and all historical receipts. */
  fun renewBinding(state: State, reference: String, scope: String, identity: String, generation: String): State {
    val previous = state.candidates.single { it.reference == reference }
    val next = previous.renew(scope, identity, generation)
    if (next === previous) return state
    val stale = state.operations.filter { previous.ownerScopeDigest != next.ownerScopeDigest &&
      it.reference == reference && it.ownerScopeDigest == previous.ownerScopeDigest }
    check(stale.none { it.phase in setOf("applying", "failed") }) { "recovery-dns-operation-outcome-unknown" }
    return state.copy(candidates = state.candidates.map { if (it.reference == reference) next else it },
      operations = state.operations.map {
        if (it in stale && it.phase in setOf("prepared", "authorized")) it.copy(phase = "cancelled") else it
      })
  }
  fun scopedCandidate(state: State, scope: String, identity: String, generation: String): FreedRecoveryDnsPilotPolicy.Candidate? =
    state.candidates.firstOrNull { it.reference == state.activeReference && it.ownedBy(scope, identity, generation) }
      ?: state.candidates.lastOrNull { it.ownedBy(scope, identity, generation) }
  fun encode(state: State): ByteArray {
    val values = state.candidates
    require(values.size <= MAX_CANDIDATES && values.map { it.reference }.toSet().size == values.size)
    val buffer = ByteArrayOutputStream()
    DataOutputStream(buffer).use { output ->
      output.writeInt(3)
      output.writeInt(values.size)
      values.forEach { value ->
        listOf(value.reference, value.rawSecret, value.credentialHash, value.audience, value.ownerGeneration,
          value.installationId, value.ownerScopeDigest, value.adultGeneration, value.configurationGeneration).forEach { text ->
          val bytes = text.toByteArray(Charsets.UTF_8)
          require(bytes.size <= 256)
          output.writeInt(bytes.size); output.write(bytes)
        }
        output.writeUTF(value.ownerIdentityDigest ?: "")
      }
      output.writeUTF(state.activeReference ?: "")
      output.writeInt(state.operations.size)
      state.operations.forEach { value ->
        listOf(value.id, value.reference, value.ownerScopeDigest, value.before, value.desired,
          value.baselineRevision, value.adultGeneration, value.networkEpoch, value.phase,
          value.friendOperationID ?: "").forEach(output::writeUTF)
        output.writeBoolean(value.activation)
      }
    }
    return buffer.toByteArray().also { require(it.size <= FreedRecoveryDnsPilotPolicy.MAX_RECORD_BYTES) }
  }

  fun decode(value: ByteArray): State {
    require(value.size <= FreedRecoveryDnsPilotPolicy.MAX_RECORD_BYTES)
    DataInputStream(ByteArrayInputStream(value)).use { input ->
      val version = input.readInt().also { require(it in setOf(2, 3)) }
      val count = input.readInt().also { require(it in 0..MAX_CANDIDATES) }
      fun text(): String {
        val size = input.readInt().also { require(it in 1..256 && it <= input.available()) }
        val bytes = ByteArray(size).also(input::readFully)
        val decoded = bytes.toString(Charsets.UTF_8)
        require(decoded.toByteArray(Charsets.UTF_8).contentEquals(bytes))
        return decoded
      }
      val values = List(count) {
        FreedRecoveryDnsPilotPolicy.Candidate(text(), text(), text(), text(), text(), text(), text(), text(), text(),
          if (version >= 3) input.readUTF().ifEmpty { null } else null)
      }
      val active = input.readUTF().ifEmpty { null }
      val operationCount = input.readInt().also { require(it in 0..32) }
      val operations = List(operationCount) {
        Operation(input.readUTF(), input.readUTF(), input.readUTF(), input.readUTF(), input.readUTF(),
          input.readUTF(), input.readUTF(), input.readUTF(), input.readUTF(), input.readUTF().ifEmpty { null }, input.readBoolean())
      }
      require(input.available() == 0 && values.map { it.reference }.toSet().size == values.size)
      return State(values, active, operations)
    }
  }
}
