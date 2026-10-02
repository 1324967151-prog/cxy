export function createActionGate() {
  let generation = 0;
  return {
    cancel() { generation++; },
    async run(prepare, canApply, apply) {
      const token = ++generation;
      await prepare();
      if (token !== generation || !canApply()) return false;
      apply(); return true;
    },
  };
}
