/*jshint -W097 */// jshint strict:false
/*jslint node: true */
'use strict';

const request   = require('request-promise');
const utils     = require(__dirname + '/lib/utils');
const adapter   = new utils.Adapter('etamon');
const xpath     = require('xpath');
const xmldom    = require('xmldom').DOMParser;
const select = xpath.useNamespaces({"eta": "http://www.eta.co.at/rest/v1"});
var   menu;
var   variables;

adapter.on('ready', function () {
	// Timeout for adapter if ETA takes too long to respond (overall process)
	setTimeout( function() {
		adapter.log.error("ETA service monitoring timeout [" + adapter.config.etaTimeout + "]!");
        adapter.stop();
    }, adapter.config.etaTimeout);
    // Optional delete any "etamon" variable if existing
	adapter.log.debug("** Debug Mode: " + adapter.config.etaDebug);
	if(adapter.config.etaDebug) {
		// After deletion the read will be started
    	deleteEta();
    } else {
    	// Start reading the data from ETA unit
    	readEta();
    }
});

function readEta() {
	// Check if the expectedt global variable (etamon) does exist in the ETA device
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon",
			method: "GET"
		},
		function(error, response, content) {
			adapter.log.debug("** Checking if global variable is available");
			if(content.indexOf("<error>") > -1) {
				// When restarting/updating the ETA unit, the stored variable will get lost
				request(
					{
						url: "http://192.168.178.24:8080/user/vars/etamon",
						method: "PUT"
					},
					function(error, response, content) {
						adapter.log.debug("** Created global variable - next: getMenu(true)");
						getMenu(true);
					}
				).catch(
					function() { /* FIX possible ETA status 400 */ }
				)
			} else {
				adapter.log.debug("** Global variable is available - next: getMenu(false)");
				getMenu(false);
			}
		}
	).catch(
		function() { /* FIX possible ETA status 404 */ }
	)

}

function getMenu(createStructure) {
	request(
		{
			url: "http://192.168.178.24:8080/user/menu"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				// Everything is ok - lets parse the XML
				menu = new xmldom().parseFromString(content);
			} else {
				adapter.log.error(error);
			}
		}
	).then(
		function(content) {
			if(createStructure) {
				adapter.log.debug("** Menu variables read - next: setVariables");
				setVariables();
			} else {
				adapter.log.debug("** Menu variables read - next: getVariables");
				getVariables();
				// adapter.stop();
			}
		}
	);
}

function setVariables() {
	var menuNodes = (select('//eta:*[@uri]', menu));
	var addedNodes = 0;
	var addedVariables = 0;
	var skippedVariables = 0;
	adapter.log.debug("** "+menuNodes.length+" ETA menu nodes found");
	
	for(var i = 0; i<menuNodes.length; i++) {
		adapter.log.silly("** Try to add ETA menu node ["+i+"/"+menuNodes.length+"]: "+menuNodes[i].getAttribute("uri"));
		request(
			{
				url: "http://192.168.178.24:8080/user/vars/etamon" + menuNodes[i].getAttribute("uri"),
				method: "PUT"
			},
			function(error, response, content) {
				adapter.log.silly("**** Adding ETA variable [PUT error]: "+error);
				adapter.log.silly("**** Adding ETA variable [PUT response]: "+response);
				adapter.log.silly("**** Adding ETA variable [PUT content]: "+content);
			}
		).then(
			function() {
				addedNodes++;
				addedVariables++;
				if(addedNodes == menuNodes.length) {
					adapter.log.debug("** "+addedVariables+" ETA variables added, "+skippedVariables+" variables skipped - next: getVariables");
					// adapter.stop();
					getVariables();
					// continue
				}
			}
		).catch(
			function() {
				addedNodes++;
				skippedVariables++;
				if(addedNodes == menuNodes.length) {
					adapter.log.debug("** "+addedVariables+" ETA variables added, "+skippedVariables+" variables skipped - next: getVariables");
					// adapter.stop();
					getVariables();
					// continue
				}
			}
		)
	}
}

function getVariables() {
	console.log("getVariables 01");
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				// Everything is ok - lets parse the XML
				console.log("getVariables 02");
				variables = new xmldom().parseFromString(content);
				console.log("getVariables 03");
			} else {
				console.log("getVariables 04");
				adapter.log.error(error);
			}
		}
	).then(
		function() {
			console.log("getVariables 05");
			adapter.log.debug("** Global ETA variables read - next: setObjects");
			setObjects();
		}
	).catch(
		function() {
			console.log("getVariables 06");
			adapter.log.debug("** Global ETA variables read - next: setObjects");
			setObjects();
		}
	)
}

function setObjects() {
	console.log("setObjects 01");
	var menuNodes = (select('//eta:*[@uri]', menu));
	var addedNodes = 0;
	var addedVariables = 0;
	var skippedVariables = 0;
	var thisUri = "";
	adapter.log.debug("** ETA menu nodes found: "+menuNodes.length);
	console.log("setObjects 02");
	//adapter.stop();
	
	for(var i = 0; i<menuNodes.length; i++) {
		console.log("setObjects 03 - "+i);
		adapter.log.debug("** Try to add ETA menu node ["+i+"/"+menuNodes.length+"]: "+menuNodes[i].getAttribute("uri"));
		var parentNodes = (select('ancestor::eta:*[@uri]', menuNodes[i]));
		var parentPath = "";
		for(var pkey in parentNodes) {
			var parentNode = parentNodes[pkey];
			if (parentNode.getAttribute("uri")!="") {
				if(parentPath!="") {
					parentPath = parentPath + ".";
				}
				parentPath = parentPath + parentNode.getAttribute("uri");
			}
		}
		
		if(parentPath!="") {
			thisUri = parentPath.split("/").join("_")+"."+menuNodes[i].getAttribute("uri").split("/").join("_");
		} else {
			thisUri = menuNodes[i].getAttribute("uri").split("/").join("_");
		}
		//adapter.log.debug("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		var varObjects = (select('//eta:variable[@uri="'+menuNodes[i].getAttribute("uri").substr(1)+'"]',variables));
		//console.log("** Create object ["+menuNodes[i].getAttribute("name")+"] "+thisUri);
		adapter.stop();
		if(varObjects.length==0) {
			console.log("setObjects 03.a - "+i);
			setChannel(thisUri, menuNodes[i].getAttribute("name"));
		} else {
			console.log("setObjects 03.b - "+i);
			// Read attributes from value node
			var AttUri           = (select('./@uri',           varObjects[0])[0].nodeValue);
			var AttStrValue      = (select('./@strValue',      varObjects[0])[0].nodeValue);
			var AttUnit          = (select('./@unit',          varObjects[0])[0].nodeValue);
			var AttDecPlaces     = (select('./@decPlaces',     varObjects[0])[0].nodeValue);
			var AttScaleFactor   = (select('./@scaleFactor',   varObjects[0])[0].nodeValue);
			var AttAdvTextOffset = (select('./@advTextOffset', varObjects[0])[0].nodeValue);
			var AttText          = (select('./text()',         varObjects[0])[0].nodeValue);
			
			console.log("object to add: "+thisUri+" => "+menuNodes[i].getAttribute("name"));
			
			// Set params for object
			if(AttUnit.length>0) {
				var outValue = AttText * 1.0 / AttDecPlaces;
				var outType  = "number"
				var outUnit  = AttUnit;
				if(AttUnit=="°C") {
					var outRole  = "value.temperature";
				} else {
					var outRole  = "state";
				}
			} else {
				var outValue = AttStrValue;
				var outType  = "text"
				var outUnit  = AttUnit;
				var outRole  = "state";
			}
			adapter.log.silly("outUri  : " + thisUri);
			adapter.log.silly("  strValue     : " + AttStrValue);
			adapter.log.silly("  unit         : " + AttUnit);
			adapter.log.silly("  decPlaces    : " + AttDecPlaces);
			adapter.log.silly("  scaleFactor  : " + AttScaleFactor);
			adapter.log.silly("  advTextOffset: " + AttAdvTextOffset);
			adapter.log.silly("  text()       : " + AttText);
			adapter.log.silly("    outType  : " + outType);
			adapter.log.silly("    outValue : " + outValue);
			adapter.log.silly("    outUnit  : " + outUnit);
			adapter.log.silly("    outRole  : " + outRole);
			
			// Create object and store data
			setObject(thisUri, menuNodes[i].getAttribute("name"), outType, outUnit, outRole);
			setValue (thisUri, outValue);
		}
		console.log("setObjects 04");
		//console.log(varObjects[0]);
	}
	console.log("setObjects 05");
	
	
	
	
	
	adapter.stop();
}

function setChannel(uri, name) {
	console.log("setChannel 01 - " + uri);
    adapter.setObjectNotExists(uri, {
        type: 'channel',
        common: {
            name: name
        },
        native: {}
    });
    console.log("setChannel 02 - " + uri);
}


function setObject(uri, name, unit, type, role) {
	console.log("setObject 01 - " + uri);
    adapter.setObjectNotExists(uri, {
        type: 'state',
        common: {
            name: name,
            type: type,
            unit: unit,
            role: role
        },
        native: {}
    });
	console.log("setObject 02 - " + uri);
}

function setValue(uri, value) {
	console.log("setValue 01 - " + uri);
    adapter.setState(uri, {val: value, ack: true});
	console.log("setValue 02 - " + uri);
}



function deleteEta() {
	request(
		{
			url: "http://192.168.178.24:8080/user/vars/etamon",
			method: "DELETE"
		},
		function(error, response, content) {
			if(!error && response.statusCode == 200) {
				adapter.log.debug("** ETA variable deleted!");
			} else {
				adapter.log.error(error);
			}
		}
	).then(
		function() {
			readEta();
		}
	)
}
