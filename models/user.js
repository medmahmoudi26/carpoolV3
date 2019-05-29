const mongoose = require('mongoose');
var Schema = mongoose.Schema;

var UserSchema = new Schema ({
  nom           : {type: String, required: true},
  prenom        : {type: String, required: true},
  password      : {type: String, required: true},
  email         : {type: String, required: true, unique:true},
  year          : {type: String, required: true},
  number        : {type: String},
  facebook      : {type: String},
  bestdepart    : {type: String}, // best depart
  bestdest      : {type: String},  // best destination
  resetPasswordToken   : String,
  resetPasswordExpires : Date,
  isAdmin:        Boolean
});

module.exports = mongoose.model('user',UserSchema);
