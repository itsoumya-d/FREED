package app.freed.protection

import java.io.IOException
import java.net.InetAddress
import java.net.Socket
import javax.net.SocketFactory

/** Fail before connect if Android refuses to exclude the socket from the VPN. */
internal class FreedProtectedSocketFactory(private val protectSocket: (Socket) -> Boolean) : SocketFactory() {
  override fun createSocket(): Socket {
    val socket = Socket()
    try {
      if (!protectSocket(socket)) throw IOException("VPN socket protection failed")
      return socket
    } catch (error: Exception) {
      socket.close()
      throw error
    }
  }

  // OkHttp uses the unconnected form only. Refuse implicit hostname resolution
  // in every other overload, rather than accidentally recursing into the VPN.
  override fun createSocket(host: String, port: Int): Socket = unsupported()
  override fun createSocket(host: String, port: Int, local: InetAddress, localPort: Int): Socket = unsupported()
  override fun createSocket(address: InetAddress, port: Int): Socket = unsupported()
  override fun createSocket(address: InetAddress, port: Int, local: InetAddress, localPort: Int): Socket = unsupported()
  private fun unsupported(): Nothing = throw IOException("Encrypted DNS requires an unconnected protected socket")
}
