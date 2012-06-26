var basepath = "http://nieuwsinkaart.nl/pdok/kaart/";
$.getScript(basepath+'api/OpenLayers.js', function(){
	$.getScript(basepath+'api/javascripts/proj4js-compressed.js', function() {
		$.getScript(basepath+'api/lusc-api.js', function(){
			// var pdokkaart = createPDOKKaart();
		});
	});
});
