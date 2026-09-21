const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { findUserByEmail } = require("../models/user.model");
const protect = require("../middleware/auth");

const {
  JWT_SECRET,
  JWT_EXPIRES_IN,
} = require("../config/jwt");

const router = express.Router();

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        ok: false,
        error: "Email e password sono obbligatorie",
      });
    }

    const user = await findUserByEmail(email);

    if (!user) {
      return res.status(401).json({
        ok: false,
        error: "Credenziali non valide",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        ok: false,
        error: "Credenziali non valide",
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return res.json({
      ok: true,
      token,
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    return res.status(500).json({
      ok: false,
      error: "Errore interno del server",
    });
  }
});

// Get current user
router.get("/me", protect, (req, res) => {
  return res.json({
    ok: true,
    user: req.user,
  });
});

module.exports = router;
