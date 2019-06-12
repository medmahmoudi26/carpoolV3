const express     = require('express');
const mongoose    = require('mongoose');
const bcrypt      = require('bcrypt');
const session     = require('express-session');
const ejs         = require('ejs');
const fs          = require('fs');
const DateOnly    = require('date-only');
const nodemailer  = require('nodemailer');
const passport    = require('passport');
const {checkAuth} = require('../middleware/check-auth');

var user     = require("../models/user.js")
var trajet   = require('../models/trajet.js');
var reserver = require('../models/reserver.js');
var cardispo = require('../models/cardispo.js');
var cars     = require('../models/cars.js');

var router = express.Router()

  // ***** routes *****

// GET REQUESTS

//index
router.get('/', function(req,res){
  if (req.isAuthenticated()) {
    res.render('index', {user:req.user});
  } else {
    res.render('index')
  }
});

router.get('/index', function (req,res) {
  res.redirect('/')
});

// main page for proposition to choose proposition type
router.get('/proposer', checkAuth, function(req,res){
  res.render('proposer', {user: req.user})
});

// if proposition is simple
router.get("/aller", checkAuth, function (req,res) {
  res.render("allerProp1", {user: req.user});
});

// if proposition is complicated
router.get("/aller&retour", checkAuth, function (req, res) {
  res.render("propBoth1", {user: req.user});
});

// route for errors
router.get("/error", function (req, res) {
  res.render("error");
});

// POST REQUESTS

// look for path
router.post('/chercher', function(req,res){
  if(req.body.depart && req.body.dest && req.body.date){
    req.body.date = new Date(req.body.date+" UTC")
    // find allant
    trajet.find({
      depart      : req.body.depart,
      dest        : req.body.dest,
      allezDate   : new DateOnly(req.body.date).toISOString(),
      date_object : {$gte: req.body.date} // date is stored in string format in the trajets schema
    }, function(error, allant){
      if (error) res.render('error', {error: error});
      // find en etap (same destination, pick up on road)
      trajet.find({
        etape:      req.body.depart,
        dest        : req.body.dest,
        allezDate   : new DateOnly(req.body.date).toISOString(),
        date_object : {$gte: req.body.date}
      }, function (error, etape) {
        if (error) res.render('error',{error: error});
        // leaving on road
        else {
          trajet.find({
            depart: req.body.depart,
            etap: req.body.dest,
            allezDate: new DateOnly(req.body.date).toISOString(),
            date_object: {$gte: req.body.date}
          }, function (error, descend) {
            if (error) res.render("error", {error: error});
            else if (req.isAuthenticated()){
              res.render('found',{allant: allant, etape: etape, user: req.user, descend: descend, request: req.body});
            }else {
              //transfer date object to iso string
              if (etape.allezDate) etape.allezDate = etape.allezDate.toISOString();
              res.render('found',{allant: allant, etape:etape, descend: descend, request: req.body});
            }
          });
        }
      });
    });
  }
});

//proposer aller step 1
router.post("/aller1", checkAuth, function (req,res) {
  //if (!req.body.allerDate || !req.body.finDate || !req.body.etab) res.render("error", {error: "check all fields"})
  console.log(req.body);
  var recap = req.body;
  var stringAllerDate = req.body.allezDate;
  var stringFinDate = req.body.finDate;
  req.body.allezDate = new Date(req.body.allezDate + " UTC"); //convert to date-only object the allez et fin date
  req.body.finDate   = new Date(req.body.finDate + " UTC");
  var etab           = req.body.etab // etablissement
  // if date of start is bigger than the final date tell error
  if (req.body.allezDate > req.body.finDate) res.render("allerProp1", {user: req.user, error: "les dates ne sont pas valides"});
  cardispo.find({
    $or : [
      {
        brand_new  : true,
        etab       : etab
      },
      {
        half_dispo    : false,
        FreeStartDate : {$lte: req.body.allezDate} , // car ends being busy on a date less or equal to the date we choose to start using
        FreeEndDate   : {$gte: req.body.finDate} , // car starts being busy after or at the date we choose to stop using
        etab          : etab
    },
    {
        half_dispo    : true,
        FreeStartDate : {$lte: req.body.allezDate},
        etab          : etab
    }]
  }, function (error, cars) {
    if (error) res.render("allerProp1", {user: req.user, error:error});
    if (cars) {
      req.session.aller1 = req.body; // the body request will be in session to be needed in step 2
      res.render("allerProp2", {user:req.user, recap:recap, cars:cars, allerDate: stringAllerDate, finDate: stringFinDate});
    }
  });
});

// step 2 of reserving a path
router.post("/aller2", checkAuth, function (req,res) {
  if (!req.session.aller1) {
    res.redirect("/proposer")
  }
  var cardispo_id   = req.body.car;
  var desc  = req.body.desc;
  cardispo.findOne({_id: cardispo_id}, function (error,cardispo_result) {
    if (error) res.render("allerProp1", {user: req.user, error: error})
    var car = cardispo_result
    console.log(car.brand_new);
    if (car.brand_new === true) {
      cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
        {
          brand_new     : false,
          car           : car.car,
          FreeStartDate : new DateOnly(0), // car start being free at 0 date
          FreeEndDate   : req.session.aller1.allezDate, // car ends being free when the user decides to take it
          half_dispo    : false
        }
      }, function (error , result_car) {
        cardispo.create({
          brand_new     : false, // a new table created with same car options
          car           : car.car,
          FreeStartDate : req.session.aller1.finDate, // car start being free when user's journey is over
          half_dispo    : true, // means the table is waiting for someone to filll the FreeStartDate
          places        : car.places,
          etab          : car.etab
        }, function (error, final_car) {
          if (error) res.render("allerProp1", {user:req.user, error: error})
          else if (final_car) {
          var allezDate = new Date(req.session.aller1.allezDate)
          var hour      = allezDate.getUTCHours()
          var houred    = addzero(hour)
          var mins      = allezDate.getUTCMinutes()
          var mined     = addzero(mins)
          var allezTime = houred+":"+mined // retreive the time in a string format
          var allezDate = new DateOnly(allezDate).toISOString() // date in string format
            trajet.create({
              userid      : req.user._id,
              nom         : req.user.nom,
              prenom      : req.user.prenom,
              depart      : req.session.aller1.depart,
              etape       : req.session.aller1.etape,
              dest        : req.session.aller1.dest,
              date_object : req.session.aller1.allezDate, // object to be used for date comparision later
              allezDate   : allezDate, // string
              allezTime   : allezTime, // string
              places      : car.places,
              car         : car.car,
              description : desc
            }, function (error , trajet) {
              if (error) res.render("allerProp1", {user:req.user, error: error});
              if (trajet) {
                res.render("success", {trajet: trajet, user: req.user})
                sendmails(trajet.depart, trajet.etape, trajet.dest, req, allezDate, allezTime);
              }
            });
          }
        });
      });
    } else {
      if (car.half_dispo === true) {
        cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
          {
            FreeEndDate : req.session.aller1.allezDate, // if car is waiting for FreeEndDate it will be created and filled the start date of the user's trip
            half_dispo  : false
          }
        }, function (error, result_car) {
          if (error) res.render('error', {user: req.user, error:error});
          else if (result_car) {
            cardispo.create({
              brand_new     : false, // new table created with user journey's end date pointing to the beginning of the free time of the car
              car           : car.car,
              FreeStartDate : req.session.aller1.finDate,
              half_dispo    : true,
              etab          : car.etab,
              places        : car.places
            }, function (error, result_car2) {
              if (error) res.render('allerProp1', {user: req.user, error: error});
              else if (result_car2) {
                var allezDate = new Date(req.session.aller1.allezDate)
                var hour      = allezDate.getUTCHours()
                var houred    = addzero(hour)
                var mins      = allezDate.getUTCMinutes()
                var mined     = addzero(mins)
                var allezTime = houred+":"+mined
                var allezDate = new DateOnly(allezDate).toISOString()
                trajet.create({
                  userid      : req.user._id,
                  nom         : req.user.nom,
                  prenom      : req.user.prenom,
                  depart      : req.session.aller1.depart,
                  etape       : req.session.aller1.etape,
                  dest        : req.session.aller1.dest,
                  date_object : req.session.aller1.allezDate,
                  allezDate   : allezDate,
                  allezTime   : allezTime,
                  places      : car.places,
                  car         : car.car,
                  description : desc
                }, function (error , trajet) {
                  if (error) res.render("aller1", {user:req.user, error: error});
                  if (trajet) {
                    res.render("success", {trajet: trajet, user: req.user});
                    sendmails(trajet.depart, trajet.etape, trajet.dest, req, allezDate, allezTime);
                  }
                });
              }
            });
          }
        });
      } else {
        cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
          {
            FreeEndDate : req.session.aller1.allezDate, // if both Start and End date are there and the car is available modify the FreeEndDate with user's depart date
            half_dispo  : false // make car half dispo
          }
        }, function (error, result_car) {
          if (error) res.render("allerProp1", {user:req.user, error: error});
          else if (result_car) {
            cardispo.create({
              brand_new     : false, // craeted a new table with same car options
              FreeStartDate : req.session.aller1.finDate, // car start being free when the user's journey ends
              FreeEndDate   : result_car.FreeEndDate,
              half_dispo    : false, // table waiting for FreeEndDate
              car           : car.car,
              places        : car.places,
              etab          : car.etab
            }, function (error, final_car) {
              if (error) res.render("allerProp1", {user: req.user, error: error})
              else if (final_car) {
                var allezDate = new Date(req.session.aller1.allezDate)
                var hour      = allezDate.getUTCHours()
                var houred    = addzero(hour)
                var mins      = allezDate.getUTCMinutes()
                var mined     = addzero(mins)
                var allezTime = houred+":"+mined
                var allezDate = new DateOnly(allezDate).toISOString()
                trajet.create({
                  userid      : req.user._id,
                  nom         : req.user.nom,
                  prenom      : req.user.prenom,
                  depart      : req.session.aller1.depart,
                  etape       : req.session.aller1.etape,
                  dest        : req.session.aller1.dest,
                  date_object : req.session.aller1.allezDate,
                  allezDate   : new DateOnly(req.session.aller1.allezDate).toISOString(),
                  allezTime   : allezTime,
                  places      : car.places,
                  car         : car.car,
                  description : desc
                }, function (error , trajet) {
                  if (error) res.render("aller1", {user:req.user, error: error});
                  if (trajet) {
                    res.render("success", {trajet: trajet, user: req.user})
                    sendmails(trajet.depart, trajet.etape, trajet.dest, req, allezDate, allezTime);
                  }
                });
              }
            });
          }
        });
      }
    }
  });
});

//proposer aller&retour step 1
router.post("/aller&retour1", checkAuth, function (req,res) {
  //if (!req.body.allerDate || !req.body.finDate || !req.body.etab) res.render("error", {error: "une erreure s'est produite"})
  var recap = req.body;
  var stringAllerDate = req.body.allezDate;
  var stringFinDate = req.body.finDate;
  req.body.allezDate = new Date(req.body.allezDate+" UTC"); //convert to date-only object the allez et fin date
  req.body.finDate   = new Date(req.body.finDate+" UTC");
  var etab           = req.body.etab // etablissement
  // if date of start is bigger than the final date tell error
  if (req.body.allezDate > req.body.finDate) {
    res.render("propBoth1", {user: req.user, error: "les dates ne sont pas valides"});
  } else {
    cardispo.find({
      $or : [
        {
          brand_new  : true,
          etab       : etab
        },
        {
          half_dispo    : false,
          FreeStartDate : {$lte: req.body.allezDate} , // car ends being busy on a date less or equal to the date we choose to start using
          FreeEndDate   : {$gte: req.body.finDate} , // car starts being busy after or at the date we choose to stop using
          etab          : etab
      },
      {
          half_dispo    : true,
          FreeStartDate : {$lte: req.body.allezDate},
          etab          : etab
      }]
    }, function (error, cars) {
      console.log("[+] Finding car")
      if (error) res.render("propBoth1", {user: req.user, error:error});
      if (cars) {
        req.session.aller1 = req.body; // the body request will be in session to be needed in step 2
        console.log(req.body);
        res.render("propBoth2", {user:req.user, recap:recap, cars:cars, allerDate: stringAllerDate, finDate: stringFinDate});
      }
    });
  }
});

// step 2 of reserving a path aller&retour
router.post("/aller&retour2", checkAuth, function (req,res) {
  if (!req.session.aller1) {
    res.redirect("/proposer")
  }
  var cardispo_id           = req.body.car;
  var desc                  = req.body.desc;
  req.body.retourDepartDate = new Date(req.body.retourDepartDate+" UTC"); // date in utc time
  var finDate               = new Date(req.session.aller1.finDate)
  console.log(req.body.retourDepartDate);
  if (req.body.retourDepartDate > finDate) {
    res.render("propBoth1", {user:req.user, error:"la date de retour n'est pas valide"})
  } else {
    cardispo.findOne({_id: cardispo_id}, function (error,cardispo_result) {
      if (error) res.render("allerProp1", {user: req.user, error: error})
      var car = cardispo_result
      if (car.brand_new === true) {
        cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
          {
            brand_new     : false,
            car           : car.car,
            FreeStartDate : new DateOnly(0),
            FreeEndDate   : req.session.aller1.allezDate,
            half_dispo    : false
          }
        }, function (error , result_car) {
          cardispo.create({
            brand_new     : false,
            car           : car.car,
            FreeStartDate : req.session.aller1.finDate,
            half_dispo    : true,
            places        : car.places,
            etab          : car.etab
          }, function (error, final_car) {
            if (error) res.render("allerProp1", {user:req.user, error: error})
            else if (final_car) {
            var allezDate = new Date(req.session.aller1.allezDate)
            var hour      = allezDate.getUTCHours()
            var houred    = addzero(hour)
            var mins      = allezDate.getUTCMinutes()
            var mined     = addzero(mins)
            var allezTime = houred+":"+mined // retreive the time in a string format
            var allezDate = new DateOnly(allezDate).toISOString() // date in string format
              trajet.create({
                userid      : req.user._id,
                nom         : req.user.nom,
                prenom      : req.user.prenom,
                depart      : req.session.aller1.depart,
                etape       : req.session.aller1.etape,
                dest        : req.session.aller1.dest,
                date_object : req.session.aller1.allezDate,
                allezDate   : allezDate,
                allezTime   : allezTime,
                places      : car.places,
                car         : car.car,
                description : desc
              }, function (error , trajet1) {
                if (error) res.render("allerProp1", {user:req.user, error: error});
                if (trajet1) {
                  sendmails(trajet1.depart, trajet1.etape, trajet1.dest, req, allezDate, allezTime);
                  var retourDepartDate = new Date(req.body.retourDepartDate)
                  var hour             = retourDepartDate.getUTCHours()
                  var houred           = addzero(hour)
                  var mins             = retourDepartDate.getUTCMinutes()
                  var mined            = addzero(mins)
                  var allezTime        = houred+":"+mined // retreive the time in a string format
                  var retourDepartDate = new DateOnly(retourDepartDate).toISOString() // date in string format
                  trajet.create({
                    userid      : req.user._id,
                    nom         : req.user.nom,
                    prenom      : req.user.prenom,
                    depart      : req.session.aller1.dest,
                    etape       : req.session.aller1.etape,
                    dest        : req.session.aller1.depart,
                    date_object : req.body.retourDepartDate, // date object for later aggregation
                    allezDate   : retourDepartDate, // date in string format
                    allezTime   : allezTime, // time in string format
                    places      : car.places,
                    car         : car.car,
                    description : desc
                  }, function (error, trajet2) {
                    if (error) res.render("propBoth2", {user: req.user, error: error});
                    else if (trajet2){
                      sendmails(trajet2.depart, trajet2.etape, trajet2.dest, req, allezDate, allezTime);
                      res.render("success", {trajet: trajet1, user: req.user, trajet2: trajet2});
                    }
                  });
                }
              });
            }
          });
        });
      } else {
        if (car.half_dispo === true) {
          cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
            // make the old half dispo full
            {
              FreeEndDate : req.session.aller1.allezDate,
              half_dispo  : false
            }
          }, function (error, result_car) {
              if (error) res.render("error", {user:req.user, error: error});
              cardispo.create({
                brand_new     : false,
                car           : car.car,
                FreeStartDate : req.session.aller1.finDate,
                half_dispo    : true,
                etab          : req.session.aller1.etab,
                places        : car.places
              }, function (error, result_car2) {
              if (error) res.render('error', {user: req.user, error:error});
              else if (result_car) {
                var allezDate = new Date(req.session.aller1.allezDate)
                var hour      = allezDate.getUTCHours()
                var houred    = addzero(hour)
                var mins      = allezDate.getUTCMinutes()
                var mined     = addzero(mins)
                var allezTime = houred+":"+mined
                var allezDate = new DateOnly(req.session.aller1.allezDate).toISOString()
                trajet.create({
                  userid      : req.user._id,
                  nom         : req.user.nom,
                  prenom      : req.user.prenom,
                  depart      : req.session.aller1.depart,
                  etape       : req.session.aller1.etape,
                  dest        : req.session.aller1.dest,
                  date_object : req.session.aller1.allezDate,
                  allezDate   : allezDate,
                  allezTime   : allezTime,
                  places      : car.places,
                  car         : car.car,
                  description : desc
                }, function (error , trajet1) {
                  if (error) res.render("aller1", {user:req.user, error: error});
                  if (trajet1) {
                    sendmails(trajet1.depart, trajet1.etape, trajet1.dest, req, allezDate, allezTime);
                    var retourDepartDate = new Date(req.body.retourDepartDate)
                    var hour             = retourDepartDate.getUTCHours()
                    var houred           = addzero(hour)
                    var mins             = retourDepartDate.getUTCMinutes()
                    var mined            = addzero(mins)
                    var allezTime        = houred+":"+mined // retreive the time in a string format
                    var retourDepartDate = new DateOnly(retourDepartDate).toISOString() // date in string format
                    trajet.create({
                      userid      : req.user._id,
                      nom         : req.user.nom,
                      prenom      : req.user.prenom,
                      depart      : req.session.aller1.dest,
                      etape       : req.session.aller1.etape,
                      dest        : req.session.aller1.depart,
                      date_object : req.body.retourDepartDate, // date object for later aggregation
                      allezDate   : retourDepartDate, // date in string format
                      allezTime   : allezTime, // time in string format
                      places      : car.places,
                      car         : car.car,
                      description : desc
                    }, function (error, trajet2) {
                      if (error) res.render("propBoth2", {user: req.user, error: error});
                      else if (trajet2){
                        sendmails(trajet2.depart, trajet2.etape, trajet2.dest, req, allezDate, allezTime);
                        res.render("success", {trajet: trajet1, user: req.user, trajet2: trajet2});
                      }
                    });
                  }
                });
              }
            });
          });
        } else {
          cardispo.findOneAndUpdate({_id: cardispo_id}, {$set:
            {
              FreeEndDate : req.session.aller1.allezDate,
              half_dispo  : false
            }
          }, function (error, result_car) {
            if (error) res.render("allerProp1", {user:req.user, error: error});
            else if (result_car) {
              cardispo.create({
                brand_new     : false,
                FreeStartDate : req.session.aller1.finDate,
                FreeEndDate   : result_car.FreeEndDate,
                half_dispo    : false,
                car           : car.car,
                etab          : car.etab,
                places        : car.places
              }, function (error, final_car) {
                if (error) res.render("allerProp1", {user: req.user, error: error})
                else if (final_car) {
                  var allezDate = new Date(req.session.aller1.allezDate)
                  var hour      = allezDate.getUTCHours()
                  var houred    = addzero(hour)
                  var mins      = allezDate.getUTCMinutes()
                  var mined     = addzero(mins)
                  var allezTime = houred+":"+mined
                  var allezDate = new DateOnly(allezDate).toISOString()
                  trajet.create({
                    userid      : req.user._id,
                    nom         : req.user.nom,
                    prenom      : req.user.prenom,
                    depart      : req.session.aller1.depart,
                    etape       : req.session.aller1.etape,
                    dest        : req.session.aller1.dest,
                    date_object : req.session.aller1.allezDate,
                    allezDate   : allezDate,
                    allezTime   : allezTime,
                    places      : car.places,
                    car         : car.car,
                    description : desc
                  }, function (error , trajet1) {
                    if (error) res.render("aller1", {user:req.user, error: error});
                    if (trajet1) {
                      sendmails(trajet1.depart, trajet1.etape, trajet1.dest, req, allezDate, allezTime);
                      var retourDepartDate = new Date(req.body.retourDepartDate)
                      var hour             = retourDepartDate.getUTCHours()
                      var houred           = addzero(hour)
                      var mins             = retourDepartDate.getUTCMinutes()
                      var mined            = addzero(mins)
                      var allezTime        = houred+":"+mined // retreive the time in a string format
                      var retourDepartDate = new DateOnly(retourDepartDate).toISOString() // date in string format
                      trajet.create({
                        userid      : req.user._id,
                        nom         : req.user.nom,
                        prenom      : req.user.prenom,
                        depart      : req.session.aller1.dest,
                        etape       : req.session.aller1.etape,
                        dest        : req.session.aller1.depart,
                        date_object : req.body.retourDepartDate, // date object for later aggregation
                        allezDate   : retourDepartDate, // date in string format
                        allezTime   : allezTime, // time in string format
                        places      : car.places,
                        car         : car.car,
                        description : desc
                      }, function (error, trajet2) {
                        if (error) res.render("propBoth2", {user: req.user, error: error});
                        else if (trajet2){
                          sendmails(trajet2.depart, trajet2.etape, trajet2.dest, req, allezDate, allezTime);
                          res.render("success", {trajet: trajet1, user: req.user, trajet2: trajet2});
                        }
                      });
                    }
                  });
                }
              });
            }
          });
        }
      }
    });
  }
});

// test add car
router.get("/testcar", checkAuth, function (req,res) {
  res.render("testcar");
})

router.post("/testcar", checkAuth, function (req,res) {
    cars.create({
      mat:            req.body.mat,
      model:          req.body.model,
      places:         req.body.places,
      etablissement:  req.body.etablissement,
      remarque:       req.body.remarque
  },function (error, suc1) {
    if (error) res.render("error", {error: error});
    if (suc1) {
      console.log(suc1);
      cardispo.create({
        brand_new : true,
        car       : suc1.mat,
        etab      : suc1.etablissement,
        places    : suc1.places
      }, function (error, suc2) {
        if (error) res.render("error", {error: error});
        else if(suc2) {
          console.log(suc2);
          res.render("error", {error: "Success"});
        }
      });
    }
  });
});

//profile of another user
router.get('/detail/:id', checkAuth, function(req,res){
  user.findOne({_id:req.params.id}, function(error,result){
    if(error) {
      res.render('error', {error: "le profil que vous chercher n'existe pas"});
    } else if (!result) {
      res.render('error', {error: "le profil que vous cherchez n'existe pas"});
    } else {
      res.render('details', {user: result});
    }
  });
});

// Email and functions

// requirements for email
// template
var reserv_template = fs.readFileSync("./email/reserv.ejs", "utf-8");
var accept_template = fs.readFileSync("./email/accept.ejs", "utf-8");
var trajet_template = fs.readFileSync("./email/trajet.ejs", "utf-8")

var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'easytraveltechera@gmail.com',
    pass: 'tnt23793213'
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
    html: ejs.render(trajet_template,{user: req.user, depart: depart, dest: dest, etape: etape, date: date, time: time})
    /*text: req.user.nom+' a proposé un tajet de '+depart+" vers "+dest+" passant par "+etape*/
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

// exporting
module.exports = router
