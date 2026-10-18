import Foundation

protocol FriendLockProtectedBytes {
    func beginAccess() throws
    func endAccess()
    func read(_ key: String) throws -> Data?
    func write(_ key: String, _ data: Data) throws
    func remove(_ key: String) throws
}
extension FriendLockProtectedBytes { func beginAccess() throws {} ; func endAccess() {} }

// Retained protected journal is the transaction decision; record is required native readback.
// No successful publication deletes the only old/new recoverable verifier generation.
final class FriendLockRecordStore {
    static let maximumRecordBytes = 65_536
    static let maximumJournalBytes = maximumRecordBytes * 3
    private static let processLock = NSRecursiveLock()
    private let bytes: any FriendLockProtectedBytes
    private enum Phase: String, Codable { case prepared, committed }
    private struct Journal: Codable { let schema: Int; let phase: Phase; let previous: Data?; let candidate: Data }
    init(bytes: any FriendLockProtectedBytes) { self.bytes = bytes }
    private func exclusive<T>(_ operation: () throws -> T) throws -> T {
        Self.processLock.lock(); defer { Self.processLock.unlock() }
        try bytes.beginAccess(); defer { bytes.endAccess() }
        do { return try operation() } catch let failure as FriendLockFailure { throw failure } catch { throw FriendLockFailure.storageUnavailable }
    }
    private func decode(_ data: Data) throws -> FriendLockRecord {
        guard data.count <= Self.maximumRecordBytes,
              let record = try? JSONDecoder().decode(FriendLockRecord.self, from: data), record.isValid else { throw FriendLockFailure.corrupt }
        return record
    }
    private func encode(_ record: FriendLockRecord) throws -> Data {
        guard record.isValid else { throw FriendLockFailure.corrupt }
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let data = try encoder.encode(record)
        guard data.count <= Self.maximumRecordBytes else { throw FriendLockFailure.corrupt }; return data
    }
    private func encodeJournal(_ journal: Journal) throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.sortedKeys]
        let result = try encoder.encode(journal)
        guard result.count <= Self.maximumJournalBytes else { throw FriendLockFailure.corrupt }; return result
    }
    private func decodeJournal(_ data: Data) throws -> Journal {
        guard data.count <= Self.maximumJournalBytes,
              let journal = try? JSONDecoder().decode(Journal.self, from: data), journal.schema == 2 else { throw FriendLockFailure.corrupt }
        _ = try decode(journal.candidate); if let previous = journal.previous { _ = try decode(previous) }
        return journal
    }
    private func rollback(_ journal: Journal) throws -> Data {
        guard journal.phase == .prepared, let previous = journal.previous else { throw FriendLockFailure.missingEnrolled }
        try bytes.write("record", previous)
        guard try bytes.read("record") == previous else { throw FriendLockFailure.storageUnavailable }
        // Verified rollback retains its authoritative prior record in a committed envelope.
        let rolledBack = try encodeJournal(Journal(schema: 2, phase: .committed, previous: nil, candidate: previous))
        try bytes.write("journal", rolledBack)
        guard try bytes.read("journal") == rolledBack else { throw FriendLockFailure.storageUnavailable }
        return previous
    }
    private func raw() throws -> Data? {
        let witness = try bytes.read("witness"), record = try bytes.read("record"), data = try bytes.read("journal")
        if witness == nil { guard record == nil, data == nil else { throw FriendLockFailure.corrupt }; return nil }
        guard witness == Data([1]) else { throw FriendLockFailure.corrupt }
        guard let data else { throw FriendLockFailure.missingEnrolled }
        let journal = try decodeJournal(data)
        if journal.phase == .prepared { return try rollback(journal) }
        guard let record else { throw FriendLockFailure.missingEnrolled }
        guard record == journal.candidate else { throw FriendLockFailure.corrupt }
        return journal.candidate
    }
    func load() throws -> FriendLockRecord? { try exclusive { try raw().map(decode) } }
    func publish(_ candidate: FriendLockRecord, expected: FriendLockRecord?) throws {
        try exclusive {
            let old = try raw(), expectedData = try expected.map(encode), new = try encode(candidate)
            guard old == expectedData else { throw FriendLockFailure.storageConflict }
            if old == nil { try bytes.write("witness", Data([1])); guard try bytes.read("witness") == Data([1]) else { throw FriendLockFailure.storageUnavailable } }
            let prepared = Journal(schema: 2, phase: .prepared, previous: old, candidate: new)
            let pending = try encodeJournal(prepared)
            // Atomic replacement retains the current generation; older completed generations are bounded away.
            do {
                try bytes.write("journal", pending)
                guard try bytes.read("journal") == pending else { throw FriendLockFailure.storageUnavailable }
                try bytes.write("record", new)
                guard try bytes.read("record") == new else { throw FriendLockFailure.storageUnavailable }
            } catch {
                if old != nil, (try? bytes.read("journal")) == pending { _ = try? rollback(prepared) }
                throw FriendLockFailure.storageUnavailable
            }
            let committed = try encodeJournal(Journal(schema: 2, phase: .committed, previous: old, candidate: new))
            var commitWriteReturned = false
            do {
                try bytes.write("journal", committed); commitWriteReturned = true
                guard try bytes.read("journal") == committed else { throw FriendLockFailure.storageUnavailable }
                // Completion is here. No optional cleanup/read can turn this verified commit into failure.
            } catch {
                let observed: Data?
                do { observed = try bytes.read("journal") } catch { throw FriendLockFailure.commitOutcomeUnknown }
                if observed == committed {
                    guard commitWriteReturned else { throw FriendLockFailure.commitOutcomeUnknown }
                    return // The retry read just verified a successful durable write's committed phase.
                }
                if observed == pending {
                    if old != nil { _ = try? rollback(prepared) }
                    throw FriendLockFailure.storageUnavailable
                }
                throw FriendLockFailure.corrupt
            }
        }
    }
}
