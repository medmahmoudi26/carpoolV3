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

// checking auth
const { checkAuth } = require('../middleware/check-auth');

// models
var user      = require('../models/user.js')
var reserver  = require('../models/reserver.js')
var trajet    = require('../models/trajet.js')

// express router
var router = express.Router()

router.get("/", checkAuth, function (req,res) {
  res.redirect("/user/profile");
});

//login
router.get('/login', function(req,res){
  if(!req.isAuthenticated()){
    res.render('login');
  } else {
    res.redirect('profile');
  }
});

//register
router.get('/register', function(req,res){
  if (req.isAutheticated()){
    res.redirect('profile');
  } else {
    res.render('register');
  }
});

//show my profile
router.get('/profile', checkAuth, function (req,res) {
  reserver.find({proposerid: req.user._id}, function (error,reservation) {
    if (error) res.render('error', {error: error});
    else if (reservation) res.render('profile', {user:req.user, reservations:reservation});
  });
});

/*
// if user trying to access something without logging in
router.get('/notlogged', function(req,res){
  res.render('notlogged')
});
*/

//logoff
router.get('/logoff', function(req,res){
  req.session.destroy();
  req.logout();
  res.redirect('/')
});

//mes reservations(trajets that I proposed)
router.get('/mestrajets', checkAuth, function (req,res) {
  trajet.find({userid: req.user._id}, function (error, proposition) {
    if (error) res.render('error', {error: error});
    else if (proposition) res.render('mestrajets', {propo: proposition, user:req.user});
  });
});

//mes trajets(trajets that I )
router.get('/mesreservations', checkAuth, function (req,res) {
  reserver.find({reserverid: req.user._id}, function (error,reserv) {
    if (error) res.render('error', {error:error});
    else if (reserv) res.render('mesreservations', {reserv:reserv, user: req.user});
  });
});

/*
//login
router.post('/login', function(req,res){
  if (req.user) res.redirect("profile")
  if (req.body.submit){
    user.findOne({
      email: req.body.email
    }, function(error,user){
      if (error) res.render('error', {error:error});
      if (user){ if (bcrypt.compareSync(req.body.pass, user.pass)) {
        req.user = user;
        var token = jwt.sign({
          email: user.email,
          userId: user._id
          },
          "secret",
          {
            expiresIn: "24h"
          }
        );
        if (req.session.redire){
          res.redirect(req.session.redire);
        }else {
          res.redirect('profile');
        }
      }else {
        res.render('notlogged',{ps:"ces coordonnés sont fausses, réessayez"});
      }}else {
        res.render("notlogged",{ps:"cet email n'existe pas"})
      }
    });
  }
});
*/

//register
router.post('/register', function(req,res){
  user.findOne({email: req.body.email}, function (err, exist) {
    if (err) console.log(err);
    else if (exist) {
      res.render("register", {error: 'cet email existe déja'})
    }else {
      if (req.body.password == req.body.confirm){
        var hashedpass = bcrypt.hashSync(req.body.password, 10);
        user.create({
          nom         : req.body.nom,
          prenom      : req.body.prenom,
          email       : req.body.email,
          password    : hashedpass,
          year        : req.body.year,
          number      : req.body.number,
          facebook    : req.body.facebook,
          bestdepart  : req.body.bestdepart,
          bestdest    : req.body.bestdest
        }, function(error, user){
          if (error){ res.render('register', {error:error});}
          else {
            // send registeration email
            var mailoptions = {
              to: user.email,
              from: "easytraveltechera@gmail.com",
              subject: "Compte crée !",
              text: "email: "+req.body.email+"\nmot de passe: "+req.body.password
            }
            transporter.sendMail(mailoptions, function (error, success) {
              if (error) console.log("Error => "+error);
              else if (success){
                console.log("Email Sent "+email.info );
              }
            });
            // redirect user to profile
            req.flash('success_msg', 'Succes, Vous pouvez vous connecter maintenant');
            res.redirect('/user/login');
          }
        });
      }else {
        res.render('register', {error:"Confirmez votre mot de passe correctement"});
      }
    }
  });
});

//update profile
router.post('/update', function (req,res) {
  if (!req.session.aller1) res.redirect("notlogged");
  if (req.body.submit){
    var hashedpass = bcrypt.hashSync(req.body.password, 10);
    user.findOneAndUpdate({_id: req.user._id},{$set:{
      nom        : req.body.nom,
      prenom     : req.body.prenom,
      year       : req.body.year,
      number     : req.body.number,
      pass       : hashedpass,
      facebook   : req.body.facebook,
      bestdepart : req.body.bestdepart,
      bestdest   : req.body.bestdest
    }},{ new: true }, function (err, result) {
      console.log(result);
      if (err) res.render('error', {error:err});
      if (result) {
        req.user = result;
        console.log("updating profile :"+req.user);
        reserver.find({proposerid: req.user._id}, function (error,reservation) {
          if (error) res.render('error', {error: error});
          console.log(reservation);
          if (reservation) res.render('profile', {user:req.user, reservations:reservation});
        });
      }
    });
  }
});

// Email and functions

// Transporter
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'easytraveltechera@gmail.com',
    pass: 'password'
  }
});

//####### Functions

// remove redirection
function rmredire(req,res){
  if (req.session.redire){
    delete req.session.redire;
  }
}

// Login two
router.post('/login', function (req,res, next) {
  passport.authenticate('local', {
    successRedirect: '/user/profile',
    failureRedirect: '/user/login',
    failureFlash: true
  })(req, res, next);
});

// ###### Exportation
module.exports = router
