export const logEffect = () => {
  const errorStack = new Error().stack;
  if (errorStack) {
    const logAt = errorStack.split(' '); //.filter((s) => s === '');
    let atCounts = 0;
    let effectName;
    let contextService;
    let caller;
    let methodCaller;
    logAt.forEach((log, i) => {
      if (log === 'at') {
        atCounts++;
        if (atCounts === 2) {
          const effectService = logAt[i + 1].split('.');
          effectName = effectService[1];
          contextService = effectService[0];
        }
        if (atCounts === 3) {
          const callerMethod = logAt[i + 1].split('.');
          caller = callerMethod[1];
          methodCaller = callerMethod[0];
        }
      }
    });
    // const effectName = logAt[2].split(' ')[1].split('.')[1];
    // const contextName = logAt[2].split(' ')[1].split('.')[0];
    console.group(`${effectName} in ${contextService}`);
    console.log(`Called by ${caller} in ${methodCaller}`);
  }
};
