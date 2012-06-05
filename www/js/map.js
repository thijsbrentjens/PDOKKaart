var mapPDOKKaart, markers;
var pdokachtergrondkaart;

// TODO: make config object, with anonymous function
OpenLayers.ProxyHost = "../xmldata.php?url=";

Proj4js.defs["EPSG:28992"] = "+title=Amersfoort / RD New +proj=sterea +lat_0=52.15616055555555 +lon_0=5.38763888888889 +k=0.9999079 +x_0=155000 +y_0=463000 +ellps=bessel +units=m +no_defs"; 

function init()
{
	setMapSize();
	addFormEnhancements();
	jQuery(window).resize(setMapSize);

	if(jQuery("#map").length>0){

    	var o = OpenLayers.Util.getParameters();
		// add the zoomlevel
	    var lusc = new Lusc.Api(o);

	    // Thijs, TODO: improve object handling and classes, but works for now :)
		mapPDOKKaart = lusc.getMapObject();
	
		// Thijs: markers are used to show Geocoderesults
		markers = new OpenLayers.Layer.Vector("Geocoderesults");
		// add popup functions for geocoding results
		/* */
		markers.events.register("mouseover", markers, function(e) {
			this.div.style.cursor = "pointer";
			var feature = this.getFeatureFromEvent(e);
		    
			if (feature) {
                if(feature.cluster) {
                   // do something                   
                }
			    // add a popup
			    onFeatureSelect(feature, false, markersPopupText(feature, false));
		        feature.popupFix = false;
			}
		});

		markers.events.register("mouseout", markers, function(e) {
			this.div.style.cursor = "default";
			var feature = this.getFeatureFromEvent(e);
			if (feature) {
			   // add a popup
			   // onFeatureSelect(feature);
			   if (!feature.popupFix) {
				onPopupClose(null, feature);
			   }
			}
		}); 

		markers.events.register("click", markers, function(e) {
			this.div.style.cursor = "default";
			var feature = this.getFeatureFromEvent(e);
			if (feature) {
			   // add a popup
			   onFeatureSelect(feature, true, markersPopupText(feature, true)); // full=true
			   feature.popupFix = true;			   
			}
		});

		markers.events.register("touchend", markers, function(e) {
			this.div.style.cursor = "default";
			var feature = this.getFeatureFromEvent(e);
			if (feature) {
			   // add a popup
			   onFeatureSelect(feature, true, markersPopupText(feature, true)); // full=true
			   feature.popupFix = true;
			} else {
			    return true;
			}	
		});
		
		// mapPDOKKaart.addLayers([pdokachtergrondkaart, markers]);
		// for Lusc API
		mapPDOKKaart.addLayers([markers]);

        // TouchNavigation
        /* */
		var touchNav = new OpenLayers.Control.TouchNavigation({
                dragPanOptions: {
                    enableKinetic: true
                }
            })
            
		controls = [
			new OpenLayers.Control.MousePosition()
			// , new OpenLayers.Control.PanZoomBar()
			// , new OpenLayers.Control.Navigation()
			, new OpenLayers.Control.KeyboardDefaults() // don't use KeyboardDefaults, since this may interfere with other functionality on a page
			, touchNav
		]
	
		// for the future upcoming searchresults
		// attach click to the li-suggestions (if available)
		// delegate..
	
		$('#searchResults').delegate('li/a','click', function (evt) {
			// console.log("klik " + $("span.hash", this).text())
			var hash = $("span.hash", this).text();
			var x = $("span.x", this).text();
			var y = $("span.y", this).text();
			var z = $("span.z", this).text();
			if(x && y){
				mapPDOKKaart.setCenter(new OpenLayers.LonLat(x, y), z);
				// TODO: remove all markers, only add this feature
				
				// $('#geozetStart').remove();
				// document.location.hash = hash;
			}
			else {
				alert("fout met coordinaten");
			}
			return false;
		});
		
		mapPDOKKaart.addControls(controls);
		// only set the map center if not already done by lusc api
		if (!mapPDOKKaart.getCenter()) {
		 	mapPDOKKaart.setCenter(new OpenLayers.LonLat(155000,463000), 3);
		}
    }
}


/****
    * For Proof of Concept only use some simple functions to perform searches. For advanced / full functionality: see Geozet and include / build on (Geo)Ext
 	*/

var gazetteerConfig = {};
var zoomScale = {
    adres: 11,
    postcode: 10,
    plaats: 8,
    gemeente: 8,
    provincie: 5,
    standaard: 9
};
gazetteerConfig.gazetteer = {url:"http://geodata.nationaalgeoregister.nl/geocoder/Geocoder?", param:"zoekterm", zoomScale: zoomScale};

// Thijs: code based on Geozet.widgets.Search
function searchLocationChanged() {
	var searchString = jQuery("#searchLocation").val();
    var params = {request: 'geocode'};
    params[gazetteerConfig.gazetteer.param] = searchString;
    if (searchString && searchString.length>0){            
        OpenLayers.Request.GET({
            url: gazetteerConfig.gazetteer.url,
            params: params,
            scope: this,
            success: handleGeocodeResponse
            // failure: this.handleError
        });
    }
    return false;
}

/** Thijs: code based on Geozet.widgets.Search
	 * params: 
	 *	req = the OpenLayers request
	 *	returnCoords - Boolean if False or None map will be zoomed/panned
     *  if True map will not change, but coordinates will be returned
     * 
     * Returns:
     * {OpenLayers.LonLat} - if returnCoords == True  one hit/result 
     * Boolean - if other == False OR more or no results
	**/ 

function handleGeocodeResponse(req, returnCoords){
    markers.destroyFeatures();
    $('#searchResults').html('').show();
    
    var responseText = req.responseText;
    if (responseText && (responseText.indexOf('FAILED') != -1 ||
        responseText.indexOf('Exception') != -1 )) {
        // fail silently
        return false;
    }
    var xlslusFormat = new Geozet.Format.XLSLUS();
    var xlslus = xlslusFormat.read(req.responseXML || req.responseText);
    var hits=xlslus[0].numberOfGeocodedAddresses;
    // alert(hits.length);
    if (hits==0){
        // zero responses
        this.showError(OpenLayers.i18n("noLocationFound"));
    }
    else{
		var maxEx = mapPDOKKaart.restrictedExtent;
		// minx,miny,maxx,maxy are used to calcultate a bbox of the geocoding results
		// initializes these with the max/min values of the extent of the map, so swap the left /right and bottomo/top of the maxExtent
		// i.e.: the calculate minx will allways be smaller than the right-border of the map;
		// TODO: use the map's restricted Extent, so change to Lucs API
		/// For now: just values
		maxEx = new OpenLayers.Bounds(-285401.92, 22598.08, 595401.92, 903401.92);
		var minx = maxEx.right;
		var miny = maxEx.top;
		var maxx = maxEx.left;
		var maxy = maxEx.bottom;
		var minzoom = 15;
		var features = [];
        // > 0 hit show suggestions        
        if(hits>0){
            $('#searchResults').html('<span class="searchedFor">Gezocht op: "'+jQuery("#searchLocation").val()+'"</span><h3 class="geozetSuggestions">Zoekresultaten:</h3><a href="#" onclick="$(\'#searchResults\').hide();return false;">Sluiten</a><ul class="geozetSuggestions"></ul>');
        }
        for (i=0;i<hits;i++){
            var suggestion='';
            var geom = xlslus[0].features[i].geometry;
            var address = xlslus[0].features[i].attributes.address;                 
            var plaats = address.place.MunicipalitySubdivision; // toont evt provincie afkorting
            var gemeente = address.place.Municipality;
            var prov = address.place.CountrySubdivision;
            var adres = '';
            var postcode = '';
            var hash = "";
            // determine zoom and hash
            var zoom = null;
            if (address.street && address.street.length>0){
                adres = address.street + ' - ' ;
                hash += "/straat/"+ encodeURIComponent(address.street);
                if (address.building){
                    var toevoeging = '';
                    if (address.building.subdivision){
                        toevoeging = address.building.subdivision
                    }
                    adres += address.building.number+toevoeging+' - ';
                    hash  += "/huisnummer/"+encodeURIComponent(address.building.number);
                    hash  += "/toevoeging/"+encodeURIComponent(toevoeging);
                }
                if(!zoom){zoom='adres'}
            }
            if (address.postalCode){
                adres += address.postalCode+' - ';
                hash = "/postcode/"+encodeURIComponent(address.postalCode)+hash;
                if(!zoom){zoom='postcode'}
            }
            if(plaats){
                suggestion=adres+plaats+' (plaats)';
                if(!zoom){zoom='plaats'}
            }
            else if(gemeente){
                suggestion=adres+gemeente+' (gemeente)';
                if(!zoom){zoom='gemeente'}
            }
            else if(prov){
                suggestion=prov+' (provincie)';
                if(!zoom){zoom='provincie'}
            }
            if(!zoom){zoom='standaard'}
            // for hash
            if(plaats){
                hash = "/plaats/"+encodeURIComponent(plaats)+hash;
            }
            if(gemeente){
                hash = "/gemeente/"+encodeURIComponent(gemeente)+hash;
            }
            if(prov){
                hash = "/provincie/"+encodeURIComponent(prov)+hash;
            }
            if(hits>0){
                // hack to be able to handle results without geom
                var x = geom?geom.x:150000;
                var y = geom?geom.y:450000;
                var z = geom?gazetteerConfig.gazetteer.zoomScale[zoom]:gazetteerConfig.gazetteer.zoomScale['provincie'];
				var gazHtml = '<li><a href="#">('+(i+1) + ") " + suggestion+' <span class="hash">'+hash+'</span>'+' <span class="x">'+x+'</span> <span class="y">'+y+'</span> <span class="z">'+z+'</span></a></li>';
            
                $("ul.geozetSuggestions").append(gazHtml);
                // Thijs: added calculation for bbox
                // only calulate if a geom is provided
                if (geom) {
                	minx = Math.min(minx, x);
                	miny = Math.min(miny, y);
                	maxx = Math.max(maxx, x);
                	maxy = Math.max(maxy, y);
                	minzoom = Math.min(minzoom, gazetteerConfig.gazetteer.zoomScale[zoom]);
					features.push(new OpenLayers.Feature.Vector( new OpenLayers.Geometry.Point(x, y), {"title": suggestion, "postcode": postcode, "adres": adres, "plaats": plaats, "gemeente": gemeente, "provincie": prov},
							{externalGraphic: 'js/img/marker.png', graphicHeight: 26, graphicWidth: 20}));
                }                
                // set (calculated) height for the result div
                /* var height = Math.max(Ext.get('geozetAside').getHeight(), Ext.get('geozetArticle').getHeight());
                Ext.get(this.contentWrapperId).setHeight(height); */
            }
            else{
                // hack to be able to handle results without geom
                var x = geom?geom.x:150000;
                var y = geom?geom.y:450000;
                var z = geom?gazetteerConfig.gazetteer.zoomScale[zoom]:gazetteerConfig.gazetteer.zoomScale['provincie'];
                mapPDOKKaart.setCenter(new OpenLayers.LonLat(x, y), z);
                if (returnCoords === true) {
                    return {
                        center: new OpenLayers.LonLat(x, y),
                        zoom: z
                    };
                } 
                else 
                {
                    mapPDOKKaart.setCenter(new OpenLayers.LonLat(x, y), z);
                    // document.location.hash=hash;
                }
            }
        }
        $("ul.geozetSuggestions").show();
        // calculate the new bbox, if hits > 0
        if (hits > 0) {
	        // first calculate the center of the new bbox	        
	        var newBounds = new OpenLayers.Bounds([minx, miny, maxx, maxy]);
			// compare the zoomlevels of the extent and the calulated zoomlevel, to make sure all results are fetched.
			var minzoom = Math.min(mapPDOKKaart.getZoomForExtent(newBounds), minzoom);
	        // now use the lowest zoomlevel for all results, to make sure that not so fine locations (like provinces) are contained as well
	        mapPDOKKaart.setCenter(newBounds.getCenterLonLat(), minzoom);
        }
		markers.addFeatures(features);
    }
    return false;
}

function linkToMapOpened(permalink){
	// Thijs: TODO: change the permalink URL: add params, create a function for that.
	/* ** API params to use:
	loc = x,y
	zl = zoomlevel
	marker = x,y
	<pm>	
	*/
	// add the parameters, serialize them just quick and dirty now
	var apiParams = "&loc=" + mapPDOKKaart.getCenter().lon + "," +mapPDOKKaart.getCenter().lat;
	apiParams += "&zl=" + mapPDOKKaart.getZoom();

	// Thijs: TODO: use OL functions for merging parameters?
	permalink = permalink.replace("#","");
	permalink += "?"+apiParams;
	$("#emaillink").val(permalink);

	// construct the URL, make sure the correct page is used
    var embedLink = permalink.replace("/?","/api/api.html?");
    var embedLink = permalink.replace("/index.html?","/api/api.html?");
    
	//var embedLink = permalink.("index.html")[0] + "api/api.html?" + apiParams;
	
	var embedHtmlIframe = "<iframe width='425' height='350' frameborder='0' scrolling='no' marginheight='0' marginwidth='0' src='"+embedLink+"' title='PDOK Maps'></iframe><br /><small>PDOK Maps: <a href='"+permalink+"' style='color:#0000FF;text-align:left'>Grotere kaart weergeven</a></small>"

	$("#embedhtmliframe").val(embedHtmlIframe);
	
	// <object width="400" height="400" data="helloworld.swf"></object> 
	var embedHtmlObject = "<object width='425' height='350' codetype='text/html' data='"+embedLink+"' title='PDOK Maps'></object><br /><small>PDOK Maps: <a href='"+permalink+"' style='color:#0000FF;text-align:left'>Grotere kaart weergeven</a></small>"
	
	$("#embedhtmlobject").val(embedHtmlObject);
	return false;
}

function onPopupClose(evt, feature) {
	if (!feature) feature = activeFeature;
	if (feature) {
		mapPDOKKaart.removePopup(feature.popup);
		feature.popup.destroy();
		feature.popup = null;
	    	feature.renderIntent='default';
		feature.layer.drawFeature(feature);
		// mapPDOKKaart.panTo(previousCenter);
	}
}

function onFeatureSelect(feature, full, text) {
	removePopups(feature.layer);
	activeFeature = feature;
	// var text = '';
	var popupSize;
	var className="";
	var popupCloseButton = false;
	var border = 2;
	if (full) {
		popupSize = new OpenLayers.Size(200, 120);
		popupCloseButton = true;		
	} else {
		popupSize = new OpenLayers.Size(200, 60);
		border = 1;
	}
	popup = new OpenLayers.Popup(feature.attributes.title, 
		             feature.geometry.getBounds().getCenterLonLat(),
		             popupSize,
		             text,
		             popupCloseButton, onPopupClose);
	feature.popup = popup;
	feature.renderIntent='select';
	feature.layer.drawFeature(feature);
    popup.setBorder("1px solid #888888");
	popup.setOpacity(1.0);
	popup.autoSize = true;
	// popup.closeOnMove = true;
	if (full) {
	    popup.panMapIfOutOfView = true;
	} else {
	    popup.panMapIfOutOfView = false;
	}	    
	mapPDOKKaart.addPopup(popup);
}

function markersPopupText(feature, full) {
	var className = "popupTitleSummary";
	var text="";
	if (full) {
		className="popupTitleFull";
	}

    var ft = feature;
    text += "<div id='popupcontent_"+ft.id+"'><h4 class='"+className+"'>"+ft.attributes.title + "</h4>";
    if(full){
	    text += "<div>Adres:<br/>" ;
	    text += ft.attributes.adres;
	    text += "<br/>" + ft.attributes.postcode + " " + ft.attributes.plaats +"<br/>";
	    text += "Gemeente: " + ft.attributes.gemeente + "<br/>";
	    text += "Provincie: " + ft.attributes.provincie + "<br/>";
    }
    text+="</div></div>";
	return text;
}

function removePopups(layer) {
	for (var i=0;i<layer.features.length;i++) {
		var ft = layer.features[i];
		if (ft.popup!=null) {
			// close the popup first
			mapPDOKKaart.removePopup(ft.popup);
			ft.renderIntent='default';
			ft.layer.drawFeature(ft);
			ft.popup.destroy();
			ft.popup = null;
		}
	}
}

/** GUI functions **/
function setMapSize() {
    var wW=jQuery(window).width();
    var wH=jQuery(window).height();
    jQuery("#container").width(wW);
    jQuery("#container").height(wH);
    
    jQuery("#content").width(wW-10);
    jQuery("#content").height(wH-105);
    jQuery("#map").width(wW-362);    
}

function addFormEnhancements(){
    // remove default values if focus is set
    /* jQuery("input[type|='text']").each(function(index, element) {
            var defaultValue = jQuery(this).val();
            // or use another default?
            if (jQuery(this).id=="atomFeedUrl") defaultValue="URL van een Atom feed";
            jQuery(this).focus(function(){
                if (this.value == defaultValue) {this.value = ''}
            });
            jQuery(this).blur(function(){
                if (this.value=='') {this.value = defaultValue}
            });
        }
    ); */
	// Add select to all text fields
	$("#createlink input[type=text]").focus(function(){
		// Select field contents
		this.select();
	});
	$("#createlink input[type=text]").click(function(){
		// Select field contents
		this.select();
	});
}
