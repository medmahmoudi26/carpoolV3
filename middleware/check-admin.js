module.exports = {
  checkAdmin: function (req,res,next) {
    if (req.isAuthenticated() && req.user.isAdmin) {
      return next()
    } else {
      console.log("Error");
      req.flash('error_msg', 'you need admin access');
      res.redirect("/admin/login");
    }
  }
}
