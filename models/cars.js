const mongoose = require('mongoose');
var Schema = mongoose.Schema;
var CarSchema = new Schema ({
  mat             : {type: String}, //matricule
  model           : {type: String},
  places          : {type: Number},
  lastVersionDate : {type: String},
  firstUsageDate  : {type: String},
  parcEntreeDate  : {type: String},
  lastControleDate: {type: String},
  marque          : {type: String},
  modele          : {type: String},
  finition        : {type: String},
  vin             : {type: String},
  carrosserie     : {type: String},
  energie         : {type: String},
  genre           : {type: String},
  type            : {type: String},
  doors           : {type: String},
  capacity        : {type: String},
  consoMixte      : {type: String},
  CO2             : {type: String},
  remarque        : {type: String},
  etablissement   : {type: String}
});

module.exports = mongoose.model("car", CarSchema);
