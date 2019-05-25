// packages
const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcrypt');
const session    = require('express-session');
const ejs        = require('ejs');
const fs         = require('fs');
const DateOnly   = require('date-only');
const nodemailer = require('nodemailer');
const jwt        = require('jsonwebtoken');
const passport   = require('passport');

// models
var User     = require("../models/user")
var trajet   = require('../models/trajet');
var reserver = require('../models/reserver');
var cardispo = require('../models/cardispo');
var cars     = require('../models/cars');

// express router
var router = express.Router()

// checking auth
const { checkAuth } = require('../middleware/check-auth');
const { checkAdmin } = require('../middleware/check-admin');

// ===== Routes =====
// admin page
router.get("/", checkAdmin, function (req, res) {
  res.redirect("/admin/dashboard");
});

// dashboard
router.get("/dashboard", checkAdmin, function (req, res) {
  res.render("admin", {admin: req.session});
});

// login
router.get("/login", function (req, res) {
  if (req.isAuthenticated()) {
    if (req.user.isAdmin) res.redirect("/admin/dashboard");
  }
  res.render("admin_login");
});

router.post("/login", function (req, res, next) {
  passport.authenticate('admin', {
    successRedirect: '/admin/dashboard',
    failureRedirect: '/admin/login',
    failureFlash: true
  })(req, res, next);
})

// add a car
router.get("/addcar", checkAdmin, function (req, res) {
  res.render("addcar");
});

// exporting
module.exports = router;
