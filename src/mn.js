
function MonadicNomad() {

	this.baseurl = "";

	this.filtered = "";
	this.selected = -1;
	this.query = "";

	this.hash = window.location.hash.substr(1);

	this.nodes = [];
	this.Nodes = {};
	this.spreads = {};

	this.valmin = {};
	this.valmax = {};
	this.valsum = {};

	this.resizeTimeout = null;
	this.peekTimeout = null;
	this.timeouts = [];

	// get data
	this.load = function() {
		var that = this;

		var file = app.dataFile.split(".");
		var type = file.pop().toLowerCase();

		if (type=="csv") jQuery.get("app/"+app.dataFile, function(data){

			data = $.parse(data);

			var rows = data.results.rows;
			var data = [];

			for (var i = 0; i < rows.length; i++) {
				var links = rows[i].links.trim().split(" ");
				var linksA = [];
				for (var j = 0; j < links.length; j++) {
					var linkid = parseInt(links[j]);
					if (!isNaN(linkid)) linksA.push(linkid);
				}
				rows[i].links = linksA;
				if (rows[i].id!="") data.push(rows[i]);
			}

			that.init(data);
		});
		else if (type=="json") jQuery.getJSON("app/"+app.dataFile, function(data){
			that.init(data);
		});
		else if (type=="js")  jQuery.getScript("app/"+app.dataFile, function(){
			console.log("js")
			that.init(data);
		});

	}

	// set up variables
	this.init = function(data) {

		var that = this;

		// set style from config.js
		var style = document.createElement('style');
		style.type = 'text/css';

		var styles = "";

		function hexToRgb(hex) {
		    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		    return result ? [
					parseInt(result[1], 16),
					parseInt(result[2], 16),
					parseInt(result[3], 16)
		    ] : [0,0,0];
		}

		// color styles
		for (var i = 0; i < app.node_types.length; i++) {
			var type = app.node_types[i].slug;
			var img = new Image();
			img.src = "app/img/"+type+".png";

			var rgb = hexToRgb(app.node_types[i].color);

			var color = app.node_types[i].color;
			var color1 = "rgba("+rgb.join(",")+",.25)";
			var color3 = "rgba("+rgb.join(",")+",.25)";
			var color7 = "rgba("+rgb.join(",")+",.75)";

			styles += ".sheet."+type+" header	{ background-image: url('app/img/"+type+".png'); }\n";

			styles += "."+type+" header	{ background-color: "+color3+"; }\n";
			styles += ".sheet.shown."+type+" header	{ background-color: "+color+"; }\n";

			styles += "."+type+" h1 a		{ color: "+color+"; }\n";
			styles += "."+type+" header em		{ color: "+color+"; }\n";
			styles += "div.sheet.shown."+type+" h1		{ color: "+color+" !important; }\n";

			styles += ".linked."+type+" header { background-color: "+color7+" !important; }\n";

			styles += ".shown."+type+" header { background-color: "+color3+"; }\n";
			styles += ".shown."+type+" h1 { color: "+color3+"; }\n";

			styles += ".hover."+type+" header { background-color: "+color+" !important; }\n";
			styles += ".hover."+type+" h1 { color: "+color+"; }\n";

			styles += ".node.brush."+type+" h1 a { background-color: "+color3+"; }\n";
			styles += ".node.brush."+type+" h1 { color: "+color7+"; }\n";

			styles += ".node.brush.linked."+type+" h1 a { background-color: "+color3+"; }\n";
			styles += ".node.brush.linked."+type+" h1 { color: "+color+"; }\n";

			styles += ".node.shown.blur."+type+" h1 { color: "+color3+"; }\n";

			styles += "#info li#t"+i+".brush a { background-color: "+color3+"; }\n";
		}

		style.innerHTML = styles;
		document.getElementsByTagName('head')[0].appendChild(style);


		// set base URL
		this.baseurl = document.URL.split("#")[0];

		$(window).resize(function(){
			window.clearTimeout(that.resizeTimeout);
			that.resizeTimeout = window.setTimeout(function(){
				// window.clearTimeout(that.resizeTimeout);
				that.setWindow();
				that.elements();
				that.draw();
			}, 250);
		});

		// hash change / history
		setInterval(function(){

			var newhash = window.location.hash.substr(1);

			if (that.hash!=newhash) {

				that.hash = newhash;

				// draw or zoom?
				var walk = false;
				var zoom = false;

				// var mode = parseInt(hashA[0]);
				var hashA = that.hash.split(":");
				var id = hashA[0];
				var filtered = hashA[1];
				
				if (typeof that.Nodes[ id ] === "undefined") id = -1;

				if (filtered.length !== app.node_types.length) {
					filtered = "";
					for (var i = 0; i < app.node_types.length; i++) filtered = filtered + "0";					
				}

				if (filtered!=that.filtered) {
					that.filtered = filtered;
					that.filter();
				}

				if (id!=that.selected) that.walk(id);				

			}
		}, 500);

		// search typing
		$("#search").keyup(function(){

			that.query = $("#search").val();

			if (that.selected==-1) {

				// calculate relevance values
				that.spreads['-2'] = {};
				that.valmax['-2'] = 0;
				that.valmin['-2'] = 1000;

				var terms = that.query.split(" ");

				for (var i=0; i < that.nodes.length; i+=1) {
					var node = that.nodes[i];
					var texts = [node.title, node.text];
					var text = texts.join(" ");

					var count = 0;
					for (var j=0; j < terms.length; j+=1) {
						if (terms[j]!="") {
							var matches = text.match(RegExp(terms[j], "gi"));
							if (matches!=null) count+=matches.length;
						}
					}

					that.valmax['-2'] = Math.max(that.valmax['-2'], count);
          that.valmin['-2'] = Math.min(that.valmin['-2'], count);

					that.spreads['-2'][node.id] = count;
				}

				that.draw();
			}

		});

		// cancel current selection
		$("#canvas").click(function(){ that.walk(-1); });

		// escape press
		$(window).keydown(function(e){
			if (e.keyCode==27) {

				if ($("#search").is(":focus")) {
					$("#search").blur();
					that.query="";
					$("#search").val("");
				}
				else $("#search").focus()

				that.walk(-1);
			}
		});

		this.process(data);

		// hash and history
		if (this.hash=="") {
			this.selected = -1;
			
			this.filtered = "";
			for (var i = 0; i < app.node_types.length; i++) this.filtered = this.filtered + "0";				
			
		}
		else {
			var hashA = this.hash.split(":");
			
			var id = hashA[0];
			var filtered = hashA[1];
			
			if (typeof this.Nodes[id] !== "undefined") this.selected = id;
			else this.selected = -1;

			if (filtered.length==app.node_types.length) this.filtered = filtered;
			else {
				this.filtered = "";
				for (var i = 0; i < app.node_types.length; i++) this.filtered = this.filtered + "0";				
			}
		}

		// fill legend
		var projectlink = "<span>a <a href='http://mariandoerk.de/monadicexploration/'>monadic exploration</a> of</span><br>";
		$("#info h1").append(projectlink+"<a href='"+app.url+"'>"+app.title+"</a>");
		if (app.showType) {
			for (var i = 0; i < app.node_types.length; i++) {
				var type = app.node_types[i];			
				$("#info ul").append("<li id='t"+i+"'><span>•</span><a>"+type.names+"</a></li>");
				$("#info li#t"+i).css({color: type.color});
					
				if (that.filtered.charAt(i)=="1") $("#info li#t"+i).addClass("filtered");
				
				$("#info li#t"+i).click(function(){
					var id = parseInt($(this).attr("id").split("t")[1]);
					var newfiltered = "";					
					for (var i = 0; i < that.filtered.length; i++) {
						if (i==id) {
							if (that.filtered.charAt(id)=="1") newfiltered = newfiltered + "0";
							else newfiltered = newfiltered + "1";							
						}
						else newfiltered = newfiltered + that.filtered[i];
					}
					that.filtered = newfiltered;					
					that.filter();
				});
			}
		}

		if (this.selected==-1) $("#search").focus();

		this.setWindow();
		this.elements();
		this.draw();
	}

	// font and window sizing
	this.setWindow = function() {
		var that = this;

		// sizing constants
		var winside = Math.min($(window).width(), $(window).height());

		this.fs = 5+Math.round(winside/75);
		this.s = Math.round(winside/100);
		this.r = Math.round(winside/5);

		this.w = $(window).width();
		this.h = $(window).height();
		this.h_ = $(document).height();

		// history
		if (this.selected==-1) this.hash = "-1:"+this.filtered;
		else this.hash = this.selected+":"+this.filtered;
		
		window.location.hash = "#"+this.hash;

		// window title
		var name = "Monadic Exploration";
		if (typeof this.Nodes[this.selected] !== "undefined") name = this.Nodes[this.selected].title;
		document.title = name;

		// overlays
		$("#hint").css({width: this.r, height: this.fs*3, top: this.h/2-this.fs, left: this.w/2-this.r/2, 'font-size': this.fs*1.25});

		// show hint if no node is selected, and in mode 1
		if (this.selected==-1) $("#hint").addClass("active");		
		else $("#hint").removeClass("active");

		// legend
		$("#info li").css({fontSize: this.fs*.9});
		$("#info h1").css({fontSize: this.fs*1.1});
		$("#info h1 span").css({fontSize: this.fs*.9});

		var w = $("nav #modes").width();
		$("#modes").css({left: Math.round(this.w/2 - w/2) });

		if (this.selected==-1) $("#mn_article").unbind().addClass("inactive");
		else $("#mn_article").removeClass("inactive");
	}

	// calculate spreads
	this.process = function(nodes) {
		var that = this;

		// set spread values, null ~ no id selected
		this.valmin = {'-1': 100000};
		this.valmax = {'-1': 0};
		this.valsum = {'-1': 0};
		this.spreads['-1'] = {};

		// make Nodes object
		for (var i=0; i < nodes.length; i+=1) {
			var node = nodes[i];

			node.color = app.node_types[node.type].color;
			node.type_text = app.node_types[node.type].name;

			node.deg = node.links.length;
			
			this.valmin['-1'] = Math.min(this.valmin['-1'], node.deg);
			this.valmax['-1'] = Math.max(this.valmax['-1'], node.deg);
			this.valsum['-1'] += node.deg;
			this.spreads['-1'][node.id] = node.deg;

			this.nodes.push(node);
			this.Nodes[node.id] = node;
			this.spreads[node.id] = {};
		}

		// generate spreads object
		for (var i = 0; i < nodes.length; i++) {
			for (var j = 0; j < nodes.length; j++) {
				if (i!=j) this.spreads[nodes[i].id][nodes[j].id] = 0;
			}
		}

		// remove ids that do not exist
		for (var i = 0; i < this.nodes.length; i++) {
			var actuallinks = [];
			for (var l = 0; l < this.nodes[i].links.length; l++) {
				if (typeof this.Nodes[this.nodes[i].links[l]] !== "undefined") actuallinks.push( this.nodes[i].links[l] );
			}
			this.nodes[i].links = actuallinks;
		}

		// mirror links
		for (var i = 0; i < this.nodes.length; i++) {
			var id = this.nodes[i].id;
			for (var j = 0; j < this.nodes[i].links.length; j++) {
				var id2 = this.nodes[i].links[j];
				if (this.Nodes[id2].links.indexOf(id)==-1) this.Nodes[id2].links.push(id);
			}
		}

		// spread the spread
		var weights = [1,.1,.01];
		for (var i = 0; i < nodes.length; i++) {
			var id1 = nodes[i].id;
			for (var j = 0; j < this.nodes[i].links.length; j++) {
				var id2 = this.nodes[i].links[j];
				this.spreads[id1][id2] += weights[0];

				for (var k = 0; k < this.Nodes[id2].links.length; k++) {
					var id3 = this.Nodes[id2].links[k];
					if (id1==id3) continue;
					this.spreads[id1][id3] += weights[1];

					for (var l = 0; l < this.Nodes[id3].links.length; l++) {
						var id4 = this.Nodes[id3].links[l];
						if (id1==id4 || id2==id4) continue;
						this.spreads[id1][id4] += weights[2];
					}
				}
			}
		}

		// round spreads, get max and min
		for (var i = 0; i < nodes.length; i++) {
			var id1 = nodes[i].id;

			this.valmin[id1] = 100000;
			this.valmax[id1] = 0;
			this.valsum[id1] = 0;

			for (var j = 0; j < nodes.length; j++) {
				if (i!=j) {
					var id2 = nodes[j].id;
					this.spreads[id1][id2] = Math.round(100*this.spreads[id1][id2])/100;
					var val = this.spreads[id1][id2]

					this.valmin[id1] = Math.min(this.valmin[id1], val);
					this.valmax[id1] = Math.max(this.valmax[id1], val);
					this.valsum[id1] += val;
				}
			}
		}

		this.nodes.sort(function(a, b){

			if (a.type<b.type) return -1;
			else if (a.type>b.type) return 1;
			else {
				if (a.title<b.title) return -1
				else return 1;
			}

		});

	}

	// mapping function
	this.interval = function(x, xmin, xmax, ymin, ymax, bound, log) {
		// make sure return value is withiin ymin and ymax
		if (typeof bound === "undefined") bound = false;
		if (typeof log === "undefined") log = false;

		if (xmin == xmax) return ymax;

		var y, m, n;

		if (log) {
			var logxmax = Math.log(xmax+1);
			var logxmin = Math.log(xmin+1);
			m           = ( ymax / logxmax - ymin) / (1 - logxmin );
			n           = ymin - m*logxmin;
			y           = m * Math.log(x+1) + n;
		}
		else {
			m           = (ymax - ymin) / (xmax - xmin);
			n           = -xmin * m + ymin;
			y           = x * m + n;
		}

		if (bound) {
			if (ymin<ymax) {
				y          = Math.min(ymax, y);
				y          = Math.max(ymin, y);
			}
			else {
				y          = Math.max(ymax, y);
				y          = Math.min(ymin, y);
			}
		}

		return y;
	}

	// select items
	this.walk = function(id) {
		var that = this;
		window.scrollTo(0, 0);
		
		if (this.selected==id) id = -1;
		
		this.selected = id;

		if (typeof id === "undefined") id = this.selected;
		else this.selected = id;

		$(".hover").removeClass("hover");

		this.setWindow();

		// delayed background removal
		clearTimeout(this.peekTimeout);
		this.peekTimeout = setTimeout(function(){
			$(".brush").removeClass("brush");
			$(".blur").removeClass("blur");
		}, 2000);

		this.draw();
	}

	// hover over element
	this.peek = function(id, start) {

		$(".noani").removeClass("noani");

		// ignore staged elements
		if (id.substr(0,1)=="_") return;

		clearTimeout(this.peekTimeout);

		$(".hover").removeClass("hover");

		if (start) {
			$(".brush").removeClass("brush");
			$(".blur").removeClass("blur");
		}
		else {
			$(".brush").removeClass("brush");
			$(".blur").removeClass("blur");
		}

		if (this.selected==id) {
			return;
		}

		var node = this.Nodes[id];

		if (typeof id !== "undefined" && start) {
			
			$("#info li#t"+node.type).addClass("brush");
			
			$("#n"+id).addClass("hover");

			if (typeof node !== "undefined") {

				for (var i=0; i < this.nodes.length; i+=1) {
					var node2 = this.nodes[i];
					var id2 = node2.id;
					if (node.links.indexOf(id2)>-1) $("#n"+id2).addClass("brush");
					else if (node2.shown && id!=id2) $("#n"+id2).addClass("blur");
				}
			}
		}
	}

	// append elements, get sizes
	this.elements = function() {
		var that = this;

		function shorten(str, len, ellipsis) {
			if (typeof ellipsis === "undefined") ellipsis = '...';
			str = str+"";
			var len_ = str.indexOf(" ", len);
			if (len_>0) len = len_;
			else len = str.length;

			if (str.length>len) return str.substr(0, len)+ellipsis;
			else return str;
		}

		// draw circles
		for (var i=0; i < this.nodes.length; i+=1) {
			var node = this.nodes[i];

			if (typeof node.css === "undefined") node.css = {};
			var id = node.id;

			// remove filtered element
			if (this.isFiltered(node)) {
				if ($("#n"+id).length>0) {
					$("#n"+id).remove(); 
					$("#n_"+id).remove();
				}
			}
			// insert element
			else if ($("#n"+id).length==0) {

				var text = shorten(node.text, 200, "");
				
				if (typeof node.url === 'undefined' || node.url=='') {
					var h1 = "<h1><a>"+shorten(node.title, 50)+"</a></h1>";
					var h2 = "<h2>"+text+" …</h2>";
				}
				else {
					var h1 = "<h1><a href='"+node.url+"'>"+shorten(node.title, 50)+"</a></h1>";
					var h2 = "<h2>"+text+" …</h2>";
				}

				var type_slug = app.node_types[node.type].slug;
				var type_name = app.node_types[node.type].name;
				var shown = "<div  id='n"+id+"' class='node added noani "+type_slug+"'><header><em>"+type_name+"</em></header>"+h1+h2+"</div>";
				var stage = "<div  id='n_"+id+"' class='node stage "+type_slug+"'>"+h1+"</div>";

				$('body').append(shown);
				$('body').append(stage);

				node.el = $("#n"+id);
				node.el_ = $("#n_"+id);

				// for teaser
				node.lh = this.interval(node.text.length, 0, 300, 2, 0.75);
			}

			if (typeof node.el === "undefined") node.el = $("#n"+id);
			if (typeof node.el_ === "undefined") node.el_ = $("#n_"+id);

			// if (typeof node.width === "undefined") {
			node.el_.css({'font-size': this.fs});
			node.width = node.el_.find('h1').width();
		}

		// events
		$("div.node header, div.node h1").unbind().click(function(e){
			var id = $(this).parent().attr('id').split("n")[1];
			
			if (that.selected!=id) {
				e.preventDefault();
				that.walk(id);
			}
			else if ($(this).is("header")) {
				that.walk(-1);
			}
		} );

		$("div.node h2 span").unbind().click(function(e){
			that.walk(-1);
		} );

		$("div.node header, div.node h1").hover(function(){
			that.peek($(this).parent().attr('id').split("n")[1], true);
		}, function(){
			that.peek($(this).parent().attr('id').split("n")[1]);
		});

	}

	// set filtered state and redraw
	this.filter = function() {
		
		// set 'filtered' classes for types
		$("#info li.filtered").removeClass("filtered");
		for (var i = 0; i < this.filtered.length; i++) {
			if (this.filtered.charAt(i)=="1") $("#t"+i).addClass("filtered");
		}
		
		this.elements();
		this.setWindow();
		
		// cancel selection when active node is filtered		
		if (this.selected>-1 && this.filtered.charAt(this.Nodes[this.selected].type)=="1") {
			this.walk(-1);
		}
		else {
			this.draw();			
		}
	}

	// check if displayed
	this.isFiltered = function(node) {
		if (this.filtered.charAt(node.type)=="1") return true;
		else return false;		
	}

	// stylize elements
	this.draw = function() {

		// clear timeouts
		while (this.timeouts.length>0) clearTimeout(this.timeouts.pop());

		var that = this;
		var pid = this.selected;

		// search
		if (pid==-1 && that.query.length>0 && typeof that.spreads['-2'] !== "undefined") pid = '-2';

		if (pid<0) $("#search").focus();

		// LAYOUT

		// visible labels
		var visiblelabels = 30;
		var ordered = [];
		for (var i=0; i < this.nodes.length; i+=1) {
			this.nodes[i].linked = false;
			if (this.isFiltered(this.nodes[i])) continue;
			ordered.push(this.nodes[i]);
		}

		ordered.sort(function(a, b) {
				if (that.spreads[pid][a.id]>that.spreads[pid][b.id]) return -1;	else return 1;
		});

		if (pid=='-2') {
			for (var i=0; i < ordered.length; i+=1) {
				var rel = that.spreads[pid][ordered[i].id];

				if (rel>0) ordered[i].linked = true;
				else ordered[i].linked = false;

				if (i<visiblelabels && rel>0) ordered[i].shown = true;
				else ordered[i].shown = false;
			}

		}
		else {
			for (var i=0; i < ordered.length; i+=1) {
				if (ordered[i].id==pid) ordered[i].shown = true;
				else if (i<visiblelabels && this.spreads[pid][ordered[i].id]>0) ordered[i].shown = true;
				else ordered[i].shown = false;
			}
		}

		// linked to active node
		if (pid>=0) {
			for (var i=0; i < this.Nodes[pid].links.length; i+=1) {
				this.Nodes[ this.Nodes[pid].links[i] ].linked = true;
				this.Nodes[ this.Nodes[pid].links[i] ].shown = true;
			}
		}

		// set size
		for (var i=0; i < this.nodes.length; i+=1) {
			var node = this.nodes[i];
			var id = node.id;
			node.size = Math.round(this.interval(this.spreads['-1'][id], this.valmin['-1'], this.valmax['-1'], this.s/2.5, this.s*1.5));
		}

		// circle specs
		var r = this.r;
		var r_2 = Math.round(r/2);
		var x = $(window).width()/2;
		var y = $(window).height()/2;
		var s = this.s;

		// sum circle sizes
		var sizesum = 0;
		var filtered = 0;
		for (var i=0; i < this.nodes.length; i+=1) {
			var node = this.nodes[i];
			if (this.isFiltered(node)) filtered++;
			else sizesum += node.size;
		}
		var notfiltered = this.nodes.length - filtered;

		// circular displacements
		var sizeinc = 0;
		for (var i=0; i < this.nodes.length; i+=1) {
			var node = this.nodes[i];
			if (this.isFiltered(node)) continue;
			var id = node.id;

			var val = this.spreads[pid][id];
			var val_ = Math.log(10*val+1);
			var max_ = Math.log(10*this.valmax[pid]+1);
			var min_ = Math.log(10*this.valmin[pid]+1);
			var d = this.interval(val_, max_, min_, 0, s*25);

			if (node.linked) d = d - 5*s;

			var circleratio = (sizeinc+node.size/2)/sizesum;

			node.angle = circleratio*360;

			node.x = Math.round(x+(r+d)*Math.sin(circleratio*360*Math.PI/180));
			node.y = Math.round(y+(r+d)*-Math.cos(circleratio*360*Math.PI/180));

			node.y = node.y;

			sizeinc += node.size;
		}

		// STYLING
		$(".overicon").removeClass("overicon");		
		$(".tobehidden").removeClass("tobehidden");
		$(".hidden").removeClass("hidden");
		$(".article").removeClass("article");
		$(".sheet").removeClass("sheet");

		for (var i=0; i < this.nodes.length; i+=1) {			
			var node = this.nodes[i];
			if (this.isFiltered(node)) continue;
			var id = this.nodes[i].id;
			var val = this.spreads[this.selected][id];

			var w = node.size;
			var f = this.fs;

			// classes
			if (node.linked || pid==-1)  node.el.addClass("linked");
			else node.el.removeClass("linked");

			if (node.shown) node.el.removeClass('hidden').addClass('shown');
			else node.el.removeClass('shown').addClass('hidden');

			if (this.selected==node.id) node.el.addClass("sheet");
			else node.el.removeClass("sheet");

			// icon
			var header = {
				left: node.x-w/2,
				top: node.y-w/2,
				width: w,
				height: w,
				'font-size': f*.9,
				opacity: 1
			};

			// type
			var em = {
				'margin-left': 0,
				'line-height': .5*f+'px',
				left: 0
			};

			// label
			var h1 = {
				display: 'block',
				'font-size': f,
				width: node.width/2,
				'transform-origin': "0% 0%",
				left: node.x,
				top: node.y,
				'max-width': node.width/2
			};

			// position
			if (node.angle<180) h1.transform = "rotate("+(node.angle-90)+"deg)  translate("+Math.round(node.size)+"px, 0)";
			else 								h1.transform = "rotate("+(node.angle-270)+"deg) translate(-"+Math.round(node.width/2 + node.size)+"px, 0)";

			// teaser and text
			var h2 = {
				top: y-4.5*s,
				'font-size': f * .8,
				left: x-r_2-2*s,
				width: r+5*s
			};

			// sheet for active node
			if (this.selected==node.id) {

				header = {
					left: x-r_2-2*s,
					top: h2.top-5.5*s,
					width: 3*s,
					height: 3*s,
					'font-size': f*.9
				};

				if (app.showType==false) {
					header.opacity = 0;
				}

				em['left'] = 3.5*s+"px";
				em['top'] = 0;
				em['line-height'] = 3*s+"px";

				// h1['font-size'] = f*1.25;
				h1.left = x-r_2-2*s;

				h1.width = node.width * 3+"px";
				h1.top = header.top + 5*s;
				h1.transform = "rotate(0deg)";
				h1['max-width'] = r+5*s;

				node.el.find("h2").css(h2);
			}

			node.css.header = header;
			node.css.em = em;
			node.css.h1 = h1;
			node.css.h2 = h2;
		}

		// apply css
		for (var i=0; i < this.nodes.length; i+=1) {
			var node = this.nodes[i];
			if (this.isFiltered(node)) continue;
			if (this.modeChange && !node.shown) node.el.addClass("noani");
			node.el.find("header").css(node.css.header);
			node.el.find("header em").css(node.css.em);
			node.el.find("h1").css(node.css.h1);
			node.el.find("h2").css(node.css.h2);
		}

		this.timeouts.push(
			setTimeout(function(){
				$(".noani").removeClass("noani");
				
			}, 500)
		);

		$("div.node header").unbind("mousemove");

		this.timeouts.push(
			setTimeout(function(){
				$(".added").removeClass("added");
				
				// close sheet cross
				$("div.node.sheet header").mousemove(function( e ) {
					if (e.target.tagName=="HEADER") $(this).addClass("overicon");					
					else $(this).removeClass("overicon");					
				});
				
			}, 1000)
		);
	}

	return this;
}
