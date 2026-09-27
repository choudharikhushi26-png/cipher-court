import "dotenv/config";
import express from "express";
import cors from "cors";

import generateRoute from "./routes/generate.js";
import investigateRoute from "./routes/investigate.js";
import askSuspectRoute from "./routes/askSuspect.js";
import submitReasoningRoute from "./routes/submitReasoning.js";

const app = express();

// Enable CORS for all origins (including Vercel deployments *.vercel.app and localhost)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests from all origins (Vercel, localhost, curl, etc.)
      callback(null, true);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  })
);
app.options("*", cors());
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
