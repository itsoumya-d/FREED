package app.freed.protection

import java.security.Provider
import java.security.Security
import java.security.spec.KeySpec
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory
import javax.crypto.SecretKeyFactorySpi
import javax.crypto.spec.PBEKeySpec

/** Fixture-only JCA boundary: the production crypto constructs the actual 600k spec. */
internal object Task91KdfProbe {
    lateinit var actualProvider: Provider
    @Volatile var calls = 0
    @Volatile var completed = 0
    @Volatile var gate = false
    val entered = Array(2) { CountDownLatch(1) }
    val proceed = Array(2) { CountDownLatch(1) }
    fun install(gated: Boolean) {
        actualProvider = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").provider
        gate = gated
        val observer = object : Provider("Task91ObservedPBKDF2", "1.0", "Fixture delegates unchanged PBKDF2") {}
        observer.put("SecretKeyFactory.PBKDF2WithHmacSHA256", Task91ObservedPBKDF2::class.java.name)
        check(Security.insertProviderAt(observer, 1) == 1)
        println("Task91 actual PBKDF2 provider=${actualProvider.name}; required iterations=600000 keyBits=256")
    }
}

class Task91ObservedPBKDF2 : SecretKeyFactorySpi() {
    private val delegate get() = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256", Task91KdfProbe.actualProvider)
    override fun engineGenerateSecret(spec: KeySpec): SecretKey {
        check(spec is PBEKeySpec && spec.iterationCount == 600_000 && spec.keyLength == 256 && spec.salt.size == 16)
        val index = Task91KdfProbe.calls++
        Task91KdfProbe.entered.getOrNull(index)?.countDown() // Actual production derive() has entered its provider, with its real spec.
        if (Task91KdfProbe.gate) check(Task91KdfProbe.proceed[index].await(10, TimeUnit.SECONDS))
        return delegate.generateSecret(spec).also { Task91KdfProbe.completed++ }
    }
    override fun engineGetKeySpec(key: SecretKey, type: Class<*>): KeySpec = delegate.getKeySpec(key, type)
    override fun engineTranslateKey(key: SecretKey): SecretKey = delegate.translateKey(key)
}

internal fun task91RecordEncryptedHealth(healthy: Boolean) {
    // Invoke the unchanged production callback in the generated service boundary.
    val callback = FreedVpnService::class.java.getDeclaredMethod("recordEncryptedDnsHealth", Boolean::class.javaPrimitiveType, Long::class.javaPrimitiveType)
    callback.isAccessible = true
    callback.invoke(FreedVpnService, healthy, 0L)
}
