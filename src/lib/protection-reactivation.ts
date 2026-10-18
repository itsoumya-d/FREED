export type ProtectionActivationProof={protectionConfigurationActivationAccepted?:boolean;protectionConfigurationResetDisabled?:boolean};
/** Called only from a fresh user action. An acknowledgment allows sync; it does not prove enforcement. */
export async function resumeProtectionAfterReset<Status>(activate:()=>Promise<ProtectionActivationProof>, sync:()=>Promise<unknown>, refresh:()=>Promise<Status>):Promise<Status> {
  const proof=await activate();
  if(proof.protectionConfigurationActivationAccepted!==true||proof.protectionConfigurationResetDisabled===true)throw new Error('protection-activation-not-accepted');
  await sync();return refresh();
}
