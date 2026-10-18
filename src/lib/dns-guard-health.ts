type DnsGuardSignal = {
  runtimeReady?: boolean;
  adultFilterActive?: boolean;
  dnsGuardCoverageReady?: boolean;
  dnsGuardCaptivePaused?: boolean;
  dnsGuardCoverageIssueCode?: string;
  dnsGuardIpv6UnsupportedPackets?: number;
  dnsGuardIpv6MalformedPackets?: number;
};

/** A running tunnel does not establish that its DNS filter is protecting traffic. */
export function isDnsGuardFiltering(signal: DnsGuardSignal): boolean {
  return signal.runtimeReady === true && signal.adultFilterActive === true &&
    signal.dnsGuardCoverageReady === true && signal.dnsGuardCaptivePaused !== true &&
    !signal.dnsGuardCoverageIssueCode && (signal.dnsGuardIpv6UnsupportedPackets ?? 0) === 0;
}

export function dnsGuardCoverageMessage(issue: string | undefined): string {
  switch (issue) {
    case 'android-dns-guard-captive-paused':
      return 'Web filtering is paused. Sign in to this Wi-Fi network; FREED will check it again afterward.';
    case 'android-private-dns-strict-unsupported':
    case 'android-private-dns-encrypted-unsupported':
      return 'Android Private DNS is using encrypted DNS that this filter cannot inspect. Review Private DNS settings to use web filtering. App protection and recovery tools remain available.';
    case 'android-private-dns-state-unknown':
      return 'FREED could not verify this network’s DNS settings. Web filtering is inactive. Refresh the check or try another network.';
    default:
      return 'Web filtering is inactive. Return to protection setup to check the connection.';
  }
}
