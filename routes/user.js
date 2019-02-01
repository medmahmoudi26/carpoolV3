const express  = require('express');
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const session  = require('express-session');
const ejs      = require('ejs');
const fs       = require('fs');
const DateOnly = require('date-only');
const nodemailer = require('nodemailer');

// models
var user      = require('../models/user.js')
var reserver  = require('../models/reserver.js')
var trajet    = require('../models/trajet.js')

// express router
var router = express.Router()

router.get("/", function (req,res) {
  if (!req.session.user) {
    res.redirect("notlogged");
  } else {
    res.redirect("profile");
  }
})

//login
router.get('/login', function(req,res){
  rmredire(req,res);
  if(!req.session.user){
  res.render('login');
}else {
  res.redirect('/profile');
}
});

//register
router.get('/register', function(req,res){
  rmredire(req,res);
  if (req.session.user){
    res.redirect('/user');
  }
  else {
    res.render('register');
  }
});

//show my profile
router.get('/profile', function (req,res) {
  rmredire(req,res);
  console.log(req.session.user);
  if (req.session.user){
    reserver.find({proposerid: req.session.user._id}, function (error,reservation) {
      if (error) res.render('error', {error: error});
      console.log(reservation);
      if (reservation) res.render('profile', {user:req.session.user, reservations:reservation});
    });
  }else {
    req.session.redire = '/profile';
    res.redirect('notlogged');
  }
});
router.get('/notlogged', function(req,res){
  res.render('notlogged')
});

//logoff
router.get('/logoff', function(req,res){
  req.session.destroy();
  res.redirect('/')
});

//mes reservations(trajets that I proposed)
router.get('/mestrajets', function (req,res) {
  rmredire(req,res);
  if (req.session.user) {
    trajet.find({userid: req.session.user._id}, function (error, proposition) {
      if (error) res.render('error', {error: error});
      if (proposition) res.render('mestrajets', {propo: proposition, user:req.session.user});
    });
  }else {
    req.session.redire = '/mestrajets';
    res.redirect('notlogged');
  }
});
//mes trajets(trajets that I )
router.get('/mesreservations', function (req,res) {
  rmredire(req,res);
  if (req.session.user){
    reserver.find({reserverid: req.session.user._id}, function (error,reserv) {
      if (error) res.render('error', {error:error});
      if (reserv) res.render('mesreservations', {reserv:reserv, user: req.session.user});
    });
  }else {
    req.session.redire = '/mesreservations';
    res.redirect('notlogged');
  }
});



// posts
//login
router.post('/login', function(req,res){
  if (req.session.user) res.redirect("/profile")
  if (req.body.submit){
    user.findOne({
      email: req.body.email
    }, function(error,user){
      if (error) res.render('error', {error:error});
      if (user){ if (bcrypt.compareSync(req.body.pass, user.pass)) {
        req.session.user = user;
        console.log(req.session.user);
        if (req.session.redire){
          console.log("[+] redirection: "+req.session.redire);
          res.redirect(req.session.redire);
        }else {
          console.log("redirecting to profile");
          res.redirect('/profile');
        }
      }else {
        res.render('notlogged',{ps:"ces coordonnés sont fausses, réessayez"});
      }}else {
        res.render("notlogged",{ps:"cet email n'existe pas"})
      }
    });
    };
  });

//register
router.post('/register', function(req,res){
  if (req.session.user) res.redirect("/profile");
  if (req.body.password == req.body.confirm){
    var hashedpass = bcrypt.hashSync(req.body.password, 10);
    user.create({
      nom         : req.body.nom,
      prenom      : req.body.prenom,
      email       : req.body.email,
      pass        : hashedpass,
      year        : req.body.year,
      number      : req.body.number,
      facebook    : req.body.facebook,
      bestdepart  : req.body.bestdepart,
      bestdest    : req.body.bestdest

    }, function(error, user){
      if (error){ res.render('register', {ps:error});}
      else {
        req.session.user = user;
        // send registeration email
        var mailoptions = {
          to: user.email,
          from: "easytraveltechera@gmail.com",
          subject: "Compte crée !",
          text: "Bienvenu parmis nous !"
        }
        transporter.sendMail(mailoptions, function (error, success) {
          if (error) console.log("Error => "+error);
          else if (success){
            console.log("Email Sent "+email.info );
          }
        });
        // redirect user to profile
        res.redirect('/profile');
      }
    });
  }else {
  res.render('register', {ps:"please confirm your password carefully"});
  }
});

//update profile
router.post('/update', function (req,res) {
  if (!req.session.aller1) res.redirect("notlogged");
  if (req.body.submit){
    var hashedpass = bcrypt.hashSync(req.body.password, 10);
    user.findOneAndUpdate({_id: req.session.user._id},{$set:{
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
        req.session.user = result;
        console.log("updating profile :"+req.session.user);
        reserver.find({proposerid: req.session.user._id}, function (error,reservation) {
          if (error) res.render('error', {error: error});
          console.log(reservation);
          if (reservation) res.render('profile', {user:req.session.user, reservations:reservation});
        });
      }
    });
  }
});

// Email and functions

// requirements for email
// template
var reserv_template = fs.readFileSync("./email/reserv.ejs", "utf-8");
var accept_template = fs.readFileSync("./email/accept.ejs", "utf-8");
var trajet_template = fs.readFileSync("./email/trajet.ejs", "utf-8")

// compile templates
var reserv_compiled = ejs.compile(reserv_template);
var accept_compiled = ejs.compile(accept_template);
var trajet_compiled = ejs.compile(trajet_template);

var transporter = nodemailer.createTransport({
  service: '@marouen-kanoun',
  auth: {
    user: 'easytraveltechera@gmail.com',
    pass: '20104957'
  }
});

function sendmails(depart, etape, dest, req, date, time) {
  // getting the, req, allezDate, allezTime email list from data base
  var mailist = []
  user.find({$or:[{bestdepart: depart}, {bestdepart: etape}], bestdest: dest}, function (error, users) {
    users.forEach(function (user) {
      mailist.push(user.email);
    });
  });
  var mailOptions = {
    from: 'easytraveltechera@gmail.com',
    to: mailist,
    subject: 'Nouveau trajet de '+depart+" vers "+dest,
    html: ejs.render(trajet_template,{user: req.session.user, depart: depart, dest: dest, etape: etape, date: date, time: time})
    /*text: req.session.user.nom+' a proposé un tajet de '+depart+" vers "+dest+" passant par "+etape*/
  };
  transporter.sendMail(mailOptions, function (error, result) {
    if (error) console.log("[ !! ] Error: "+error);
    if (result) console.log("[ !! ] Mail Sent: "+result.info);
  });
}

//####### Functions

// add 0 to time number
function addzero(num) {
  var numStr = num.toString()
  if (numStr.length == 1) {
    numStr = "0"+numStr
  }
  return numStr
}

// remove redirection
function rmredire(req,res){
  if (req.session.redire){
    delete req.session.redire;
  }
}

// ###### Exportation
module.exports = router
