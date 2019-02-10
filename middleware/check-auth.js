module.exports = {
  checkAuth: function (req,res,next) {
    if (req.isAuthenticated()) {
      return next()
    } else {
      req.flash('error_msg', 'vous avez besoin de vous connecter pour accèder à cette page');
      res.redirect('/user/login')
    }
  }
}
