package app.freed.protection

import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.net.InetAddress

fun main() {
  val secret = "ab".repeat(32)
  val input = mapOf<String, Any?>("rawSecret" to secret, "credentialHash" to FreedRecoveryDnsPilotPolicy.digest(secret),
    "audience" to "12".repeat(16), "ownerGeneration" to "1aa6a8e9-0653-468e-8c16-2c63b0422edb",
    "installationId" to "c123456789012345678901", "actionScope" to "[\"owner-a\",1,\"handle-a\"]")
  val parsed = FreedRecoveryDnsPilotPolicy.validate(input)
  check(FreedRecoveryDnsPilotPolicy.endpoint(secret) == "https://freedrecovery.web.app/dns/$secret/dns-query")
  check(FreedRecoveryDnsPilotPolicy.digest(secret) == "271a413bd339c5709fdceaec41f14f11e9fbfb5042d72d331c65f32b284cd09a")
  check(!parsed.toString().contains(secret))
  for ((key, value) in listOf("rawSecret" to secret.uppercase(), "rawSecret" to "../$secret",
    "credentialHash" to "00".repeat(32), "audience" to "x".repeat(32), "ownerGeneration" to "1-1-1-1-1",
    "installationId" to "https://freedrecovery.web.app", "actionScope" to "")) {
    check(runCatching { FreedRecoveryDnsPilotPolicy.validate(input + (key to value)) }.isFailure)
  }
  check(runCatching { FreedRecoveryDnsPilotPolicy.validate(input + ("url" to "https://evil.example")) }.isFailure)
  check(runCatching { FreedRecoveryDnsPilotPolicy.validate(input - "actionScope") }.isFailure)
  for (flag in listOf(false, true)) for (debug in listOf(false, true)) for (channel in listOf(null, "production", "internal", "development", "Internal")) {
    check(FreedRecoveryDnsPilotPolicy.supported(flag, debug, channel) == (flag && (debug || channel == "internal" || channel == "development")))
  }
  val identity = FreedRecoveryDnsPilotPolicy.digest("native-policy-owner-a:epoch1:namespace1")
  val candidate = FreedRecoveryDnsPilotPolicy.Candidate("34".repeat(16), secret, parsed.credentialHash,
    parsed.audience, parsed.ownerGeneration, parsed.installationId, FreedRecoveryDnsPilotPolicy.digest(parsed.actionScope),
    "5", "b6855645-fcbf-45aa-a2e9-3aa4f6a49630", identity)
  check(candidate.current(parsed.actionScope, "5"))
  check(!candidate.current(parsed.actionScope, "6") && !candidate.current("other-owner", "5"))
  check(!candidate.toString().contains(secret))
  check(candidate.publicReceipt().values.none { it == secret || it == parsed.actionScope || it == parsed.installationId })
  val operation = FreedRecoveryDnsPilotRecord.Operation("56".repeat(16), candidate.reference, candidate.ownerScopeDigest,
    "families:true", "pilot:${candidate.reference}:${candidate.credentialHash}:${candidate.configurationGeneration}",
    "78".repeat(32), "5", "process:1", "authorized")
  val state = FreedRecoveryDnsPilotRecord.State(listOf(candidate), candidate.reference, listOf(operation))
  val encoded = FreedRecoveryDnsPilotRecord.encode(state)
  val decoded = FreedRecoveryDnsPilotRecord.decode(encoded)
  check(decoded.activeReference == candidate.reference && decoded.candidates.single().rawSecret == secret && decoded.operations == listOf(operation))
  check(FreedRecoveryDnsPilotRecord.encode(decoded).contentEquals(encoded))
  check(runCatching { FreedRecoveryDnsPilotRecord.decode(encoded + byteArrayOf(0)) }.isFailure)
  check(runCatching { FreedRecoveryDnsPilotRecord.decode(encoded.copyOf(encoded.size - 1)) }.isFailure)
  check(runCatching { FreedRecoveryDnsPilotRecord.decode(ByteArray(65_537)) }.isFailure)
  check(runCatching { FreedRecoveryDnsPilotRecord.State(listOf(candidate), "invalid") }.isFailure)
  check(runCatching { FreedRecoveryDnsPilotRecord.encode(state.copy(candidates = listOf(candidate, candidate))) }.isFailure)
  check(runCatching { operation.copy(phase = "unknown") }.isFailure)
  for (phase in listOf("prepared", "authorized", "applying", "completed", "failed", "cancelled")) {
    val original = operation.copy(phase = phase)
    check(FreedRecoveryDnsPilotRecord.originalOperation(state.copy(operations = listOf(original)), candidate, false) == original)
    check(FreedRecoveryDnsPilotRecord.originalOperation(state.copy(operations = listOf(original)), candidate, true) == null)
  }
  val distinct = operation.copy(id = "ba".repeat(16))
  check(runCatching { FreedRecoveryDnsPilotRecord.originalOperation(state.copy(operations = listOf(operation, distinct)), candidate, false) }.isFailure)
  // Same native owner/policy epoch may renew only its ephemeral binding. Installed
  // profile identity and credentials stay fixed; old pending authority is retired.
  val nextScope = "[\"owner-a\",2,\"handle-b\"]"
  check(FreedRecoveryDnsPilotRecord.scopedCandidate(state, nextScope, identity, "5") === candidate)
  check(!candidate.current(nextScope, "5")) // metadata visibility alone does not authorize execution
  val renewed = FreedRecoveryDnsPilotRecord.renewBinding(state, candidate.reference, nextScope, identity, "5")
  val current = renewed.candidates.single()
  check(renewed.activeReference == candidate.reference && current.reference == candidate.reference)
  check(current.configurationGeneration == candidate.configurationGeneration && current.rawSecret == secret)
  check(current.current(nextScope, "5") && !current.current(parsed.actionScope, "5"))
  check(renewed.operations.single().phase == "cancelled")
  check(FreedRecoveryDnsPilotRecord.originalOperation(renewed, current, false) == null)
  check(FreedRecoveryDnsPilotRecord.renewBinding(renewed, candidate.reference, nextScope, identity, "5") === renewed)
  var restarted = renewed
  repeat(16) { index ->
    restarted = FreedRecoveryDnsPilotRecord.renewBinding(restarted, candidate.reference,
      "[\"owner-a\",${index + 3},\"new-handle-$index\"]", identity, "5")
    check(restarted.candidates.size == 1 && restarted.activeReference == candidate.reference)
    check(restarted.candidates.single().configurationGeneration == candidate.configurationGeneration)
  }
  val completed = state.copy(operations = listOf(operation.copy(phase = "completed")))
  check(FreedRecoveryDnsPilotRecord.renewBinding(completed, candidate.reference, nextScope, identity, "5").operations == completed.operations)
  val otherIdentity = FreedRecoveryDnsPilotPolicy.digest("native-policy-owner-b:epoch2:namespace2")
  for ((owner, generation) in listOf(otherIdentity to "5", identity to "6")) {
    check(FreedRecoveryDnsPilotRecord.scopedCandidate(state, nextScope, owner, generation) == null)
    check(runCatching { FreedRecoveryDnsPilotRecord.renewBinding(state, candidate.reference, nextScope, owner, generation) }.isFailure)
  }
  for (phase in listOf("applying", "failed")) {
    check(runCatching { FreedRecoveryDnsPilotRecord.renewBinding(state.copy(operations = listOf(operation.copy(phase = phase))),
      candidate.reference, nextScope, identity, "5") }.isFailure)
  }
  val otherCandidate = FreedRecoveryDnsPilotPolicy.Candidate("cd".repeat(16), secret, parsed.credentialHash,
    parsed.audience, parsed.ownerGeneration, parsed.installationId, FreedRecoveryDnsPilotPolicy.digest("owner-b-scope"),
    "5", "3f1cd288-938c-4acc-9cc1-39ea7309f5c0", otherIdentity)
  val differentOwnerActive = state.copy(candidates = listOf(candidate, otherCandidate), activeReference = otherCandidate.reference)
  check(FreedRecoveryDnsPilotRecord.scopedCandidate(differentOwnerActive, nextScope, identity, "5") === candidate)
  // Version 2 did not save stable owner identity. It may upgrade only while its
  // original native scope is still acknowledged, never by guessing a former owner.
  val legacyBuffer = ByteArrayOutputStream()
  DataOutputStream(legacyBuffer).use { output ->
    output.writeInt(2); output.writeInt(1)
    listOf(candidate.reference, secret, parsed.credentialHash, parsed.audience, parsed.ownerGeneration,
      parsed.installationId, candidate.ownerScopeDigest, "5", candidate.configurationGeneration).forEach {
      val bytes = it.toByteArray(Charsets.UTF_8); output.writeInt(bytes.size); output.write(bytes)
    }
    output.writeUTF(candidate.reference); output.writeInt(0)
  }
  val legacy = FreedRecoveryDnsPilotRecord.decode(legacyBuffer.toByteArray())
  check(legacy.candidates.single().ownerIdentityDigest == null)
  check(FreedRecoveryDnsPilotRecord.scopedCandidate(legacy, nextScope, identity, "5") == null)
  check(runCatching { FreedRecoveryDnsPilotRecord.renewBinding(legacy, candidate.reference, nextScope, identity, "5") }.isFailure)
  val upgraded = FreedRecoveryDnsPilotRecord.renewBinding(legacy, candidate.reference, parsed.actionScope, identity, "5")
  check(upgraded.candidates.single().ownerIdentityDigest == identity)
  check(FreedRecoveryDnsPilotRecord.decode(FreedRecoveryDnsPilotRecord.encode(upgraded)).candidates.single().ownerIdentityDigest == identity)

  val nonce = "9a".repeat(16)
  val host = FreedRecoveryDnsPilotWire.host(nonce)
  check(host == "a.$nonce.probe.freedrecovery.web.app")
  check(FreedRecoveryDnsPilotWire.host(nonce, true) == "b.$nonce.probe.freedrecovery.web.app")
  fun answer(query: ByteArray, type: Int, address: String): ByteArray {
    val header = query.copyOf().also { it[2] = 0x81.toByte(); it[3] = 0x80.toByte(); it[7] = 1 }
    val buffer = ByteArrayOutputStream(); buffer.write(header)
    DataOutputStream(buffer).use { output ->
      val bytes = InetAddress.getByName(address).address
      output.writeShort(0xc00c); output.writeShort(type); output.writeShort(1); output.writeInt(0)
      output.writeShort(bytes.size); output.write(bytes)
    }
    return buffer.toByteArray()
  }
  val query = FreedRecoveryDnsPilotWire.query(host, 1, 0x1234)
  val a = answer(query, 1, "198.51.100.42")
  check(FreedRecoveryDnsPilotWire.accept(a, query) && FreedRecoveryDnsPilotWire.sentinel(a, query, 1))
  check(!FreedRecoveryDnsPilotWire.sentinel(answer(query, 1, "198.51.100.43"), query, 1))
  check(!FreedRecoveryDnsPilotWire.sentinel(a.copyOf().also { it[it.size - 7] = 1 }, query, 1))
  val query6 = FreedRecoveryDnsPilotWire.query(host, 28, 0x1235)
  check(FreedRecoveryDnsPilotWire.sentinel(answer(query6, 28, "2001:db8::42"), query6, 28))
  check(!FreedRecoveryDnsPilotWire.sentinel(a, query6, 28))
  val deniedQuery = FreedRecoveryDnsPilotWire.query(FreedRecoveryDnsPilotWire.host(nonce, true), 1, 0x1236)
  val refused = deniedQuery.copyOf().also { it[2] = 0x81.toByte(); it[3] = 0x85.toByte() }
  check(FreedRecoveryDnsPilotWire.refused(refused, deniedQuery))
  check(!FreedRecoveryDnsPilotWire.refused(refused, query))
  check(!FreedRecoveryDnsPilotWire.accept(refused.copyOf().also { it[0] = 0 }, deniedQuery))
  check(!FreedRecoveryDnsPilotWire.accept(refused.copyOf().also { it[3] = 0x82.toByte() }, deniedQuery))
  check(!FreedRecoveryDnsPilotWire.accept(refused.copyOf().also { it[2] = 0x83.toByte() }, deniedQuery))
  check(!FreedRecoveryDnsPilotWire.accept(ByteArray(4097), query))
  // Exercise the production transaction order at every failure boundary. The old
  // client may only be released by the caller after a successful acknowledgement.
  for (failureAt in listOf<String?>(null, "publish", "swap", "observe", "acknowledge")) {
    val events = mutableListOf<String>()
    var pointer = "old"; var runtime = "old"; var oldClosed = false
    val result = runCatching {
      FreedRecoveryDnsPilotTransaction.commit(
        publish = { events.add("publish"); pointer = "new"; check(failureAt != "publish") },
        swap = { events.add("swap"); check(!oldClosed); runtime = "new"; check(failureAt != "swap") },
        observe = { events.add("observe"); check(!oldClosed); failureAt != "observe" && pointer == runtime },
        acknowledge = { events.add("acknowledge"); check(!oldClosed); check(failureAt != "acknowledge") },
        rollback = { events.add("rollback"); pointer = "old"; runtime = "old"; true })
      oldClosed = true
    }
    if (failureAt == null) check(result.isSuccess && oldClosed && events == listOf("publish", "swap", "observe", "acknowledge"))
    else check(result.isFailure && !oldClosed && pointer == "old" && runtime == "old" && events.last() == "rollback")
  }
  val unknown = runCatching { FreedRecoveryDnsPilotTransaction.commit({ error("write") }, {}, { true }, {}, { false }) }
  check(unknown.exceptionOrNull()?.message == "recovery-dns-rollback-outcome-unknown")
  println("Recovery DNS pilot validation, same-owner restart renewal, cross-owner/epoch refusal, legacy exact-scope migration, exact-operation codec, system-probe wire and rollback cases passed")
}
