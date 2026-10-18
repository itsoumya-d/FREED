package app.freed.protection

import android.os.SystemClock
import java.net.URL
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.UUID
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.Callable
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.net.ssl.HttpsURLConnection
import kotlin.math.abs

/** Public HTTPS time only: no user, app-selection, account, token, browser or device data. */
internal object FreedEarnedTimeClock {
  const val ENDPOINT = "https://freed-7d5ee.firebaseapp.com/privacy"
  const val REQUEST_TIMEOUT_MS = 10_000L
  private const val MAX_ROUND_TRIP_MS = 5_000L
  private const val MAX_WALL_DRIFT_MS = 120_000L
  private val executor = ThreadPoolExecutor(1, 1, 0L, TimeUnit.MILLISECONDS, ArrayBlockingQueue(1),
    { runnable -> Thread(runnable, "freed-earned-time-clock").apply { isDaemon = true } }, ThreadPoolExecutor.AbortPolicy())

  data class Request(val url: String, val method: String, val headers: Map<String, String>)
  data class Response(val url: String, val status: Int, val date: String?, val age: String?)
  data class Proof(val serverTimeMs: Long, val receivedWallMs: Long, val receivedElapsedMs: Long)

  /** A response is useful only for the exact fixed-host HEAD, within native continuity/freshness bounds. */
  fun evaluate(requestUrl: String, response: Response, startedWall: Long, startedElapsed: Long, receivedWall: Long, receivedElapsed: Long): Proof? {
    val expected = runCatching { URL(requestUrl) }.getOrNull() ?: return null
    if (expected.protocol != "https" || expected.host != "freed-7d5ee.firebaseapp.com" || expected.port !in listOf(-1, 443) ||
      expected.path != "/privacy" || expected.userInfo != null || expected.ref != null ||
      expected.query?.matches(Regex("^freed-clock=[0-9a-f-]{36}$")) != true || response.url != requestUrl || response.status != 200) return null
    val roundTrip = receivedElapsed - startedElapsed
    if (startedElapsed < 0 || startedWall <= 0 || roundTrip !in 0..MAX_ROUND_TRIP_MS || receivedWall < startedWall ||
      abs((receivedWall - startedWall) - roundTrip) > 5_000L) return null
    val age = if (response.age == null) 0L else response.age.trim().toLongOrNull() ?: return null
    if (age !in 0..5) return null
    val parser = SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US).apply { isLenient = false; timeZone = TimeZone.getTimeZone("GMT") }
    val rawDate = response.date ?: return null
    val position = ParsePosition(0)
    val parsed = parser.parse(rawDate, position)?.takeIf { position.index == rawDate.length }?.time ?: return null
    // Date is an authenticated lower bound. Neither RTT symmetry nor Age can
    // prove a later instant; extrapolating can manufacture a midnight rollover.
    val serverTime = parsed
    if (serverTime <= 0 || abs(receivedWall - serverTime) > MAX_WALL_DRIFT_MS) return null
    return Proof(serverTime, receivedWall, receivedElapsed)
  }

  private fun head(request: Request, connection: AtomicReference<HttpsURLConnection?>): Response? {
    val client = URL(request.url).openConnection() as? HttpsURLConnection ?: return null
    connection.set(client)
    return try {
      client.requestMethod = request.method
      client.instanceFollowRedirects = false
      client.useCaches = false
      client.connectTimeout = 5_000; client.readTimeout = 5_000
      request.headers.forEach { (name, value) -> client.setRequestProperty(name, value) }
      Response(client.url.toString(), client.responseCode, client.getHeaderField("Date"), client.getHeaderField("Age"))
    } finally { client.disconnect(); connection.set(null) }
  }

  /** Runs outside the protection lock. The transport seam carries no owner, claim, target, or device data. */
  fun fetch(transport: ((Request) -> Response?)? = null): Proof? {
    val request = Request("$ENDPOINT?freed-clock=${UUID.randomUUID()}", "HEAD",
      mapOf("Cache-Control" to "no-cache", "Pragma" to "no-cache", "Cookie" to ""))
    val startedWall = System.currentTimeMillis(); val startedElapsed = SystemClock.elapsedRealtime()
    val connection = AtomicReference<HttpsURLConnection?>()
    val future = runCatching { executor.submit(Callable {
      val response = (if (transport == null) head(request, connection) else transport(request)) ?: return@Callable null
      evaluate(request.url, response, startedWall, startedElapsed, System.currentTimeMillis(), SystemClock.elapsedRealtime())
    }) }.getOrNull() ?: return null
    return try { future.get(REQUEST_TIMEOUT_MS, TimeUnit.MILLISECONDS) }
    catch (_: Exception) { future.cancel(true); connection.getAndSet(null)?.disconnect(); null }
  }
}
