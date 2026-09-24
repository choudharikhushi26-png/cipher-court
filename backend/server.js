import express from "express";
import cors from "cors";

import generateRoute from "./routes/generate.js";
import investigateRoute from "./routes/investigate.js";
import askSuspectRoute from "./routes/askSuspect.js";
import submitReasoningRoute from "./routes/submitReasoning.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/case", generateRoute);
app.use("/api/case", investigateRoute);
app.use("/api/case", askSuspectRoute);
app.use("/api/case", submitReasoningRoute);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Cipher Court backend listening on http://localhost:${PORT}`);
});
