// Keep reports until the server answers. A retry uses the same ID, even if the first response was lost.
// The queue is shared by replacement city sessions; each entry retains the event in which the player died.
export async function flushBossDeaths(queue, api, name) {
  const batch = queue.slice(0, 10);
  for (const report of batch) {
    await api.death({ ...report, name });
    const index = queue.indexOf(report);
    if (index >= 0) queue.splice(index, 1);
  }
}
