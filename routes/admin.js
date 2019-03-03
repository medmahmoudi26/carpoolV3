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

// checking auth
const { checkAuth } = require('../middleware/check-auth');

// ===== Routes =====

// admin page
router.get("/addcar", function (req, res, next) {
  res.render("addcar");
});

function requrieAdmin(req, res) {
  return function (req, res, next) {
    if (req.user.admin) {
      next()
    } else {
      req.flash("error_msg", "Admin required");
      res.redirect("/user/profile");
    }
  }
}

// exporting
module.exports = router;
