package app.freed.protection

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build

internal data class FreedNetworkDnsState(val mode: String, val serverName: String? = null) {
  val active: Boolean? get() = when (mode) {
    "off" -> false
    "hostname", "opportunistic" -> true
    else -> null
  }

  companion object {
    fun read(context: Context): FreedNetworkDnsState {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return FreedNetworkDnsState("off")
      return runCatching {
        val manager = context.getSystemService(ConnectivityManager::class.java)
          ?: return@runCatching FreedNetworkDnsState("unknown")
        // Our VPN's LinkProperties can mask the underlying network's privacy
        // setting. Inspect the active non-VPN network using public APIs.
        fun isUnderlying(network: android.net.Network): Boolean {
          val caps = manager.getNetworkCapabilities(network) ?: return false
          return !caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN) &&
            caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
        }
        val active = manager.activeNetwork
        val networks = active?.takeIf { isUnderlying(it) }?.let { listOf(it) }
          ?: manager.allNetworks.filter { isUnderlying(it) }
        if (networks.isEmpty()) return@runCatching FreedNetworkDnsState("unknown")
        // If a VPN obscures the default underlying network, never select an
        // arbitrary cleartext network while another candidate requires privacy.
        val states = networks.map { network ->
          val properties = manager.getLinkProperties(network)
          if (properties == null) FreedNetworkDnsState("unknown") else {
            val server = properties.privateDnsServerName?.trim()?.takeIf { it.isNotBlank() }
            when {
              server != null -> FreedNetworkDnsState("hostname", server)
              properties.isPrivateDnsActive -> FreedNetworkDnsState("opportunistic")
              else -> FreedNetworkDnsState("off")
            }
          }
        }
        states.firstOrNull { it.mode == "hostname" }
          ?: states.firstOrNull { it.mode == "opportunistic" }
          ?: states.firstOrNull { it.mode == "unknown" }
          ?: FreedNetworkDnsState("off")
      }.getOrElse { FreedNetworkDnsState("unknown") }
    }
  }
}
