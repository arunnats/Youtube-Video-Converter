const express = require("express");
const ejs = require("ejs");
const path = require("path");
const bodyParser = require("body-parser");

const app = express();
const port = 3000;

app.set("views", path.join(__dirname, "public", "views"));
app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.listen(port, () => {
	console.log(`Server is running on port ${port}`);
});
