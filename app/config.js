var app = {};

app.node_types = [
	{slug: 'bt_tactic',       name: 'Tactic', 			names: 'Tactics', 		 color: '#e7932e' },
	{slug: 'bt_principle',    name: 'Principle', 		names: 'Principles', 	 color: '#12a3d9' },
	{slug: 'bt_theory',       name: 'Theory', 			names: 'Theories', 		 color: '#b50035' },
	{slug: 'bt_case',         name: 'Case Study', 	names: 'Case Studies',  color: '#7eb84f' },
	{slug: 'bt_practitioner', name: 'Practitioner', names: 'Practitioners', color: '#5F41A3' }
];

//	dataType: js, json, csv
app.dataType 	= 'json';
app.dataFile 	= 'app/data.json';
app.showType 	= true;
app.title 		= "Beautiful Trouble";
app.url 			= "http://beautifultrouble.org/";

