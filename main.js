// main.js, author: Anna Young, Nov 2014

// Appearance variables

var NBINS = 10; // Amount of color bins
var NACOLOR = "#999"; // Color of countries with no data
var HIGHLIGHT_COLOR = "#FFF"; // Color of highlighted (clicked) countries


var polygons = [];
var polygonsHighlighted = [];


window.onload = main;

function prepareClickGeometry(map, layer) {

	var style = {
		weight: 2,
		opacity: 1,
		color: HIGHLIGHT_COLOR,
		fillOpacity: 0
	};

	// fetch the geometry
	var sql = new cartodb.SQL({ user: 'diegoalbertotorres', format: 'geojson' });
	sql.execute("select * from waste").done(function(geojson) {
		var features = geojson.features;
		for(var i = 0; i < features.length; ++i) {
			var f = features[i];
			var key = f.properties.cartodb_id;

			// generate geometry
			if (f.geometry != null) {
				var geo = L.GeoJSON.geometryToLayer(f.geometry);
				geo.setStyle(style);


				// add to polygons
				if (!polygons[key]) polygons[key] = [];
				polygons[key].push(geo);
			}
		}
	});
};

function addMarker(map, coordinates, name) {
  var geojsonFeature = {
    "type": "Feature",
    "properties": {
      "name": name,

    },
    "geometry": {
      "type": "Point",
      "coordinates": coordinates
    }
  };

  L.geoJson(geojsonFeature).addTo(map);

}

function updateInfo(props) {
	var infoPanel = $("#map-info");
	//~console.log($(infoPanel)[0]);
	
	var infoBreakdown = "",
		name = "-",
		cxn = "-",
		waste = "-",
		wastecxn = "-";

	$(infoPanel).find(".breakData").each(function(){
		if (($(this).css("opacity") != 1) && ($(this).attr("fadingOut") === undefined)){
			// Remove everything that is trying to fade in
			//~$(this).remove();
			$(this).stop().fadeTo('slow', 0, function() { $(this).remove(); });
		}
		else if ($(this).css("opacity") == 1 && ($(this).attr("fadingOut") === undefined)){
			// Fade out established element
			$(this).attr("fadingOut", "true");
			$(this).fadeOut(700, function() { $(this).remove(); });
		}
	});
	if (props){
		if (props["country"] != undefined){
			name = props["country"];
			if (props["waste_2014"] == undefined || props["waste_2014"] == -9999){
				cxn = "No data";
				waste = "No data";
				wastecxn = "No data";
			}
			else{
				cxn = props["cxn_2014"];
				waste = props["waste_2014"];
				wastecxn = props.val;
			}
		}
	}
		
	var dataCountry = "<div class=breakData id=dataCountry> <span>" + name + "</span> </div>";
	var dataWaste = "<div class=breakData id=dataWaste> <span>" + waste + "</span> </div>";
	var dataCXN = "<div class=breakData id=dataCXN> <span>" + cxn + "</span> </div>";
	var dataWasteCXN = "<div class=breakData id=dataWasteCXN> <span>" + wastecxn + "</span> </div>";
	
	// Try to fade in newly hovered country
	$(dataCountry).hide().insertAfter("#breakCountry").fadeIn(700);
	$(dataWaste).hide().insertAfter("#breakWaste").fadeIn(700);
	$(dataCXN).hide().insertAfter("#breakCXN").fadeIn(700);
	$(dataWasteCXN).hide().insertAfter("#breakWasteCXN").fadeIn(700);
};

function main() {
	var map = new L.Map('map', { 
		zoomControl: true,
		legend: true,
		center: [42,0],
		zoom: 2,
		scrollWheelZoom: true,
		maxZoom: 12
	});
	
	// Position infobox
	$(window).resize(function() {
		placeLayerSelector();
	});

	// create layers
	cartodb.createLayer(map, {
		user_name: 'diegoalbertotorres',
		type: 'cartodb',
		sublayers: [{
			sql: "SELECT * FROM waste_data",
			cartocss: makeCartoCSS('waste_2014'),
			interactivity: "the_geom, cartodb_id, country, waste_2014, cxn_2014"
			},
			{
			sql: "SELECT * FROM bathymetry_layers",
			cartocss: "#bathymetry_layers{ polygon-fill: #002C3F; polygon-opacity: 0.4; line-color: #FFF; line-width: 0; line-opacity: 1;}"
			}
		]
	}).done(function(layer) {
		// add the layers to map 
		map.addLayer(layer);
		sublayer_country = layer.getSubLayer(0);
		sublayer_country.setInteraction(true);
		createSelector(layer);

		// Create infowindow
		sublayer_country.infowindow.set('template', $('#infowindow_template').html());
		
		placeLayerSelector();

		prepareClickGeometry(map, sublayer_country);

		// Search Widget
		var v = cartodb.vis.Overlay.create('search', map.viz, {});
		// Wanted to use this to have search highlight result
		//~v.el.onchange = function(e) { console.log(e.feature); };
		v.show();
		$('#map').append(v.render().el);

		//Make country Tool-tip follow the mouse.
		var event = function(e){
			$('#country-hover').css({
				left: e.pageX,
				top:   e.pageY
			});
		};
		$(document).bind('mousemove', event);

		function featureOver (e, pos, latlng, data) {
			
			for(var i = 1; i <= 4; ++i){
				var dat = "";
				
				if (i == 1){
					dat = data["country"];
					var current = $("#hover-value1").first();
					if (dat == current.html())
						return;
				}
				else if (i == 2)
					dat = "?/100";
				else if (i == 3)
					dat = data["waste_2014"];
				else if (i == 4)
					dat = data["cxn_2014"];
				
				var html = "<div id=\"hover-value" + i + "\">" + dat + "</div>";
				$("#hover-value" + i).remove();
				$(html).insertAfter("#hover-header" + i);
				$("#hover-value" + i).first().toggleClass("on");
			}
			
			
			$('#country-hover').show();
		}

		function featureOut (e, pos, latlng, data) {
			$('#country-hover').hide();
		}

		function featureClick (e, pos, latlng, data) {
			var pol = polygonsHighlighted;
			
			for(var i = 0; i < pol.length; ++i)
				map.removeLayer(pol[i]);
				
			polygonsHighlighted = [];
			
			// highlight country
			var pol = polygons[data.cartodb_id] || [];
			
			for(var i = 0; i < pol.length; ++i) {
				var new_layer = pol[i];
				map.addLayer(new_layer);
				polygonsHighlighted.push(pol[i]);
			}
			
			updateInfo(data);
		  
			// Add glow filter
			//~var filterHTML = "<defs> <filter id=\"glow\"> <feGaussianBlur stdDeviation=\"2.5\" result=\"coloredBlur\"/> <feMerge> <feMergeNode in=\"coloredBlur\"/> <feMergeNode in=\"SourceGraphic\"/> </feMerge> </filter> </defs>";
			//~$(".leaflet-zoom-animated").prepend(filterHTML);
			$(".leaflet-zoom-animated > g > path").each(function() { 
				$(this).attr("filter", "url(./resources.svg#glow)"); 
			});
		};
		// Show country name and score when hovering
		sublayer_country.on('featureOver', featureOver);
		sublayer_country.on('featureOut', featureOut);
		sublayer_country.on('featureClick', featureClick);
	});
}

function placeLayerSelector(){
	$("#layer_selector").each(function(){
		$(this).css("top", $("#map").height() - ($(this).height() * 2));
		$(this).css("left", ($("#map").width() - $(this).width()) / 2);
	});
}

function createSelector(layer) {
	var $options = $('#layer_selector li');
	$options.click(function(e) {
		// get the area of the selected layer
		var $li = $(e.target);
		var name = $li.attr('data');

		// deselect all and select the clicked one
		$options.removeClass('selected');
		$li.addClass('selected');

		//~var style = $("#" + name + "_css").html().format(name + "_2014");
		style = makeCartoCSS(name + "_2014");
		layer.setCartoCSS(style);

		$(".cartodb-legend:nth-child(1)").show();
	}); 
}

function makeCartoCSS(columnName){
	var css = $("#cartocss").html().format(columnName);
	
	console.log(columnName);
	var hue = 100;
	if (columnName == "waste_2014")
		hue = 200;
	else if (columnName == "cxn_2014")
		hue = 100;
	
	$(".colors").empty();
	for (var i = 0; i <= NBINS; i++){
		var val = 100 - (i * (100 / NBINS));
		var col = colorPal(val, hue);
		//~console.log(col);
		css += "#water [ " + columnName + " <= " + val + "] {\n\t" 
		css += "polygon-fill: " + col + ";\n"
		css += "}\n";
		
		// Add legend
		var newLegendColor = document.createElement("div");
		$(newLegendColor).css("background-color", col);
		$(".colors").prepend(newLegendColor);
	}
	
	css += "#water [ " + columnName + " < 0 ] {\n\t"
	css += "polygon-fill: #222222;\n"
	css += "}\n"
	
	//~console.log(css);
	return css;
}

// Given a value (%) a size and an offset, gives
// the color corresponding to val in the range (at offset, of size).
function colorPal(val, hue){
	// For NA vals
	if (val == -9999) return NACOLOR;
	
	// Base color, set initial sat and lum here
	var col = { h: hue, s: 80, l: 0 };
	
	col.l = 15 + (val * 0.70);
	
	return tinycolor(col).toHexString();
}

//Formats the columns for us into css
String.prototype.format = (function (i, safe, arg) {
  function format() {
      var str = this,
          len = arguments.length + 1;

      for (i = 0; i < len; arg = arguments[i++]) {
          safe = typeof arg === 'object' ? JSON.stringify(arg) : arg;
          str = str.replace(RegExp('\\{' + (i - 1) + '\\}', 'g'), safe);
      }
      return str;
  }
  return format;
})();
