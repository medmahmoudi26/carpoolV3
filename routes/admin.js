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
var Trajet   = require('../models/trajet');
var reserver = require('../models/reserver');
var cardispo = require('../models/cardispo');
var Cars     = require('../models/cars');

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
  Cars.find({},function (error, cars) {
    if (error) {
      res.render("error",{error: error});
    } else {
      Trajet.find({}).exec(function (err, trajets) {
        if (err) res.render("error", "trajets error");
        else {
          trajets.reverse();
          res.render("admin", {cars: cars, trajets: trajets, admin: req.user});
        }
      })
    }
  })
});

// login
router.get("/login", function (req, res) {
  if (req.isAuthenticated()) {
    if (req.user.admin === true) res.redirect("/admin/dashboard");
    else res.redirect("/user/profile");
  }
  else {
    res.render("admin_login");
  }
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

router.post("/addcar", checkAdmin, function (req,res) {
    Cars.create({
      mat:            req.body.mat,
      model:          req.body.model,
      places:         req.body.places,
      etablissement:  req.body.etablissement,
      remarque:       req.body.remarque
  },function (error, car) {
    if (error) {
      req.flash("error_msg","une erreur s'est produite");
      res.redirect("/admin/addcar");
    }
    else if (car) {
      cardispo.create({
        brand_new : true,
        car       : car.mat,
        etab      : car.etablissement,
        places    : car.places
      }, function (error, dispo) {
        if (error) {
          req.flash("error_msg","erreur s'est produite");
          res.redirect("/admin/addcar")
        }
        else if(dispo) {
          req.flash("success_msg","Voiture crée");
          res.redirect("/admin/dashboard");
        }
      });
    }
  });
});

// car more details
router.get("/cardetail/:id", checkAdmin, function (req, res) {
  Cars.findById(req.params.id, function (car, error) {
    if (error) res.render("error", {error: error});
    else if (car) {
      res.render("cardetail", {car: car});
    } else {
      res.render("cardetail", {error_msg: "voiture no valable"});
    }
  });
});

router.post("/cardetail/:id", checkAdmin, function (req, res) {
  Cars.findOneAndUpdate ({_id: req.params.id}, {$set: {
    mat: req.body.mat,
    places: req.body.places,
    lastVersionDate: req.body.lastVersionDate,
    firstUsageDate: req.body.firstUsageDate,
    parcEntreeDate: req.body.parcEntreeDate,
    lastControleDate: req.body.lastControleDate,
    marque: req.body.marque,
    modele: req.body.modele,
    finition: req.body.finition,
    vin: req.body.vin,
    carrosserie: req.body.carrosserie,
    energie: req.body.energie,
    genre: req.body.genre,
    type: req.body.type,
    doors: req.body.doors,
    capacity: req.body.capacity,
    consoMixte: req.body.consoMixte,
    CO2: req.body.CO2,
    puissance: req.body.puissance,
    puissanceFasc: req.body.puissanceFasc,
    pneumatique: req.body.pneumatique,
    garnissage: req.body.garnissage,
    color: req.body.color,
    options: req.body.options,
    accessoires: req.body.accessoires,
    amenagement: req.body.amenagement,
    boite: req.body.boite,
    LocalisationCertImmat: req.body.LocalisationCertImmat,
    signalétique: req.body.signalétique,
    remarque: req.body.remarque,
    etablissement: req.body.etablissement
  }}, {new: true}, function (error, car) {
    if (error) res.render("error", {error: error});
    else if (car) {
      req.flash("success_msg", "voiture mise à jour");
      res.redirect("back");
    }
  })
});

// deconnect
router.get("/logoff", function (req, res) {
  req.session.destroy();
  req.logout();
  res.redirect('/')
})

// exporting
module.exports = router;
