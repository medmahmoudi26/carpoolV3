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
const crypto     = require('crypto');

// checking auth
const { checkAuth } = require('../middleware/check-auth');

// models
var User      = require('../models/user');
var reserver  = require('../models/reserver');
var trajet    = require('../models/trajet');

// express router
var router = express.Router()

router.get('/', checkAuth, function (req,res) {
  res.redirect('/user/profile');
});

//show my profile
router.get('/profile', checkAuth, function (req,res) {
  reserver.find({proposerid: req.user._id}, function (error,reservation) {
    if (error) res.render('error', {error: error});
    else if (reservation) res.render('profile', {user:req.user, reservations:reservation});
  });
});

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

//login
router.get('/login', function(req,res){
  if(!req.isAuthenticated()){
    res.render('login');
  } else {
    res.redirect('profile');
  }
});

router.post('/login', function (req,res, next) {
  passport.authenticate('local', {
    successRedirect: '/user/profile',
    failureRedirect: '/user/login',
    failureFlash: true
  })(req, res, next);
});

//register
router.get('/register', function(req,res){
  if (req.isAuthenticated()){
    res.redirect('profile');
  } else {
    res.render('register');
  }
});

router.post('/register', function(req,res){
  User.findOne({email: req.body.email}, function (err, exist) {
    if (err) console.log(err);
    else if (exist) {
      res.render("register", {error: 'cet email existe déja'})
    }else {
      if (req.body.password == req.body.confirm){
        var hashedpass = bcrypt.hashSync(req.body.password, 10);
        User.create({
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
router.post('/update', function (req, res) {
  if (!req.isAuthenticated()) {
    req.flash("error_msg", "vous n'etes pas connecter");
    res.redirect("/");
  }
  if (req.body.submit) {
    var hashedpass = bcrypt.hashSync(req.body.password, 10)
    User.findOneAndUpdate({_id: req.user._id},{$set:{
      nom        : req.body.nom,
      prenom     : req.body.prenom,
      year       : req.body.year,
      number     : req.body.number,
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

// password forget (user enters email)
router.get('/forgot', function (req,res) {
  if (req.user) {
    req.flash("error_msg", "vous etes déja connecter");
    res.redirect("/user/profile");
  }
  else res.render("forgot");
});

router.post("/forgot", function (req,res) {
  if (req.isAuthenticated()) {
    req.flash("error_msg", "vous etes déja connecté");
    res.redirect("/user/profile");
  } else {
    User.findOne({email: req.body.email}, function (err, user) {
      if (err) {
        req.flash("error_msg", "cet email n'appartient à aucun compte");
        res.redirect("/user/forgot");
      } else if (user) {
        crypto.randomBytes(20, function (err, buf) {
          var token = buf.toString('hex');
          user.update({
            $set:{
              resetPasswordToken: token,
              resetPasswordExpires: Date.now() + 360000 // 1 hour
            }
          }, function (error, saved) {
            if (error) {
              req.flash('error_msg', error);
              res.redirect("/user/forgot");
            } else if (saved) {
              var mailOptions = {
                to: user.email,
                from: 'easytraveltechera@gmail.com',
                subject: 'Password Reset',
                text: 'http://'+req.headers.host+'/user/reset/'+token+'\n\n'
              }
              transporter.sendMail(mailOptions, function (err) {
                if (err) console.log('Reset mail failed => '+err);
                console.log('Reset email sent');
                res.render('sent');
              });
            }
          });
        });
      } else {
        req.flash('error_msg', "email does not match any account");
        res.redirect("back");
      }
    });
  }
});

// password reset link
router.get('/reset/:token', function (req,res) {
  User.findOne({resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now() } }, function (error, user) {
    if (error) {
      req.flash("error_msg", "une erreur s'est survenue");
      res.redirect("/");
    } else if (!user) {
      req.flash("error_msg", "cet token n'existe pas ou est exipiré");
      res.redirect("/")
    } else {
      res.render("reset", {token: req.params.token});
    }
  });
});

router.post('/reset/:token', function (req,res) {
  if (req.isAuthenticated()) {
    req.flash("error_msg", "vous etes déja connecté");
    res.redirect("/user/profile");
  } else {
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: { $gt: Date.now() } }, function (error, user) {
      if (error) {
        req.flash("error_msg", "une erreur est survenue");
        res.redirect("back");
      } else if (!user) {
        req.flash("error_msg", "une erreur est survenue"); // if token expired or not existant
        res.redirect("back");
      } else {
        if (req.body.password === req.body.confirm) {
          var hashedpass = bcrypt.hashSync(req.body.password, 10);
          User.findOneAndUpdate({_id: user._id}, {$set:{
            password: hashedpass,
            resetPasswordToken: undefined,
            resetPasswordExpires: undefined
          }}, {new: true}, function (error, user) {
            if (error) {
              req.flash("error_msg", "une erreur s'est produite");
              res.redirect("/");
            }
            req.login(user, function (err) {
              var mailOptions = {
                to: user.email,
                from: 'easytraveltechera@gmail.com',
                subject: 'Votre mot de passe est changé',
                text: "le mot de passe de votre compte "+user.email+" est changé"
              }
              transporter.sendMail(mailOptions, function (error, sent) {
                if (error) console.log("Error sending reset confirmation mail => "+error);
                else if (sent) console.log("Confirmation reset mail sent");
              });
            });
            req.flash("success_msg", "success votre mot de passe est correctement changé");
            res.redirect("/user/profile");
          });
        } else {
          req.flash("error_msg", "confirmer votre mot de passe correctement");
          res.redirect("back");
        }
      }
    });
  }
});

// reset password
router.get("/reset", checkAuth, function (req, res) {
  res.render("reset");
});

router.post("/reset", checkAuth, function (req, res) {
  var oldHashed = bcrypt.hashSync(req.body.oldPassword, 10);
  var hashedpass = bcrypt.hashSync(req.body.password, 10);
  var confirmHashed = bcrypt.hashSync(req.body.password, 10);
  User.findOne({_id: req.user._id}, function (error, user) {
    if (error) {
      req.flash("error_msg", "une erreur s'est produite");
      res.redirect("back");
    } else if (bcrypt.compareSync(req.body.oldPassword, user.password) && req.body.password == req.body.confirm) {
      user.update({$set: {password: hashedpass}}, {new: true}, function (error, user) {
        req.login(user, function (err) {
          if (err) console.log(err);
        });
        req.flash("success_msg", "mot de passe modifié correctement");
        res.redirect("/user/profile");
      });
    } else {
      req.flash("error_msg", "verifiez vos coordonnés");
      res.redirect("back");
    }
  });
});
// Email and functions

// Transporter
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'easytraveltechera@gmail.com',
    pass: 'tnt23793213'
  }
});

//####### Functions

// remove redirection
function rmredire(req,res){
  if (req.session.redire){
    delete req.session.redire;
  }
}

// ###### Exportation
module.exports = router
