process.send({ type: "ready" });

process.on("message", (message) => {
  if (message.type === "cancel") return;
  if (message.type === "info") {
    process.send({ type: "infoResult", jobId: message.jobId, info: { totalFrames: 1 } });
    return;
  }
  if (message.template === "hang") {
    while (true) { /* supervisor must kill this process */ }
  }
  setTimeout(() => {
    process.send({ type: "renderResult", jobId: message.jobId, bytes: Buffer.from([1, 2, 3]) });
  }, 10);
});
