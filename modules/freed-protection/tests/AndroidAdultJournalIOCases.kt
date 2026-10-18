package app.freed.protection

import android.content.Context
import android.util.PublicationHooks
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

private fun exclusionCase(stage: String, initializing: Boolean = false) {
  val context = Context()
  val writerJournal = FreedAdultExecutionJournal(FreedAdultJournalFile(context))
  // A second adapter for the same path also participates in the process I/O boundary.
  val readerJournal = FreedAdultExecutionJournal(FreedAdultJournalFile(context))
  if (!initializing) writerJournal.initialize()
  PublicationHooks.reset(stage)
  PublicationHooks.failFinish = stage == "failure"
  val writerResult = AtomicReference<Throwable?>()
  val readerResult = AtomicReference<FreedAdultJournalSnapshot?>()
  val readerFailure = AtomicReference<Throwable?>()
  val attempted = CountDownLatch(1)
  val writer = Thread({
    try { if (initializing) writerJournal.initialize() else writerJournal.save(FreedAdultJournalSnapshot(generation=2)) }
    catch (failure: Throwable) { writerResult.set(failure) }
  }, "journal-writer")
  val reader = Thread({
    attempted.countDown()
    try { readerResult.set(readerJournal.read()) } catch (failure: Throwable) { readerFailure.set(failure) }
  }, "journal-reader")
  writer.start()
  try {
    check(PublicationHooks.entered.await(2,TimeUnit.SECONDS)) { "Writer did not reach $stage" }
    reader.start(); check(attempted.await(2,TimeUnit.SECONDS))
    val deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2)
    while (reader.state != Thread.State.BLOCKED && PublicationHooks.readerEntries.get()==0 && reader.isAlive && System.nanoTime()<deadline) Thread.sleep(1)
    check(reader.state==Thread.State.BLOCKED && PublicationHooks.readerEntries.get()==0) {
      "Journal reader entered AtomicFile during $stage publication (state=${reader.state}, entries=${PublicationHooks.readerEntries.get()})"
    }
  } finally {
    PublicationHooks.release.countDown()
    writer.join(3_000); if (reader.state != Thread.State.NEW) reader.join(3_000)
  }
  check(!writer.isAlive && !reader.isAlive)
  check(readerFailure.get()==null) { "Reader failed after publication: ${readerFailure.get()}" }
  check((writerResult.get()!=null)==(stage=="failure"))
  val expected=if(stage=="failure" || initializing)1L else 2L
  check(readerResult.get()?.generation==expected && writerJournal.read().generation==expected)
  check(!PublicationHooks.readerOverlapped)
  println("PASS journal I/O exclusion at $stage${if(initializing) " initialization" else ""}; exact generation $expected")
}
fun main() {
  for(stage in listOf("start-write","bytes-write","finish-write","directory-sync","readback","failure")) exclusionCase(stage)
  exclusionCase("start-write",initializing=true)
}
