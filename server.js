var express = require("express");
var morgan = require("morgan");
var bodyParser = require("body-parser");

var mongo = require("mongodb");


var server = new mongo.Server("localhost", 27017, { auto_reconnect: true });
var db = new mongo.Db("usageStats", server, { w: 1 });

db.open(function(err, db) {
	if(err) {
		throw err;
	}

	console.log("Connected to usageStats database.");
});

var app = express();

app.use(morgan());
app.use(bodyParser());

app.post("/actions", function(req, res) {
	var action = req.body;

	if(!action) {
		return error(res, "Invalid JSON");
	}

	if(!action.id) {
		return error(res, "Invalid session ID");
	}

	if(!action.state) {
		return error(res, "Invalid state");
	}

	if(!action.event) {
		return error(res, "Invalid event");
	}

	if(!action.outcome) {
		return error(res, "Invalid outcome");
	}

	console.log("Adding action: " + JSON.stringify(action));

	db.collection("actions", function(err, collection) {
		if(err) {
			console.error(err);
			error(res, "Internal server error");
			return;
		}

		collection.insert(action, function(err, result) {
			if(err) {
				console.error(err);
				error(res, "Internal server error");
				return;
			}

			success(res);	
		});

	});
});

function success(res) {
	console.log("Response: Success");
	res.send({
		success: "1"
	});
}

function error(res, message) {
	console.log("Response: " + message);
	res.send({
		error: message
	});
}

app.listen(3000);

console.log("Listeing...");