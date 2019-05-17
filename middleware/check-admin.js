module.exports = {
  checkAuth: function (req,res,next) {
    if (req.isAuthenticated() && req.user.isAdmin === true) {
      return next()
    } else {
      res.render("unausthorized");
    }
  }
}
