const express = require("express");

const { getAllTopics } = require("../models/topic.model");
const protect = require("../middleware/auth");

const router = express.Router();

// Elenco completo degli argomenti
router.get("/", protect, async (req, res) => {});

module.exports = router;
