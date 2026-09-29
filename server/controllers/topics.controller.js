const express = require("express");

const { getAllTopics } = require("../models/topic.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Elenco completo degli argomenti
router.get("/", protect, async (req, res) => {
  try {
    const topics = await getAllTopics();

    return res.json({
      ok: true,
      topics,
    });

  } catch (err) {
    console.error("GET TOPICS ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

module.exports = router;
