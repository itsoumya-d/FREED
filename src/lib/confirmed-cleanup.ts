/** Do not erase recoverable records until the owning native layer confirms cleanup. */
export async function afterConfirmedCleanup<Result>(clear:()=>Promise<boolean>, erase:()=>Promise<Result>):Promise<Result> {
  if (await clear() !== true) throw new Error('Native protection cleanup could not be confirmed. Your recovery records were kept. Try again.');
  return erase();
}
