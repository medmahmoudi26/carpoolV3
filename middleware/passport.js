const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// Load user model
var User = require("../models/user.js")

module.exports = function (passport) {
  passport.use(
    new LocalStrategy({usernameField: 'email'}, function(email, password, done) {
      // Match user
      User.findOne({email: email}, function (err, user) {
        if (err) {
          console.log(err);
        } else if (!user) {
          return done(null, false, {message: "Cet email n'existe pas"});
        } else {
          if (bcrypt.compareSync(password, user.password)) {
            return done(null, user); // all conditions exist
          } else {
            return done(null, false, {message: "Mot de passe incorrecte"});
          }
        }
      });
    })
  );
  // serializing
  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });
  // deserializing
  passport.deserializeUser(function (id, done) {
    User.findById(id, function (err, user) {
      done(err, user);
    });
  });
}
