const express = require("express");

const { findAttemptById, updateAttempt } = require("../models/attempt.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Autovalutazione di riserva di una flashcard
router.post("/:id/self-grade", protect, async (req, res) => {});

module.exports = router;
