const mongoose = require('mongoose');
var Schema = mongoose.Schema;
var CarSchema = new Schema ({
  mat             : {type: String, required: true}, //matricule
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
  puissance       : {type: String},
  puissanceFasc   : {type: String},
  pneumatiques    : {type: String},
  garnissage      : {type: String},
  color           : {type: String},
  options         : {type: String},
  accessoires     : {type: String},
  amenagement     : {type: String},
  boite           : {type: String},
  LocalisationCertImmat  : {type: String},
  signalétique    : {type: String},
  remarque        : {type: String},
  etablissement   : {type: String}
});

module.exports = mongoose.model("car", CarSchema);
