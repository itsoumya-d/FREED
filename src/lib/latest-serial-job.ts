/** Serialize native writes, and skip stale work between independently acknowledged steps. */
export function createLatestSerialJob<Input, Result>(run:(input:Input,isCurrent:()=>boolean)=>Promise<Result|null>) {
  let generation=0;let chain:Promise<unknown>=Promise.resolve();
  let latest:{ id:number; result:Promise<Result|null> }|null=null;
  return {
    submit(input:Input){const id=++generation;const current=()=>id===generation;
      const result=chain.then(()=>current()?run(input,current):null);
      latest={id,result};chain=result.catch(()=>undefined);return{result,isCurrent:current};
    },
    invalidate(){generation++;},
    // Cleanup can always drain, including after a failed write.
    whenIdle(){return chain.then(()=>undefined);},
    // A superseded save needs the replacement's outcome, not just a drained queue.
    async latestResult():Promise<Result|null>{
      while(latest){
        const observed=latest;
        try{
          const result=await observed.result;
          if(latest!==observed)continue;
          return observed.id===generation?result:null;
        }catch(error){
          if(latest!==observed)continue;
          if(observed.id!==generation)return null;
          throw error;
        }
      }
      return null;
    },
  };
}
