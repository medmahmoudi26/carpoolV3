module.exports = {
  checkAdmin: function (req,res,next) {
    if (req.isAuthenticated() && req.user.isAdmin === true) {
      return next()
    } else {
      req.flash('error_msg', 'you need admin access');
      res.redirect("/admin/login");
    }
  }
}
