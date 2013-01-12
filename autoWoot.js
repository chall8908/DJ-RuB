(function() {
  var me = API.getSelf();
  API.addEventListener(API.DJ_ADVANCE, function(data) {
    if(data.dj.id != me.id) {
      $("#button-vote-positive").click();
    }
  });
})();
