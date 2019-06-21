//require packages
const express = require('express');
const BodyParser = require('body-parser');
const ejs = require('ejs');
const session = require('express-session');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const fs = require('fs');
const passport = require('passport');
const flash = require('connect-flash');

// declare app variable server and connect to database
app = express();
var server = require('http').createServer(app);
var db = mongoose.connect('mongodb://localhost:27017/coVoiture'); // mongodb://user661:6KLXjWlQA5SNNiyy@mongo834:27017/admin

// passport config
require('./middleware/passport')(passport);

//session and passport
app.use(session({secret:'cocar'}));
app.use(passport.initialize());
app.use(passport.session());

// flash
app.use(flash());
app.use(function (req,res,next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

//requrie models
const trajet = require('./models/trajet');
const user = require('./models/user');
const reserver = require('./models/reserver');
const cardispo = require('./models/cardispo');
const cars = require('./models/cars');

//set app and requirements
app.set('view engine', 'ejs');
app.use(express.static(__dirname+'/public'));
app.use(BodyParser.urlencoded());
app.use(BodyParser.json());
app.use(session({
  secret: 'covoiture'
}));

// routes
var userRoutes  = require("./routes/user.js");
var indexRoutes = require("./routes/index.js");
var adminRoutes = require("./routes/admin.js");

app.use("/user", userRoutes);
app.use("/", indexRoutes);
app.use("/admin", adminRoutes);

//listen
console.log("listening on port 80");
server.listen(80);

//######[Emailing]#########

// requirements for email
// template
var reserv_template = fs.readFileSync("./email/reserv.ejs", "utf-8");
var accept_template = fs.readFileSync("./email/accept.ejs", "utf-8");
var trajet_template = fs.readFileSync("./email/trajet.ejs", "utf-8")

// compile templates
var reserv_compiled = ejs.compile(reserv_template);
var accept_compiled = ejs.compile(accept_template);
var trajet_compiled = ejs.compile(trajet_template);

// #########[sockets]#######
var io = require('socket.io')(server);
io.sockets.on('connection', function(socket){
  console.log('user connected');
  socket.on('reserver', function (data) {
    console.log("reservation");
    //trajet
    var trajetid = data.trajetid;
    var destination = data.destination;
    var depart = data.depart;
    var date = data.date;
    //proposer
    var proposerid = data.proposerid;
    var proposername = data.proposername;
    //reserver credentials
    var reserverid = data.reserverid;
    var reservername = data.reservername;

    // trouver si il a déja fait une reservation
    reserver.create({
      //trajet
      trajetid: trajetid,
      depart: depart,
      destination: destination,
      date: date,
      //proposer
      proposerid: proposerid,
      proposername: proposername,
      //reserver
      reserverid: reserverid,
      reservername: reservername,
      reserved: false
    }, function (error, data) {
      if (error) socket.emit('error', error);
      if (data) {
        user.findOne({_id: proposerid}, function (error, usr) {
          if (error) console.log("Error "+error);
          else if (usr) {
            console.log(usr.email);
            socket.emit('success', trajetid);
            trajet.findOne({_id: trajetid}, function (error, trajet) {
              if (error) console.log(error);
              else if(trajet) {
                var mailOptions = {
                  from: 'easytraveltechera@gmail.com',
                  to: usr.email,
                  subject: 'Reservation',
                  html: ejs.render(reserv_template,{usr: usr, trajet: trajet})
                  /*text: reservername+' est interéssé par votre trajet de '+depart+' vers '+destination+" le "+date*/
                };
                transporter.sendMail(mailOptions, function (error, result) {
                  if (error) console.log("[ !! ] Error: "+error);
                  else if (result) console.log("Email Sent "+result.info);
                });
              }
            })
          }
        })
      }
    });
  });
  socket.on('accepter', function (data) {
    var trajetid = data.trajetid;
    var reserveid = data.reserveid;
    trajet.findOneAndUpdate({$and: [{_id: trajetid}, {places:{$ne: 0}}]}, {$inc:{places: -1}},{new:true}, function (error,newtrajet) {
      if (error) socket.emit('error', error);
      if (newtrajet) {
        if(newtrajet == ''){
          socket.emit('full',reserveid);
        }else{
            reserver.findOneAndUpdate({_id: reserveid}, {$set:{reserved: true}},{new: true}, function (err, up) {
            if (err) socket.emit('error', {error: err});
            if (up) {
              user.findOne({_id: up.reserverid}, function (error, usr) {
                if (error) console.log("Error finding user");
                else if (usr) {
                  socket.emit('success', reserveid);
                  var mailOptions = {
                    from: 'easytraveltechera@gmail.com',
                    to: usr.email,
                    subject: 'Reservation acceptée',
                    html: ejs.render(accept_template,{trajet: newtrajet, usr:usr})
                    /*text: 'Votre reservation avec '+newtrajet.nom+' le '+newtrajet.allezDate+' de '+newtrajet.depart+' vers '+newtrajet.dest+' est acceptée'*/
                  };
                  transporter.sendMail(mailOptions, function (error, result) {
                    if (error) console.log("[ !! ] Error: "+error);
                    else if (result) console.log("Email Sent "+ result.info);
                  });
                }
              });
            }
          });
        }}
      });
    });
    socket.on("update", function (car) {
      var id = car.id;
      var mat = car.mat;
      var model = car.model;
      var lastVersionDate = car.lastVersion;
      var fisrtUsageDate = car.firstUsage;
      var parcEntreeDate = car.parcEntree;
      var lastControleDate = car.lastControle;
      console.log("Updating car");
      cars.findOneAndUpdate({_id: id},{$set:{mat:mat, model:model}}, {new: true}, function (error, updated) {
        if (error) socket.emit("error", error);
        else socket.emit('updated', updated._id)
      });
    });
    socket.on("delete", function (id) {
      cars.findOneAndDelete({_id: id}, function (error, deleted) {
        if (error) socket.emit("error", error);
        else socket.emit("deleted", deleted._id);
      });
    });
  });



// add 0 to time number
function addzero(num) {
  var numStr = num.toString()
  if (numStr.length == 1) {
    numStr = "0"+numStr
  }
  return numStr
}

// transporter
var transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'easytraveltechera@gmail.com',
    pass: '20104957'
  }
});

// send emails function
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
