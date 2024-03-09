
var url = "https://api.minetools.eu/ping/opencolamod.com";

$.getJSON(url, function(r) {
  //data is the JSON string
  if (r.error) {
    $('#rest').html('Server Offline');
    return false;
  }
  var pl = '';
  if (r.players.sample.length > 0) {
    pl = '<br>OP: ' + r.players.sample[0].name;
  }
  $('#rest').html(r.description.replace(/§(.+?)/gi, '') + '<br><b>Players Online:</b> ' + r.players.online + pl);
  $('#favicon').attr('src', r.favicon);

});

$(document).ready(function() {
  var url = "https://api.minetools.eu/ping/opencolamod.com";
  
  $.getJSON(url, function(r) {
    if (r.error) {
      $('#rest').html('Server Offline');
      return false;
    }
    var pl = '';
    if (r.players.sample.length > 0) {
      pl = '<br>OP: ' + r.players.sample[0].name;
    }
    $('#rest').html(r.description.replace(/§(.+?)/gi, '') + '<br><b>Players Online:</b> ' + r.players.online + pl);
    $('#favicon').attr('src', r.favicon);

  // Dark mode toggle functionality
  const toggleButton = document.getElementById('dark-mode-toggle');
  toggleButton.addEventListener('click', function() {
    document.body.classList.toggle('dark-mode');
    
    // Save the user's preference in localStorage
    if(document.body.classList.contains('dark-mode')) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  });
  
  // Check the user's preference on page load
  if(localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
  }
});
